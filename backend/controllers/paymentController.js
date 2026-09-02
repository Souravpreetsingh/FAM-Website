const paymentService = require('../services/paymentService');
const ApiResponse = require('../utils/ApiResponse');
const asyncHandler = require('../utils/asyncHandler');
const emailService = require('../services/emailService');
const Booking = require('../models/Booking');

const createOrder = asyncHandler(async (req, res) => {
  const { bookingId } = req.validated?.body || req.body || {};
  const result = await paymentService.createOrder(bookingId, req.user._id);
  ApiResponse.success(result, 'Order created successfully').send(res);
});

const verifyPayment = asyncHandler(async (req, res) => {
  const payload = req.validated?.body || req.body || {};
  const { payment, booking, createdMark } = await paymentService.verifyPayment(payload, req.user._id);

  const populatedBooking = await Booking.findById(booking._id)
    .populate('room')
    .populate('user', 'name email');

  // Send the confirmation email only once ever, guarded by an explicit marker so
  // neither a repeated /verify nor a racing webhook can double-email.
  if (createdMark && populatedBooking.user && !populatedBooking.confirmationEmailSentAt) {
    await emailService.sendBookingConfirmation(populatedBooking, populatedBooking.user, populatedBooking.room);
    populatedBooking.confirmationEmailSentAt = new Date();
    await populatedBooking.save();
  }

  ApiResponse.success({ payment, booking: populatedBooking }, 'Payment verified successfully').send(res);
});

const webhook = asyncHandler(async (req, res) => {
  const signature = req.get('X-Razorpay-Signature') || '';
  const rawBody = req.rawBody || (req.body && JSON.stringify(req.body)) || '';
  const event = req.body && req.body.event;
  const payload = req.body ? req.body.payload : null;

  const result = await paymentService.handleWebhook({
    rawBody,
    signature,
    event,
    payload,
  });

  // When the webhook just moved a booking to paid, send the (idempotent)
  // confirmation email if it has never been sent — e.g. the user never finished
  // the browser /verify handshake.
  if (result && result.updated && event === 'payment.captured') {
    const payment = req.body && req.body.payload && req.body.payload.payment && req.body.payload.payment.entity;
    const orderId = payment && (payment.order_id || null);
    if (orderId) {
      const Payment = require('../models/Payment');
      const local = await Payment.findOne({ razorpayOrderId: orderId });
      if (local) {
        const booking = await Booking.findById(local.booking)
          .populate('room')
          .populate('user', 'name email');
        if (booking && booking.user && !booking.confirmationEmailSentAt) {
          await emailService.sendBookingConfirmation(booking, booking.user, booking.room);
          booking.confirmationEmailSentAt = new Date();
          await booking.save();
        }
      }
    }
  }

  // Always ACK 200 to Razorpay so it stops retrying; divergence is reconciled
  // by /verify and the reconciliation job.
  res.status(200).json({ success: true, ...result });
});

const getPaymentDetails = asyncHandler(async (req, res) => {
  const Payment = require('../models/Payment');
  const payment = await Payment.findById(req.params.id)
    .populate('booking')
    .populate('user', 'name email');

  if (!payment) {
    throw ApiErrorNotFound();
  }
  if (
    payment.user._id.toString() !== req.user._id.toString() &&
    req.user.role !== 'admin'
  ) {
    throw ApiErrorForbidden();
  }

  // Never hand the signature/verification secret back to a client; it only
  // matters at the moment of verification and is useless afterwards.
  const sanitized = payment.toObject ? payment.toObject() : payment;
  if (sanitized && sanitized.razorpaySignature !== undefined) {
    delete sanitized.razorpaySignature;
  }
  if (sanitized && sanitized.webhookEvents !== undefined) {
    delete sanitized.webhookEvents;
  }

  ApiResponse.success({ payment: sanitized }).send(res);
});

// Admin-only refund for a paid booking. Initiates a Razorpay refund and moves
// the booking to refunded, releasing the dates back to inventory.
const refund = asyncHandler(async (req, res) => {
  const { bookingId } = req.params;
  const { amount, reason } = req.validated?.body || req.body || {};
  const result = await paymentService.processRefund(
    bookingId,
    amount,
    req.user,
    reason || 'Booking cancelled'
  );
  ApiResponse.success({ payment: result.payment, booking: result.booking, refund: result.refund }, 'Refund processed successfully').send(res);
});

function ApiErrorNotFound() {
  const ApiError = require('../utils/ApiError');
  return ApiError.notFound('Payment not found');
}
function ApiErrorForbidden() {
  const ApiError = require('../utils/ApiError');
  return ApiError.forbidden('Not authorized');
}

module.exports = {
  createOrder,
  verifyPayment,
  webhook,
  refund,
  getPaymentDetails,
};
