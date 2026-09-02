const { z } = require('zod');

const createPaymentOrderSchema = z.object({
  body: z.object({
    bookingId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid booking ID'),
  }),
});

const verifyPaymentSchema = z.object({
  body: z.object({
    razorpay_order_id: z.string().min(3).max(100),
    razorpay_payment_id: z.string().min(3).max(100),
    razorpay_signature: z.string().min(10).max(200),
  }),
});

const refundSchema = z.object({
  params: z.object({
    bookingId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid booking ID'),
  }),
  body: z.object({
    amount: z.number().positive().optional(),
    reason: z.string().trim().max(300).optional().default('Booking cancelled'),
  }),
});

module.exports = {
  createPaymentOrderSchema,
  verifyPaymentSchema,
  refundSchema,
};
