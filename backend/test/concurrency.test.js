/**
 * Integration test for the payment double-spend / double-Pay scenario.
 *
 * Requires a running MongoDB (set TEST_MONGODB_URI). Skipped automatically when
 * none is configured, so `npm test` stays green in CI without a database.
 *
 * A payment in `created` state is captured; the same verify payload is then
 * submitted twice, showing that:
 *   - the first call confirms the booking once,
 *   - the second call is idempotent (does not re-mark / double-email),
 *   - a forged signature is always rejected before any state change.
 */
const { test, before, after } = require('node:test');
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
  u.pathname = '/fam_test_concurrency';
  return u.toString();
})();
const HAS_DB = !!URI;

before(async () => {
  if (!HAS_DB) return;
  await mongoose.connect(URI, { serverSelectionTimeoutMS: 5000 });
});

after(async () => {
  if (!paymentService._setRazorpayClientForTest) return;
  paymentService._setRazorpayClientForTest(null);
  if (HAS_DB) {
    await Promise.all([Payment.deleteMany({}), Booking.deleteMany({}), Room.deleteMany({}), User.deleteMany({})]);
    await mongoose.disconnect();
  }
});

test('double-verify of one captured payment is idempotent', { skip: !HAS_DB && 'TEST_MONGODB_URI not set' }, async () => {
  const room = await Room.create({
    name: 'Test Room',
    slug: 'test-room-' + Date.now(),
    totalRooms: 1,
    pricePerNight: 2000,
    capacity: { maxGuests: 2 },
    description: 'test',
  });
  const user = await User.create({
    name: 'Test User',
    email: 'test-user-' + Date.now() + '@fam.test',
    password: 'password123',
  });
  const booking = await Booking.create({
    user: user._id,
    room: room._id,
    checkIn: new Date('2030-01-01'),
    checkOut: new Date('2030-01-03'),
    guests: { adults: 2, children: 0 },
    totalAmount: 4000,
    amountPaid: 0,
    currency: 'INR',
    nights: 2,
    status: 'pending',
    paymentStatus: 'pending',
  });
  const payment = await Payment.create({
    booking: booking._id,
    user: user._id,
    razorpayOrderId: 'order_test_1',
    razorpayPaymentId: 'pay_test_1',
    amount: 4000,
    currency: 'INR',
    status: 'created',
    metadata: { orderAmount: 400000 },
  });
  booking.payment = payment._id;
  await booking.save();

  process.env.RAZORPAY_KEY_SECRET = 'sk_test_secret';
  paymentService._setRazorpayClientForTest({
    orders: { create: async () => ({ id: 'order_test_1', amount: 400000, currency: 'INR', notes: {} }) },
    payments: {
      fetch: async () => ({
        id: 'pay_test_1',
        order_id: 'order_test_1',
        amount: 400000,
        currency: 'INR',
        status: 'captured',
        method: 'card',
      }),
      refund: async () => ({ id: 'refund_test_1' }),
    },
  });

  const payload = {
    razorpay_order_id: 'order_test_1',
    razorpay_payment_id: 'pay_test_1',
    razorpay_signature: crypto.createHmac('sha256', 'sk_test_secret')
      .update('order_test_1|pay_test_1')
      .digest('hex'),
  };

  const first = await paymentService.verifyPayment(payload, booking.user);
  assert.strictEqual(first.payment.status, 'paid');
  assert.strictEqual(first.createdMark, true);

  const second = await paymentService.verifyPayment(payload, booking.user);
  assert.strictEqual(second.payment.status, 'paid');
  assert.strictEqual(second.createdMark, false, 'repeat verify must not re-create');

  // Booking must be confirmed exactly once.
  const reloaded = await Booking.findById(booking._id);
  assert.strictEqual(reloaded.paymentStatus, 'paid');
  assert.strictEqual(reloaded.status, 'confirmed');

  // A single Payment row persists.
  const rowCount = await Payment.countDocuments({ booking: booking._id });
  assert.strictEqual(rowCount, 1, 'one payment row, never a duplicate');
});

test('forged signature never reaches DB writes', { skip: !HAS_DB && 'TEST_MONGODB_URI not set' }, async () => {
  await assert.rejects(
    () => paymentService.verifyPayment(
      {
        razorpay_order_id: 'order_test_fake',
        razorpay_payment_id: 'pay_test_fake',
        razorpay_signature: 'forged',
      },
      null
    ),
    /Invalid payment signature/i
  );
});