const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const { authenticate, authorizeAdmin } = require('../middleware/auth');
const validate = require('../middleware/validate');
const rateLimit = require('express-rate-limit');
const {
  createPaymentOrderSchema,
  verifyPaymentSchema,
  refundSchema,
} = require('../validations/paymentValidation');

// Verify is a sensitive, signed endpoint that creates/updates financial state.
// Tight limit; the webhook (separate, verified by signature) handles retries so
// we do NOT throttle it — Razorpay retries must never be blocked.
const verifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many verification attempts, please try again later.',
  },
});

const createOrderLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many order requests, please try again later.',
  },
});

// Guest/public booking flow — no customer authentication required. The create
// order & verify endpoints rely on the secure Razorpay order/payment
// relationship and HMAC signature verification in paymentService, NOT on a
// customer account or JWT.
router.post('/create-order', createOrderLimiter, validate(createPaymentOrderSchema), paymentController.createOrder);
router.post('/verify', verifyLimiter, validate(verifyPaymentSchema), paymentController.verifyPayment);
// Webhook intentionally has NO auth middleware and NO rate limit — it is
// authenticated by the Razorpay signature over the raw body (see service).
router.post('/webhook', paymentController.webhook);
// Admin-only refund. Ownership/authorization enforced via authenticate + authorizeAdmin.
router.post('/:bookingId/refund', authenticate, authorizeAdmin, validate(refundSchema), paymentController.refund);
// Payment details are admin-only now that customers have no accounts.
router.get('/:id', authenticate, authorizeAdmin, paymentController.getPaymentDetails);

module.exports = router;
