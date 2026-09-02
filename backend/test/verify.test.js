/**
 * Comprehensive payment verify + order-idempotency integration tests.
 *
 * Covers:
 *   - amount manipulation / amount mismatch
 *   - wrong order (order_id does not match local record)
 *   - wrong payment (payment_id does not match)
 *   - wrong booking (different user ownership)
 *   - wrong currency
 *   - authorized-but-uncaptured payment accepted
 *   - duplicate verification idempotency
 *   - duplicate order creation (order reuse)
 *   - unauthorized verify (another user's booking)
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
  u.pathname = '/fam_test_verify';
  return u.toString();
})();
const HAS_DB = !!URI;

let ownerUser;
let otherUser;
let testRoom;

function sign(body, secret) {
  return crypto.createHmac('sha256', secret).update(body).digest('hex');
}

before(async () => {
  if (!HAS_DB) return;
  await mongoose.connect(URI, { serverSelectionTimeoutMS: 5000 });

  // Two separate users to test ownership / unauthorized paths.
  ownerUser = await User.create({
    name: 'Owner',
    email: 'owner-' + Date.now() + '@fam.test',
    password: 'password123',
  });
  otherUser = await User.create({
    name: 'Other',
    email: 'other-' + Date.now() + '@fam.test',
    password: 'password123',
  });

  testRoom = await Room.create({
    name: 'Verify Test Room',
    slug: 'verify-test-' + Date.now(),
    totalRooms: 2,
    pricePerNight: 5000,
    capacity: { maxGuests: 2 },
    description: 'test',
  });
});

after(async () => {
  if (paymentService._setRazorpayClientForTest) paymentService._setRazorpayClientForTest(null);
  if (HAS_DB) {
    await Promise.all([Payment.deleteMany({}), Booking.deleteMany({}), Room.deleteMany({}), User.deleteMany({})]);
    await mongoose.disconnect();
  }
});

// Reset the DI Razorpay client between tests so each test starts clean.
afterEach(() => {
  paymentService._setRazorpayClientForTest(null);
});

// ─── helpers ────────────────────────────────────────────────────────────────

function fakeRzpClient(overrides, orderId) {
  overrides = overrides || {};
  const oid = orderId || 'order_created_1';
  const pid = oid + '_pay';
  return {
    orders: {
      create: overrides.create || (async () => ({ id: oid, amount: 500000, currency: 'INR', notes: {} })),
    },
    payments: {
      fetch: overrides.fetch || (async () => ({
        id: pid,
        order_id: oid,
        amount: 500000,
        currency: 'INR',
        status: 'captured',
        method: 'card',
      })),
      refund: overrides.refund || (async () => ({ id: 'refund_test_1' })),
    },
  };
}

async function createBookingWithPayment(user, amountPaise = 500000, orderId) {
  const oid = orderId || ('order_' + Math.random().toString(36).slice(2, 10));
  const booking = await Booking.create({
    user: user._id,
    room: testRoom._id,
    checkIn: new Date('2031-06-01'),
    checkOut: new Date('2031-06-03'),
    guests: { adults: 2, children: 0 },
    totalAmount: amountPaise / 100,
    amountPaid: 0,
    currency: 'INR',
    nights: 2,
    status: 'pending',
    paymentStatus: 'pending',
  });
  const payment = await Payment.create({
    booking: booking._id,
    user: user._id,
    razorpayOrderId: oid,
    amount: amountPaise / 100,
    currency: 'INR',
    status: 'created',
    metadata: { orderAmount: amountPaise },
  });
  booking.payment = payment._id;
  await booking.save();
  return { booking, payment, oid };
}

function payload(orderId, paymentId, secret) {
  const raw = orderId + '|' + paymentId;
  return {
    razorpay_order_id: orderId,
    razorpay_payment_id: paymentId,
    razorpay_signature: sign(raw, secret),
  };
}

// ─── Step 5 checkbox tests ─────────────────────────────────────────────────

test('DB-backed verify: invalid signature is rejected without DB mutation', { skip: !HAS_DB && 'TEST_MONGODB_URI not set' }, async () => {
  process.env.RAZORPAY_KEY_SECRET = 'sk_test_v';
  const { booking, oid } = await createBookingWithPayment(ownerUser);
  paymentService._setRazorpayClientForTest(fakeRzpClient(null, oid));
  await assert.rejects(
    () => paymentService.verifyPayment({ razorpay_order_id: oid, razorpay_payment_id: oid + '_pay', razorpay_signature: 'bad' }, ownerUser._id),
    /Invalid payment signature/i,
  );
  const after = await Payment.findOne({ booking: booking._id });
  assert.strictEqual(after.status, 'created', 'must not transition on bad sig');
});

test('DB-backed verify: missing signature field is rejected', { skip: !HAS_DB && 'TEST_MONGODB_URI not set' }, async () => {
  process.env.RAZORPAY_KEY_SECRET = 'sk_test_v';
  const { oid } = await createBookingWithPayment(ownerUser);
  paymentService._setRazorpayClientForTest(fakeRzpClient(null, oid));
  await assert.rejects(
    () => paymentService.verifyPayment({ razorpay_order_id: oid, razorpay_payment_id: oid + '_pay' }, ownerUser._id),
    /Invalid payment signature/i,
  );
});

test('DB-backed verify: amount manipulation — Razorpay amount differs from orderAmount', { skip: !HAS_DB && 'TEST_MONGODB_URI not set' }, async () => {
  process.env.RAZORPAY_KEY_SECRET = 'sk_test_amt';
  const fakeFetch = async () => ({
    id: 'pay_amt_mismatch',
    order_id: 'order_amt_1',
    amount: 1,                       // manipulated: 1 paise
    currency: 'INR',
    status: 'captured',
    method: 'card',
  });
  paymentService._setRazorpayClientForTest({ orders: { create: async () => ({ id: 'order_amt_1', amount: 500000, currency: 'INR', notes: {} }) }, payments: { fetch: fakeFetch, refund: async () => ({}) } });

  const booking = await Booking.create({
    user: ownerUser._id, room: testRoom._id, checkIn: new Date('2031-07-01'), checkOut: new Date('2031-07-03'),
    guests: { adults: 2, children: 0 }, totalAmount: 5000, amountPaid: 0, currency: 'INR', nights: 2, status: 'pending', paymentStatus: 'pending',
  });
  await Payment.create({ booking: booking._id, user: ownerUser._id, razorpayOrderId: 'order_amt_1', amount: 5000, currency: 'INR', status: 'created', metadata: { orderAmount: 500000 } });

  const sig = sign('order_amt_1|pay_amt_mismatch', 'sk_test_amt');
  await assert.rejects(
    () => paymentService.verifyPayment({ razorpay_order_id: 'order_amt_1', razorpay_payment_id: 'pay_amt_mismatch', razorpay_signature: sig }, ownerUser._id),
    /amount.*mismatch|mismatch.*amount/i,
  );
  const after = await Payment.findOne({ booking: booking._id });
  assert.strictEqual(after.status, 'created');
});

test('DB-backed verify: wrong order — order_id does not match local record', { skip: !HAS_DB && 'TEST_MONGODB_URI not set' }, async () => {
  process.env.RAZORPAY_KEY_SECRET = 'sk_test_w';
  paymentService._setRazorpayClientForTest(fakeRzpClient());
  const { booking } = await createBookingWithPayment(ownerUser);

  // Razorpay returns order_id that does NOT match local razorpayOrderId
  const sig = sign('wrong_order|pay_fetched_1', 'sk_test_w');
  await assert.rejects(
    () => paymentService.verifyPayment({ razorpay_order_id: 'wrong_order', razorpay_payment_id: 'pay_fetched_1', razorpay_signature: sig }, ownerUser._id),
    /order.*mismatch|not found|payment not found|does not belong/i,
  );
  const after = await Payment.findOne({ booking: booking._id });
  assert.strictEqual(after.status, 'created');
});

test('DB-backed verify: wrong payment — payment_id does not belong to the order', { skip: !HAS_DB && 'TEST_MONGODB_URI not set' }, async () => {
  process.env.RAZORPAY_KEY_SECRET = 'sk_test_wp';
  const { booking, oid } = await createBookingWithPayment(ownerUser);
  // Local payment has razorpayOrderId = oid. Razorpay returns a payment whose
  // order_id differs from the local order id -> "does not belong to this order".
  const badFetch = async () => ({
    id: 'pay_' + oid,
    order_id: oid + '_other',      // <-- not the local order id
    amount: 500000,
    currency: 'INR',
    status: 'captured',
    method: 'card',
  });
  paymentService._setRazorpayClientForTest({ orders: { create: async () => ({ id: oid, amount: 500000, currency: 'INR', notes: {} }) }, payments: { fetch: badFetch, refund: async () => ({}) } });

  await assert.rejects(
    () => paymentService.verifyPayment({ razorpay_order_id: oid, razorpay_payment_id: 'pay_' + oid, razorpay_signature: sign(oid + '|pay_' + oid, 'sk_test_wp') }, ownerUser._id),
    /order.*mismatch|belongs.*order|not.*order/i,
  );
  const after = await Payment.findOne({ booking: booking._id });
  assert.strictEqual(after.status, 'created');
});

test('DB-backed verify: wrong currency is rejected', { skip: !HAS_DB && 'TEST_MONGODB_URI not set' }, async () => {
  process.env.RAZORPAY_KEY_SECRET = 'sk_test_curr';
  const fakeFetch = async () => ({
    id: 'pay_curr_1',
    order_id: 'order_curr_1',
    amount: 500000,
    currency: 'USD',              // <-- wrong currency
    status: 'captured',
    method: 'card',
  });
  paymentService._setRazorpayClientForTest({ orders: { create: async () => ({ id: 'order_curr_1', amount: 500000, currency: 'INR', notes: {} }) }, payments: { fetch: fakeFetch, refund: async () => ({}) } });

  const booking = await Booking.create({
    user: ownerUser._id, room: testRoom._id, checkIn: new Date('2031-08-01'), checkOut: new Date('2031-08-03'),
    guests: { adults: 2, children: 0 }, totalAmount: 5000, amountPaid: 0, currency: 'INR', nights: 2, status: 'pending', paymentStatus: 'pending',
  });
  await Payment.create({ booking: booking._id, user: ownerUser._id, razorpayOrderId: 'order_curr_1', amount: 5000, currency: 'INR', status: 'created', metadata: { orderAmount: 500000 } });

  const sig = sign('order_curr_1|pay_curr_1', 'sk_test_curr');
  await assert.rejects(
    () => paymentService.verifyPayment({ razorpay_order_id: 'order_curr_1', razorpay_payment_id: 'pay_curr_1', razorpay_signature: sig }, ownerUser._id),
    /amount.*mismatch|mismatch.*amount|mismatch.*currency|currency.*mismatch/i,
  );
  const after = await Payment.findOne({ booking: booking._id });
  assert.strictEqual(after.status, 'created');
});

test('DB-backed verify: authorized (uncaptured) payment is accepted as paid', { skip: !HAS_DB && 'TEST_MONGODB_URI not set' }, async () => {
  process.env.RAZORPAY_KEY_SECRET = 'sk_test_auth';
  const fakeFetch = async () => ({
    id: 'pay_auth_1',
    order_id: 'order_auth_1',
    amount: 500000,
    currency: 'INR',
    status: 'authorized',       // <-- authorized but not captured yet
    method: 'upi',
  });
  paymentService._setRazorpayClientForTest({ orders: { create: async () => ({ id: 'order_auth_1', amount: 500000, currency: 'INR', notes: {} }) }, payments: { fetch: fakeFetch, refund: async () => ({}) } });

  const { booking } = await createBookingWithPayment(ownerUser, 500000);
  // Re-set to order_auth_1
  await Payment.updateOne({ booking: booking._id }, { razorpayOrderId: 'order_auth_1' });
  booking.payment = (await Payment.findOne({ booking: booking._id }))._id;
  await booking.save();

  const sig = sign('order_auth_1|pay_auth_1', 'sk_test_auth');
  const result = await paymentService.verifyPayment({ razorpay_order_id: 'order_auth_1', razorpay_payment_id: 'pay_auth_1', razorpay_signature: sig }, ownerUser._id);
  assert.strictEqual(result.payment.status, 'paid');
  assert.strictEqual(result.createdMark, true);
  const reloaded = await Booking.findById(booking._id);
  assert.strictEqual(reloaded.paymentStatus, 'paid');
});

// A fresh booking with NO pre-existing payment, so createOrder must actually
// mint a Razorpay order the first time, then reuse on subsequent calls.
function createBookingOnly(user) {
  return Booking.create({
    user: user._id,
    room: testRoom._id,
    checkIn: new Date('2032-01-01'),
    checkOut: new Date('2032-01-03'),
    guests: { adults: 2, children: 0 },
    totalAmount: 5000,
    amountPaid: 0,
    currency: 'INR',
    nights: 2,
    status: 'pending',
    paymentStatus: 'pending',
  });
}

test('DB-backed verify: duplicate order creation reuses existing non-terminal payment', { skip: !HAS_DB && 'TEST_MONGODB_URI not set' }, async () => {
  process.env.RAZORPAY_KEY_SECRET = 'sk_test_dup_order';
  let createCount = 0;
  paymentService._setRazorpayClientForTest({
    orders: {
      create: async (params) => { createCount++; return { id: 'order_dup_' + createCount, amount: params.amount, currency: params.currency, notes: {} }; },
    },
    payments: { fetch: async () => ({ id: 'pay_dup_1', order_id: 'order_dup_1', amount: 500000, currency: 'INR', status: 'captured', method: 'card' }), refund: async () => ({}) },
  });

  const booking = await createBookingOnly(ownerUser);
  const create1 = await paymentService.createOrder(booking._id.toString(), ownerUser._id.toString());
  assert.ok(create1.razorpayOrderId, 'first create returns an order id');
  assert.strictEqual(createCount, 1, 'first create calls Razorpay exactly once');

  // Call createOrder again on the same booking — should reuse existing, not hit
  // Razorpay orders.create again.
  const create2 = await paymentService.createOrder(booking._id.toString(), ownerUser._id.toString());
  assert.strictEqual(create2.razorpayOrderId, create1.razorpayOrderId, 'must reuse same order');
  assert.strictEqual(createCount, 1, 'orders.create NOT called again (reused)');

  // Only one Payment row exists for the booking.
  const rows = await Payment.find({ booking: booking._id });
  assert.strictEqual(rows.length, 1, 'one payment row, never duplicated');
});

test('DB-backed verify: another user cannot verify your payment (ownership enforced)', { skip: !HAS_DB && 'TEST_MONGODB_URI not set' }, async () => {
  process.env.RAZORPAY_KEY_SECRET = 'sk_test_unauth';
  const { booking, oid } = await createBookingWithPayment(ownerUser);
  paymentService._setRazorpayClientForTest(fakeRzpClient(null, oid));

  const sig = sign(oid + '|' + oid + '_pay', 'sk_test_unauth');
  await assert.rejects(
    () => paymentService.verifyPayment({ razorpay_order_id: oid, razorpay_payment_id: oid + '_pay', razorpay_signature: sig }, otherUser._id),
    /not authorized|not your|owner/i,
  );
  const after = await Payment.findOne({ booking: booking._id });
  assert.strictEqual(after.status, 'created');
});

test('DB-backed verify: duplicate verify is idempotent — no double-email marker', { skip: !HAS_DB && 'TEST_MONGODB_URI not set' }, async () => {
  process.env.RAZORPAY_KEY_SECRET = 'sk_test_idemp';
  const { booking, oid } = await createBookingWithPayment(ownerUser);
  paymentService._setRazorpayClientForTest(fakeRzpClient(null, oid));
  const sig = sign(oid + '|' + oid + '_pay', 'sk_test_idemp');

  const first = await paymentService.verifyPayment({ razorpay_order_id: oid, razorpay_payment_id: oid + '_pay', razorpay_signature: sig }, ownerUser._id);
  assert.strictEqual(first.createdMark, true);

  const second = await paymentService.verifyPayment({ razorpay_order_id: oid, razorpay_payment_id: oid + '_pay', razorpay_signature: sig }, ownerUser._id);
  assert.strictEqual(second.createdMark, false, 'repeat must not re-mark');

  const payments = await Payment.find({ booking: booking._id });
  assert.strictEqual(payments.length, 1, 'exactly one payment row');
  assert.strictEqual(payments[0].status, 'paid');
});
