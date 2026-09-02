const cron = require('node-cron');
const Booking = require('../models/Booking');
const Payment = require('../models/Payment');
const Newsletter = require('../models/Newsletter');
const {
  releaseBookingDates,
  unMirrorBookedDates,
  ACTIVE_BOOKING_STATUSES,
} = require('../services/availabilityService');

function minutesFromNow(minutes) {
  return new Date(Date.now() - minutes * 60 * 1000);
}

/**
 * Expire unpaid pending bookings that linger past the configurable TTL so they
 * never hold inventory forever. Releases the atomic ledger rows and the legacy
 * mirror. Deliberately avoids touching confirmed/paid bookings.
 */
async function expireStalePendingBookings() {
  const ttlMinutes = parseInt(process.env.PENDING_BOOKING_TTL_MINUTES || '1440', 10);
  const cutoff = minutesFromNow(ttlMinutes);

  const stale = await Booking.find({
    status: 'pending',
    paymentStatus: { $in: ['pending', 'failed', null] },
    createdAt: { $lt: cutoff },
  }).select('room checkIn checkOut paymentStatus status statusHistory expiredAt');

  let expired = 0;
  for (const booking of stale) {
    try {
      const livePayments = await Payment.countDocuments({
        booking: booking._id,
        status: { $in: ['created', 'attempted', 'paid'] },
      });
      if (livePayments > 0) continue; // a paid/live order exists — do not expire

      await releaseBookingDates(booking.room, booking._id);
      await unMirrorBookedDates(booking.room, booking.checkIn, booking.checkOut, booking._id);

      booking.status = 'expired';
      booking.expiredAt = new Date();
      booking.statusHistory.push({
        status: 'expired',
        changedAt: new Date(),
        changedBy: 'system',
        note: 'Unpaid pending reservation expired',
      });
      await booking.save();
      expired++;
    } catch (error) {
      console.error(`[Cron] Expire booking ${booking._id} error:`, error.message);
    }
  }

  if (stale.length) {
    console.log(`[Cron] Expired ${expired} stale pending bookings (of ${stale.length} candidate)`);
  }
}

/**
 * Reconcile captured-or-failed Razorpay payments that never reached a terminal
 * state locally (e.g. process restarted mid-verify). Converges payment.status
 * and booking.paymentStatus to match Razorpay's authoritative record.
 */
async function reconcilePayments() {
  const nonTerminal = await Payment.find({
    status: { $in: ['created', 'attempted'] },
    razorpayPaymentId: { $ne: null },
  }).select('razorpayPaymentId razorpayOrderId status booking amount');
  // Only inspect payments created at least a few minutes ago so in-flight ones
  // aren't touched while a user is still in the checkout modal.
  const mature = nonTerminal.filter(
    (p) => p.createdAt && p.createdAt < minutesFromNow(5)
  );

  const getRazorpay = require('../config/razorpay');
  const { canTransition, canBookingPaymentTransition } = require('../services/paymentStateMachine');

  for (const payment of mature) {
    try {
      const rzp = await getRazorpay().payments.fetch(payment.razorpayPaymentId);
      let changed = false;
      if (['captured', 'authorized'].includes(rzp.status) && canTransition(payment.status, 'paid')) {
        payment.status = 'paid';
        payment.paidAt = new Date();
        payment.metadata = payment.metadata || {};
        payment.metadata.reconciledBy = 'job';
        changed = true;
        await payment.save();
        const booking = await Booking.findById(payment.booking);
        if (booking && canBookingPaymentTransition(booking.paymentStatus, 'paid')) {
          booking.paymentStatus = 'paid';
          booking.amountPaid = payment.amount;
          if (booking.status === 'pending') booking.status = 'confirmed';
          booking.confirmedAt = booking.confirmedAt || new Date();
          await booking.save();
        }
      } else if (rzp.status === 'failed' && canTransition(payment.status, 'failed')) {
        payment.status = 'failed';
        payment.failedAt = new Date();
        payment.metadata = payment.metadata || {};
        payment.metadata.reconciledBy = 'job';
        changed = true;
        await payment.save();
      }
      if (changed) {
        console.log(`[Cron] Reconciled payment ${payment._id} -> ${payment.status} (rzp ${rzp.status})`);
      }
    } catch (error) {
      if (error.statusCode && error.statusCode === 404) {
        // Payment id no longer valid upstream; leave for operator.
        console.warn(`[Cron] Razorpay payment ${payment.razorpayPaymentId} not found upstream`);
      } else {
        console.error(`[Cron] Reconcile payment ${payment._id} error:`, error.message);
      }
    }
  }
}

const startJobs = () => {
  cron.schedule('0 0 * * *', async () => {
    console.log('[Cron] Running daily cleanup jobs...');
    try {
      const result = await Booking.updateMany(
        {
          status: 'confirmed',
          checkOut: { $lt: new Date() },
        },
        { status: 'completed', completedAt: new Date() }
      );
      console.log(`[Cron] Completed ${result.modifiedCount} bookings`);
    } catch (error) {
      console.error('[Cron] Booking completion error:', error.message);
    }
  });

  // Pending unpaid bookings expire every 5 minutes (configurable TTL).
  cron.schedule('*/5 * * * *', async () => {
    try {
      await expireStalePendingBookings();
    } catch (error) {
      console.error('[Cron] Pending expiry error:', error.message);
    }
  });

  // Payment/booking state reconciliation every 10 minutes.
  cron.schedule('*/10 * * * *', async () => {
    try {
      await reconcilePayments();
    } catch (error) {
      console.error('[Cron] Payment reconciliation error:', error.message);
    }
  });

  cron.schedule('0 2 * * 0', async () => {
    console.log('[Cron] Running weekly newsletter cleanup...');
    try {
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

      const result = await Newsletter.deleteMany({
        isActive: false,
        unsubscribedAt: { $lt: sixMonthsAgo },
      });
      console.log(`[Cron] Cleaned up ${result.deletedCount} inactive subscribers`);
    } catch (error) {
      console.error('[Cron] Newsletter cleanup error:', error.message);
    }
  });

  console.log('[Cron] Background jobs initialized');
};

module.exports = { startJobs, expireStalePendingBookings, reconcilePayments };
