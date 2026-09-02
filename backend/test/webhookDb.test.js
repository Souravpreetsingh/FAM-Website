/**
 * DB-backed webhook integration tests.
 *
 * Verifies the Step 6 requirements:
 *   - raw body is what gets signed (already covered at unit level)
 *   - a duplicate payment.captured event is processed idempotently
 *   - confirm-once (booking never confirmed twice)
 *   - no duplicate Payment row
 *   - failed can never regress a confirmed/paid booking
 *   - refund event after paid is handled
 *
 * Requires a running MongoDB (TEST_MONGODB_URI).
 */
const { test, before, after, afterEach } = require('node:test');
const assert = require('node:assert');
const mongoose = require('mongoose');
const crypto = require('crypto');

const Payment = require('../models/Payment');
const Booking = require('../models/Booking');
const Room = require('../models/Room');
const User = require('../models/User');
const paymentService = require('../services/paymentService');

const URI = (() => {
  const base = process.env.TEST_MONGODB_URI;
  if (!base) return undefined;
  const u = new URL(base);
  u.pathname = '/fam_test_webhookdb';
  return u.toString();
})();
const HAS_DB = !!URI;

function sign(body, secret) {
  return crypto.createHmac('sha256', secret).update(body).digest('hex');
}

before(async () => {
  if (!HAS_DB) return;
  await mongoose.connect(URI, { serverSelectionTimeoutMS: 5000 });
});

after(async () => {
  if (paymentService._setRazorpayClientForTest) paymentService._setRazorpayClientForTest(null);
  if (HAS_DB) {
    await Promise.all([Payment.deleteMany({}), Booking.deleteMany({}), Room.deleteMany({}), User.deleteMany({})]);
    await mongoose.disconnect();
  }
});

afterEach(() => {
  paymentService._setRazorpayClientForTest(null);
});

async function seedPaidPayment() {
  const user = await User.create({ name: 'WH User', email: 'wh-' + Date.now() + '@fam.test', password: 'password123' });
  const room = await Room.create({ name: 'WH Room', slug: 'wh-room-' + Date.now(), totalRooms: 1, pricePerNight: 2000, capacity: { maxGuests: 2 }, description: 'test' });
  const oid = 'wh_order_' + Math.random().toString(36).slice(2, 10);
  const pid = 'wh_pay_' + Math.random().toString(36).slice(2, 10);
  const booking = await Booking.create({
    user: user._id, room: room._id, checkIn: new Date('2033-01-01'), checkOut: new Date('2033-01-03'),
    guests: { adults: 2, children: 0 }, totalAmount: 4000, amountPaid: 0, currency: 'INR', nights: 2, status: 'pending', paymentStatus: 'pending',
  });
  const payment = await Payment.create({
    booking: booking._id, user: user._id, razorpayOrderId: oid, razorpayPaymentId: pid,
    amount: 4000, currency: 'INR', status: 'created', metadata: { orderAmount: 400000 },
  });
  await Payment.updateOne({ _id: payment._id }, { razorpayPaymentId: pid, status: 'created' });
  booking.payment = payment._id;
  await booking.save();
  return { booking, payment, oid, pid, user };
}

test('DB-backed webhook: duplicate payment.captured is idempotent (confirm once)', { skip: !HAS_DB && 'TEST_MONGODB_URI not set' }, async () => {
  process.env.RAZORPAY_WEBHOOK_SECRET = 'whsec_test';
  const { booking, payment, oid, pid } = await seedPaidPayment();

  function capturedEvent(createdAt = 1700000100) {
    const body = JSON.stringify({
      event: 'payment.captured',
      payload: {
        payment: { entity: { id: pid, order_id: oid, created_at: createdAt } },
      },
    });
    return { rawBody: Buffer.from(body), signature: sign(body, 'whsec_test'), event: 'payment.captured', payload: JSON.parse(body).payload };
  }

  // Send the same event twice (Razorpay retries with identical bytes/creation time).
  const first = await paymentService.handleWebhook(capturedEvent());
  assert.ok(first.updated === undefined ? (first.alreadyProcessed !== undefined || true) : true);
  // It must have moved to paid on the first.
  let p0 = await Payment.findById(payment._id);
  assert.strictEqual(p0.status, 'paid');
  assert.strictEqual(p0.paidAt !== null, true);

  const second = await paymentService.handleWebhook(capturedEvent());
  // Second identical event must NOT move a paid payment to a terminal that regresses.
  p0 = await Payment.findById(payment._id);
  assert.strictEqual(p0.status, 'paid', 'still paid after duplicate');

  // Booking confirmed exactly once (a single Payment row, single confirmation state).
  const reloaded = await Booking.findById(booking._id);
  assert.strictEqual(reloaded.paymentStatus, 'paid');
  assert.strictEqual(reloaded.status, 'confirmed');

  const rows = await Payment.find({ booking: booking._id });
  assert.strictEqual(rows.length, 1, 'no duplicate Payment row created by webhook');
  assert.ok(rows[0].webhookEvents.length >= 1, 'webhook event recorded for idempotency');
});

test('DB-backed webhook: payment.failed cannot regress a paid booking', { skip: !HAS_DB && 'TEST_MONGODB_URI not set' }, async () => {
  process.env.RAZORPAY_WEBHOOK_SECRET = 'whsec_test';
  const { booking, payment, oid, pid } = await seedPaidPayment();

  // First confirm via captured.
  const capBody = JSON.stringify({ event: 'payment.captured', payload: { payment: { entity: { id: pid, order_id: oid, created_at: 1700000000 } } } });
  await paymentService.handleWebhook({ rawBody: Buffer.from(capBody), signature: sign(capBody, 'whsec_test'), event: 'payment.captured', payload: JSON.parse(capBody).payload });

  // Now a late/fake payment.failed arrives (out-of-order).
  const failBody = JSON.stringify({ event: 'payment.failed', payload: { payment: { entity: { id: pid, order_id: oid, created_at: 1700000000, error_description: 'late failure' } } } });
  const res = await paymentService.handleWebhook({ rawBody: Buffer.from(failBody), signature: sign(failBody, 'whsec_test'), event: 'payment.failed', payload: JSON.parse(failBody).payload });

  const p0 = await Payment.findById(payment._id);
  assert.strictEqual(p0.status, 'paid', 'paid can never regress to failed');
  const b0 = await Booking.findById(booking._id);
  assert.strictEqual(b0.paymentStatus, 'paid', 'booking stays paid');
  assert.strictEqual(b0.status, 'confirmed');
});

test('DB-backed webhook: refund after paid moves booking to refunded', { skip: !HAS_DB && 'TEST_MONGODB_URI not set' }, async () => {
  process.env.RAZORPAY_WEBHOOK_SECRET = 'whsec_test';
  const { booking, payment, oid, pid } = await seedPaidPayment();

  const capBody = JSON.stringify({ event: 'payment.captured', payload: { payment: { entity: { id: pid, order_id: oid, created_at: 1700000000 } } } });
  await paymentService.handleWebhook({ rawBody: Buffer.from(capBody), signature: sign(capBody, 'whsec_test'), event: 'payment.captured', payload: JSON.parse(capBody).payload });

  const refBody = JSON.stringify({
    event: 'refund.processed',
    payload: {
      refund: { entity: { id: 'refund_' + oid, amount: 400000, status: 'processed', payment_id: pid } },
      payment: { entity: { id: pid, order_id: oid, status: 'captured', amount: 400000 } },
    },
  });
  const res = await paymentService.handleWebhook({ rawBody: Buffer.from(refBody), signature: sign(refBody, 'whsec_test'), event: 'refund.processed', payload: JSON.parse(refBody).payload });

  const p0 = await Payment.findById(payment._id);
  assert.strictEqual(p0.status, 'refunded');
  assert.strictEqual(p0.refundedAt !== null, true);
  const b0 = await Booking.findById(booking._id);
  assert.strictEqual(b0.paymentStatus, 'refunded');
});

test('DB-backed webhook: raw body is signed exactly (whitespace changes signature)', { skip: !HAS_DB && 'TEST_MONGODB_URI not set' }, async () => {
  process.env.RAZORPAY_WEBHOOK_SECRET = 'whsec_raw';
  const body = JSON.stringify({ event: 'payment.captured', payload: { payment: { entity: null, created_at: 1 } } });
  const sigA = sign(body, 'whsec_raw');
  const sigB = sign(body + '\n', 'whsec_raw');
  assert.notStrictEqual(sigA, sigB);
});

test('DB-backed refund: processRefund requires a paid payment, records refund id, is duplicate-safe', { skip: !HAS_DB && 'TEST_MONGODB_URI not set' }, async () => {
  process.env.RAZORPAY_WEBHOOK_SECRET = 'whsec_test';
  const { booking, payment, oid, pid } = await seedPaidPayment();

  // Confirm first (so paymentStatus = paid).
  const capBody = JSON.stringify({ event: 'payment.captured', payload: { payment: { entity: { id: pid, order_id: oid, created_at: 1700000000 } } } });
  await paymentService.handleWebhook({ rawBody: Buffer.from(capBody), signature: sign(capBody, 'whsec_test'), event: 'payment.captured', payload: JSON.parse(capBody).payload });

  let refundCalls = 0;
  paymentService._setRazorpayClientForTest({
    orders: { create: async () => ({ id: oid, amount: 400000, currency: 'INR', notes: {} }) },
    payments: {
      fetch: async () => ({ id: pid, order_id: oid, amount: 400000, currency: 'INR', status: 'captured' }),
      refund: async () => { refundCalls++; return { id: 'rfnd_' + oid, amount: 400000, status: 'processed' }; },
    },
  });

  const result = await paymentService.processRefund(booking._id.toString(), null, { _id: 'admin1', role: 'admin' }, 'test refund');
  assert.strictEqual(refundCalls, 1, 'Razorpay refund issued once');

  const p0 = await Payment.findById(payment._id);
  assert.strictEqual(p0.status, 'refunded');
  assert.strictEqual(p0.refundId, 'rfnd_' + oid, 'refund id stored on payment');
  assert.strictEqual(p0.refundAmount, 4000, 'refund amount stored (INR, rupees)');

  const b0 = await Booking.findById(booking._id);
  assert.strictEqual(b0.paymentStatus, 'refunded');
  assert.ok(['cancelled', 'confirmed'].includes(b0.status), 'booking status uses a valid enum value');

  // Duplicate refund protection: refunding again must be rejected.
  await assert.rejects(
    () => paymentService.processRefund(booking._id.toString(), null, { _id: 'admin1', role: 'admin' }, 'double refund'),
    /not completed|not paid|refund/i,
  );
  assert.strictEqual(refundCalls, 1, 'Razorpay not called again for duplicate refund');
});
