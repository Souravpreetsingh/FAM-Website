/**
 * DB-backed test for the pending-booking expiry job (Step 8).
 *
 * Verifies a stale unpaid pending booking:
 *   - is moved to status 'expired' with expiredAt set,
 *   - releases its availability ledger + mirror rows,
 *   - is idempotent (re-running does nothing bad),
 *   - never expires bookings that have a live/paid order.
 *
 * Requires TEST_MONGODB_URI.
 */
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const mongoose = require('mongoose');

const Booking = require('../models/Booking');
const Room = require('../models/Room');
const Payment = require('../models/Payment');
const AvailabilityBlock = require('../models/AvailabilityBlock');
const User = require('../models/User');
const { expireStalePendingBookings } = require('../jobs/index');

const URI = (() => {
  const base = process.env.TEST_MONGODB_URI;
  if (!base) return undefined;
  const u = new URL(base);
  u.pathname = '/fam_test_expiry';
  return u.toString();
})();
const HAS_DB = !!URI;

before(async () => {
  if (!HAS_DB) return;
  await mongoose.connect(URI, { serverSelectionTimeoutMS: 5000 });
});

after(async () => {
  if (HAS_DB) {
    await Promise.all([Booking.deleteMany({}), Room.deleteMany({}), AvailabilityBlock.deleteMany({}), Payment.deleteMany({}), User.deleteMany({})]);
    await mongoose.disconnect();
  }
});

test('expiry job expires stale pending booking and releases availability (idempotent)', { skip: !HAS_DB && 'TEST_MONGODB_URI not set' }, async () => {
  process.env.PENDING_BOOKING_TTL_MINUTES = '1440';

  const user = await User.create({ name: 'Expiry U', email: 'expiry-' + Date.now() + '@fam.test', password: 'password123' });
  const room = await Room.create({
    name: 'Expiry Room', slug: 'expiry-' + Date.now(), totalRooms: 2, pricePerNight: 3000,
    capacity: { maxGuests: 2 }, description: 'test',
  });

  // A stale pending booking created 3 days ago (older than the default 24h TTL).
  const stale = await Booking.create({
    user: user._id, room: room._id,
    checkIn: new Date(Date.now() + 30 * 86400000), checkOut: new Date(Date.now() + 32 * 86400000),
    guests: { adults: 2, children: 0 }, totalAmount: 6000, amountPaid: 0, currency: 'INR', nights: 2,
    status: 'pending', paymentStatus: 'pending', createdAt: new Date(Date.now() - 3 * 86400000),
  });
  // Simulate reserved availability rows that must be released.
  await AvailabilityBlock.create([
    { room: room._id, date: new Date(Date.now() + 30 * 86400000), kind: 'BOOKED', bookingId: stale._id },
    { room: room._id, date: new Date(Date.now() + 31 * 86400000), kind: 'BOOKED', bookingId: stale._id },
  ]);

  await expireStalePendingBookings();

  const expired = await Booking.findById(stale._id);
  assert.strictEqual(expired.status, 'expired');
  assert.ok(expired.expiredAt, 'expiredAt set');
  assert.strictEqual(expired.paymentStatus, 'pending', 'paymentStatus unchanged (no payment happened)');

  // Availability ledger released.
  const blocks = await AvailabilityBlock.find({ bookingId: stale._id });
  assert.strictEqual(blocks.length, 0, 'availability ledger released');

  // Re-run is idempotent — does not error and does not corrupt.
  await expireStalePendingBookings();
  const after2 = await Booking.findById(stale._id);
  assert.strictEqual(after2.status, 'expired');
});

test('expiry job skips bookings with a live/paid payment', { skip: !HAS_DB && 'TEST_MONGODB_URI not set' }, async () => {
  process.env.PENDING_BOOKING_TTL_MINUTES = '1440';

  const user = await User.create({ name: 'Skip U', email: 'skip-' + Date.now() + '@fam.test', password: 'password123' });
  const room = await Room.create({
    name: 'Skip Room', slug: 'skip-' + Date.now(), totalRooms: 2, pricePerNight: 3000,
    capacity: { maxGuests: 2 }, description: 'test',
  });

  const live = await Booking.create({
    user: user._id, room: room._id,
    checkIn: new Date(Date.now() + 40 * 86400000), checkOut: new Date(Date.now() + 42 * 86400000),
    guests: { adults: 2, children: 0 }, totalAmount: 6000, amountPaid: 0, currency: 'INR', nights: 2,
    status: 'pending', paymentStatus: 'pending', createdAt: new Date(Date.now() - 3 * 86400000),
  });
  await Payment.create({ booking: live._id, user: user._id, razorpayOrderId: 'order_live_1', amount: 6000, currency: 'INR', status: 'created', metadata: {} });

  await expireStalePendingBookings();

  const after = await Booking.findById(live._id);
  assert.strictEqual(after.status, 'pending', 'booking with live order must NOT expire');
});