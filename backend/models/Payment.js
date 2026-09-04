const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema(
  {
    booking: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Booking',
      required: [true, 'Booking is required'],
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      // nullable for guest bookings (no customer account). Admin-only refunds and
      // the webhook reconcile by booking/order ids regardless.
    },
    razorpayOrderId: {
      type: String,
      default: null,
    },
    razorpayPaymentId: {
      type: String,
      default: null,
    },
    razorpaySignature: {
      type: String,
      default: null,
    },
    amount: {
      type: Number,
      required: [true, 'Amount is required'],
      min: [0, 'Amount must be a positive number'],
    },
    currency: {
      type: String,
      default: 'INR',
    },
    status: {
      type: String,
      enum: ['created', 'attempted', 'paid', 'failed', 'refunded'],
      default: 'created',
    },
    paymentMethod: {
      type: String,
      default: '',
    },
    refundId: {
      type: String,
      default: null,
    },
    refundAmount: {
      type: Number,
      default: 0,
    },
    // Lifecycle timestamps (not managed by `timestamps` which only sets
    // createdAt/updatedAt) so the state machine has explicit audit points.
    paidAt: {
      type: Date,
      default: null,
    },
    failedAt: {
      type: Date,
      default: null,
    },
    refundedAt: {
      type: Date,
      default: null,
    },
    failureReason: {
      type: String,
      default: '',
    },
    // Webhook de-duplication bookkeeping.
    lastWebhookEventId: {
      type: String,
      default: null,
    },
    lastWebhookEventAt: {
      type: Date,
      default: null,
    },
    webhookEvents: [
      {
        eventId: {
          type: String,
          unique: true,
          sparse: true,
        },
        event: String,
        receivedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

paymentSchema.index({ booking: 1 });
paymentSchema.index({ user: 1 });
paymentSchema.index({ razorpayOrderId: 1 });
paymentSchema.index({ razorpayPaymentId: 1 });
paymentSchema.index({ status: 1 });

// Application-level idempotency is enforced in paymentService (the sparse
// unique index on razorpayOrderId is created by the safe migration script in
// scripts/ensurePaymentIndexes.js after an explicit duplicate check, so we
// never trigger a destructive index build against existing production data).

module.exports = mongoose.model('Payment', paymentSchema);
