/**
 * Danger-free index migration for the Payment collection.
 *
 * Razorpay order ids should be unique per payment so that a booking can never
 * accumulate many "created" Payment rows, and a payment id should be unique so a
 * single capture can never be recorded twice. Both are enforced at the
 * application layer (see paymentService), and this script also adds sparse
 * unique DB indexes — but only AFTER confirming there are no existing duplicates.
 *
 * If duplicates are found it prints them (order ids / payment ids) and exits
 * WITHOUT touching the database, leaving remediation to an operator. It never
 * deletes data.
 *
 * Usage:
 *   node scripts/ensurePaymentIndexes.js        (check + create when safe)
 *   node scripts/ensurePaymentIndexes.js --check (report only, no changes)
 */
require('dotenv').config();
const mongoose = require('mongoose');
const Payment = require('../models/Payment');

const CHECK_ONLY = process.argv.includes('--check');

async function findDuplicates(field, label) {
  const dups = await Payment.aggregate([
    { $match: { [field]: { $ne: null } } },
    { $group: { _id: `$${field}`, count: { $sum: 1 } } },
    { $match: { count: { $gt: 1 } } },
    { $sort: { count: -1 } },
    { $limit: 20 },
  ]);
  if (dups.length) {
    console.log(`[index] DUPLICATE ${label} values found (${dups.length} groups):`);
    dups.forEach((d) => console.log(`  - ${d._id}  (${d.count} rows)`));
  }
  return dups;
}

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI is not set. Aborting.');
    process.exit(1);
  }
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 20000 });
  console.log('[index] Connected to MongoDB');

  const orderDups = await findDuplicates('razorpayOrderId', 'razorpayOrderId');
  const payDups = await findDuplicates('razorpayPaymentId', 'razorpayPaymentId');
  const totalDups = orderDups.length + payDups.length;

  if (totalDups > 0) {
    console.error(
      `[index] Aborting: ${totalDups} duplicate group(s) found. ` +
      'Investigate and de-duplicate before running again. No changes were made.'
    );
    await mongoose.disconnect();
    process.exit(2);
  }

  if (CHECK_ONLY) {
    console.log('[index] Check only: no duplicates, no changes made.');
    await mongoose.disconnect();
    return;
  }

  const collection = Payment.collection;
  await collection.createIndex({ razorpayOrderId: 1 }, { unique: true, sparse: true });
  await collection.createIndex({ razorpayPaymentId: 1 }, { unique: true, sparse: true });
  console.log('[index] Created sparse unique indexes on razorpayOrderId and razorpayPaymentId.');

  await mongoose.disconnect();
  console.log('[index] Done.');
}

main().catch(async (err) => {
  console.error('[index] Failed:', err.message);
  try { await mongoose.disconnect(); } catch {}
  process.exit(1);
});
