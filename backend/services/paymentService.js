const crypto = require('crypto');
const getRazorpay = require('../config/razorpay');
const Payment = require('../models/Payment');
const Booking = require('../models/Booking');
const ApiError = require('../utils/ApiError');
const {
  canTransition,
  canBookingPaymentTransition,
} = require('./paymentStateMachine');

/**
 * Timing-safe string comparison (prevents signature-timing side channels).
 */
function safeEqual(a, b) {
  const aBuf = Buffer.from(String(a));
  const bBuf = Buffer.from(String(b));
  if (aBuf.length !== bBuf.length) return false;
  return crypto.timingSafeEqual(aBuf, bBuf);
}

/**
 * Verify a Razorpay signature over "orderId|paymentId" using the key secret
 * (used by the browser /verify path).
 */
function verifyWebhookOrPaymentSignature({ orderId, paymentId, signature, secret }) {
  const body = `${orderId}|${paymentId}`;
  const expected = crypto.createHmac('sha256', secret).update(body).digest('hex');
  return safeEqual(expected, signature);
}

/**
 * Verify a webhook signature over the RAW body using the webhook secret.
 */
function verifyWebhookSignature({ rawBody, signature, secret }) {
  if (!Buffer.isBuffer(rawBody) && typeof rawBody !== 'string') return false;
  const body = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(rawBody, 'utf8');
  const expected = crypto.createHmac('sha256', secret).update(body).digest('hex');
  return safeEqual(expected, signature);
}

class PaymentService {
  // Test seam: lets the test suite inject a fake Razorpay client without
  // touching the real config module. Never used in production.
  _setRazorpayClientForTest(client) {
    this._clientOverride = client;
  }

  _client() {
    return this._clientOverride || getRazorpay();
  }

  /**
   * Create a Razorpay order for a booking. Idempotent: if a live order already
   * exists for this booking (created/attempted), reuse it instead of minting a
   * new one, so repeated Pay attempts never stack multiple Payment rows.
   *
   * `userId` is optional (guest bookings have no account). Ownership is enforced
   * through the booking <-> payment <-> Razorpay order relationship rather than
   * a customer JWT: when a booking is tied to a user, only that user may open an
   * order for it; guest bookings have `booking.user === null` and are addressed
   * via their payment/order ids which are never exposed insecurely.
   */
  async createOrder(bookingId, userId) {
    const booking = await Booking.findById(bookingId).populate('room');
    if (!booking) {
      throw ApiError.notFound('Booking not found');
    }
    // When the booking is linked to a user, only that user may create the order.
    // Guest bookings (booking.user === null) need no account — their security
    // rests on the booking/payment/order id relationship + Razorpay reconciliation
    // in verifyPayment, plus the payable-state check below.
    if (booking.user) {
      if (!userId || booking.user.toString() !== userId.toString()) {
        throw ApiError.forbidden('Not authorized for this booking');
      }
    }
    if (booking.paymentStatus === 'paid' || booking.paymentStatus === 'refunded') {
      throw ApiError.badRequest('Booking payment is already completed');
    }

    // Idempotency: reuse an existing non-terminal payment/order for this booking.
    if (booking.payment) {
      const existing = await Payment.findById(booking.payment);
      if (existing && !['paid', 'refunded'].includes(existing.status)) {
        if (existing.razorpayOrderId) {
          return this._presentOrder(booking, existing, existing.razorpayOrderId);
        }
      }
      if (existing && ['paid', 'refunded'].includes(existing.status)) {
        throw ApiError.badRequest('Booking payment is already completed');
      }
    }

    // Check for any other non-terminal payment rows for this booking and reuse
    // the order id from the most recent one.
    const anyLive = await Payment.findOne({
      booking: booking._id,
      status: { $in: ['created', 'attempted'] },
    }).sort({ createdAt: -1 });
    if (anyLive && anyLive.razorpayOrderId) {
      booking.payment = anyLive._id;
      await booking.save();
      return this._presentOrder(booking, anyLive, anyLive.razorpayOrderId);
    }

    const amountInPaise = Math.round(booking.totalAmount * 100);
    const options = {
      amount: amountInPaise,
      currency: booking.currency || 'INR',
      receipt: `booking_${booking._id}`,
      notes: {
        bookingId: booking._id.toString(),
        userId: userId ? userId.toString() : '',
      },
    };

    const order = await this._client().orders.create(options);

    const payment = await Payment.create({
      booking: booking._id,
      ...(userId ? { user: userId } : {}),
      razorpayOrderId: order.id,
      amount: booking.totalAmount,
      currency: booking.currency || 'INR',
      status: 'created',
      metadata: {
        bookingRef: booking._id.toString(),
        orderAmount: order.amount,
        orderCurrency: order.currency,
      },
    });

    booking.payment = payment._id;
    await booking.save();

    return this._presentOrder(booking, payment, order.id);
  }

  _presentOrder(booking, payment, orderId) {
    return {
      orderId,
      razorpayOrderId: orderId,
      amount: payment.metadata && payment.metadata.orderAmount
        ? payment.metadata.orderAmount
        : Math.round((payment.amount || booking.totalAmount) * 100),
      currency: payment.currency || booking.currency || 'INR',
      keyId: process.env.RAZORPAY_KEY_ID,
      notes: {
        bookingId: booking._id.toString(),
        userId: booking.user ? booking.user.toString() : '',
      },
      prefill: {
        contact: booking.guestPhone || '',
        email: booking.guestEmail || '',
      },
    };
  }

  /**
   * Core payment confirmation. Used by the (now guest-public) /verify endpoint.
   * Steps:
   *   1. timing-safe signature check,
   *   2. look up our payment by order id,
   *   3. ask Razorpay for the authoritative payment record and reconcile
   *      status, amount and currency,
   *   4. atomically move state (no duplicate paid emails).
   *
   * `userId` is optional (guests). When present and the payment is tied to a
   * user, the caller must match; otherwise ownership is proven by the Razorpay
   * HMAC signature + order/payment/amount/currency reconciliation below.
   */
  async verifyPayment(payload, userId) {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = payload;

    if (!verifyWebhookOrPaymentSignature({
      orderId: razorpay_order_id,
      paymentId: razorpay_payment_id,
      signature: razorpay_signature,
      secret: process.env.RAZORPAY_KEY_SECRET,
    })) {
      throw ApiError.badRequest('Invalid payment signature');
    }

    const payment = await Payment.findOne({ razorpayOrderId: razorpay_order_id });
    if (!payment) {
      throw ApiError.notFound('Payment not found');
    }
    if (userId && payment.user && payment.user.toString() !== userId.toString()) {
      throw ApiError.forbidden('Not authorized for this payment');
    }

    const booking = await Booking.findById(payment.booking);

    // Reconcile with the authoritative Razorpay payment record.
    const rzpPayment = await this._client().payments.fetch(razorpay_payment_id);
    const expectedAmount = payment.metadata
      ? (payment.metadata.orderAmount || Math.round(payment.amount * 100))
      : Math.round(payment.amount * 100);
    const expectedCurrency = payment.currency || 'INR';

    const amountMatches = rzpPayment.amount === expectedAmount;
    const currencyMatches = String(rzpPayment.currency).toUpperCase() === String(expectedCurrency).toUpperCase();
    const statusCaptured = ['captured', 'authorized'].includes(rzpPayment.status);
    const belongsToOrder = rzpPayment.order_id === razorpay_order_id;

    if (!belongsToOrder) {
      throw ApiError.badRequest('Payment does not belong to this order');
    }
    if (!amountMatches || !currencyMatches) {
      console.error(
        `[Payment] Amount/currency mismatch for ${razorpay_payment_id}: ` +
        `expected ${expectedAmount} ${expectedCurrency}, got ${rzpPayment.amount} ${rzpPayment.currency}`
      );
      throw ApiError.badRequest('Payment amount mismatch — contact support');
    }
    if (!statusCaptured) {
      throw ApiError.badRequest(`Payment is not captured (status: ${rzpPayment.status})`);
    }

    payment.razorpayPaymentId = razorpay_payment_id;
    payment.razorpaySignature = razorpay_signature;
    payment.paymentMethod = rzpPayment.method || payment.paymentMethod;

    // Idempotent state move: if already paid, just return without re-emailing.
    const wasPaid = payment.status === 'paid';
    if (!wasPaid && !canTransition(payment.status, 'paid')) {
      throw ApiError.conflict(`Cannot mark payment as paid from ${payment.status}`);
    }
    if (!wasPaid) {
      payment.status = 'paid';
      payment.paidAt = new Date();
    }
    await payment.save();

    if (booking) {
      const wasBookingPaid = booking.paymentStatus === 'paid' || booking.paymentStatus === 'refunded';
      if (!wasBookingPaid) {
        if (!canBookingPaymentTransition(booking.paymentStatus, 'paid')) {
          throw ApiError.conflict(`Cannot mark booking payment as paid from ${booking.paymentStatus}`);
        }
        booking.paymentStatus = 'paid';
        booking.amountPaid = payment.amount;
        if (booking.status === 'pending' || booking.status === 'draft' || booking.status === 'expired') {
          booking.status = 'confirmed';
        }
        booking.confirmedAt = booking.confirmedAt || new Date();
        await booking.save();
      }
    }

    return { payment, booking, createdMark: !wasPaid };
  }

  /**
   * Webhook entry point. Signature is verified over the raw body with the
   * dedicated webhook secret. Events are de-duplicated by a stable composite
   * key (event + entity id + entity created_at timestamp), since Razorpay does
   * not send a per-event UUID that is stable across all event types.
   */
  async handleWebhook({ rawBody, signature, event, payload }) {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (!secret) {
      // No webhook secret configured — refuse rather than silently diverge.
      throw ApiError.forbidden('Webhook secret not configured');
    }
    if (!verifyWebhookSignature({ rawBody, signature, secret })) {
      throw ApiError.badRequest('Invalid webhook signature');
    }

    const paymentEntity = payload && (payload.payment || {}).entity;
    const orderEntity = (payload && payload.order && payload.order.entity) || {};
    const refundEntity = (payload && payload.refund && payload.refund.entity) || {};
    const razorpayPaymentId =
      (paymentEntity && paymentEntity.id) ||
      // Refund events carry payment_id on the refund entity (defensive fallback).
      (refundEntity && refundEntity.payment_id) ||
      null;
    const razorpayOrderId = razorpayPaymentId
      ? (paymentEntity && paymentEntity.order_id) || (orderEntity && orderEntity.id) || (refundEntity && refundEntity.order_id) || null
      : (orderEntity && orderEntity.id) || null;

    // Stable de-dup key: event + entity id + creation epoch (seconds).
    const entityStamp = (paymentEntity && paymentEntity.created_at) || (orderEntity && orderEntity.created_at) || null;
    const eventId = [event, razorpayPaymentId || razorpayOrderId, entityStamp].filter(Boolean).join(':');

    if (!razorpayOrderId && !razorpayPaymentId) {
      console.warn('[Webhook] event has no order/payment id, ignoring:', event);
      return { ignored: true };
    }

    let payment = razorpayOrderId
      ? await Payment.findOne({ razorpayOrderId })
      : null;
    if (!payment && razorpayPaymentId) {
      payment = await Payment.findOne({ razorpayPaymentId });
    }
    if (!payment) {
      // Order may lag the payment capture; if we cannot map it, ignore and let
      // the /verify path (or a later event) reconcile.
      console.warn(`[Webhook] no local payment for event ${event} (order=${razorpayOrderId}, pay=${razorpayPaymentId})`);
      return { ignored: true };
    }

    // Record the event for idempotency and guard out-of-order events.
    const now = new Date();
    if (eventId && !payment.webhookEvents.some((e) => e.eventId === eventId)) {
      payment.webhookEvents.push({ eventId, event, receivedAt: now });
    }
    payment.lastWebhookEventId = eventId || null;
    payment.lastWebhookEventAt = now;

    const booking = await Booking.findById(payment.booking);

    if (event === 'payment.captured' || event === 'order.paid') {
      if (canTransition(payment.status, 'paid')) {
        payment.status = 'paid';
        payment.paidAt = payment.paidAt || now;
        if (razorpayPaymentId && !payment.razorpayPaymentId) payment.razorpayPaymentId = razorpayPaymentId;
        await payment.save();
        return this._markBookingPaid(payment, booking);
      }
      await payment.save();
      return { alreadyProcessed: true };
    }

    if (event === 'payment.failed') {
      if (canTransition(payment.status, 'failed')) {
        payment.status = 'failed';
        payment.failedAt = now;
        payment.failureReason = (paymentEntity && paymentEntity.error_description) || 'Payment failed';
        await payment.save();
        return { updated: true };
      }
      await payment.save();
      return { alreadyProcessed: true };
    }

    if (event === 'refund.processed' || event === 'refund.created') {
      if (canTransition(payment.status, 'refunded')) {
        const refund = (payload && payload.refund && payload.refund.entity) || {};
        payment.status = 'refunded';
        payment.refundedAt = now;
        payment.refundId = refund.id || payment.refundId;
        payment.refundAmount = refund.amount ? refund.amount / 100 : payment.refundAmount;
        payment.metadata = payment.metadata || {};
        payment.metadata.refundStatus = refund.status;
        await payment.save();

        if (booking && canBookingPaymentTransition(booking.paymentStatus, 'refunded')) {
          booking.paymentStatus = 'refunded';
          booking.status = 'cancelled'; // refunded is a paymentStatus, status uses cancelled
          booking.cancelledAt = booking.cancelledAt || now;
          booking.refundedAt = now;
          await booking.save();
        }
        return { updated: true };
      }
      await payment.save();
      return { alreadyProcessed: true };
    }

    await payment.save();
    return { unhandled: true };
  }

  async _markBookingPaid(payment, booking) {
    if (!booking) return { updated: false };
    if (booking.paymentStatus === 'paid' || booking.paymentStatus === 'refunded') {
      return { alreadyProcessed: true };
    }
    if (!canBookingPaymentTransition(booking.paymentStatus, 'paid')) {
      console.warn(`[Webhook] cannot mark booking ${booking._id} paid from ${booking.paymentStatus}`);
      return { skipped: true };
    }
    booking.paymentStatus = 'paid';
    booking.amountPaid = payment.amount;
    if (booking.status === 'pending' || booking.status === 'draft' || booking.status === 'expired') {
      booking.status = 'confirmed';
    }
    booking.confirmedAt = booking.confirmedAt || new Date();
    await booking.save();
    return { updated: true };
  }

  /**
   * Process a refund for a paid booking and its Razorpay payment.
   */
  async processRefund(bookingId, amount = null, requestedBy = null, reason = 'Booking cancelled') {
    const booking = await Booking.findById(bookingId);
    if (!booking) {
      throw ApiError.notFound('Booking not found');
    }
    if (booking.paymentStatus !== 'paid') {
      throw ApiError.badRequest('Payment not completed for this booking');
    }

    const payment = await Payment.findById(booking.payment);
    if (!payment || !payment.razorpayPaymentId) {
      throw ApiError.notFound('Payment record not found');
    }

    const refundAmount = amount || payment.amount;
    const refundAmountPaise = Math.round(refundAmount * 100);

    const refund = await this._client().payments.refund(payment.razorpayPaymentId, {
      amount: refundAmountPaise,
      notes: {
        bookingId: booking._id.toString(),
        reason,
      },
    });

    if (canTransition(payment.status, 'refunded')) {
      payment.status = 'refunded';
      payment.refundId = refund.id;
      payment.refundAmount = refundAmount;
      payment.refundedAt = new Date();
      await payment.save();
    }

    if (canBookingPaymentTransition(booking.paymentStatus, 'refunded')) {
      booking.paymentStatus = 'refunded';
      booking.status = 'cancelled'; // refunded is a paymentStatus, status uses cancelled
      booking.cancellationReason = reason;
      booking.cancelledAt = new Date();
      booking.refundedAt = new Date();
      await booking.save();
    }

    // Release the dates back to inventory since the booking is no longer active.
    const { releaseBookingDates, unMirrorBookedDates } = require('./availabilityService');
    await Promise.all([
      releaseBookingDates(booking.room, booking._id).catch(() => {}),
      unMirrorBookedDates(booking.room, booking.checkIn, booking.checkOut, booking._id).catch(() => {}),
    ]);

    return { refund, payment, booking, requestedBy };
  }
}

module.exports = new PaymentService();
