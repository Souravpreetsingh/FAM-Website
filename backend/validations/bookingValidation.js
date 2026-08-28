const { z } = require('zod');

const createBookingSchema = z.object({
  body: z.object({
    room: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid room ID'),
    checkIn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid check-in date format (YYYY-MM-DD)'),
    checkOut: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid check-out date format (YYYY-MM-DD)'),
    guests: z.object({
      adults: z.number().int().positive().min(1),
      children: z.number().int().min(0).optional().default(0),
    }),
    guestName: z.string().trim().min(2).max(150).optional(),
    guestEmail: z.string().trim().email().optional().nullable().default(null),
    guestPhone: z.string().trim().max(20).optional().default('').refine((v) => v === '' || v.length >= 7, 'Guest phone must be at least 7 characters if provided'),
    specialRequests: z.string().max(500).optional().default(''),
  }),
});

const updateBookingSchema = z.object({
  body: z.object({
    checkIn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    checkOut: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    guests: z
      .object({
        adults: z.number().int().positive().optional(),
        children: z.number().int().min(0).optional(),
      })
      .optional(),
    specialRequests: z.string().max(500).optional(),
  }),
  params: z.object({
    id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid booking ID'),
  }),
});

const cancelBookingSchema = z.object({
  body: z.object({
    reason: z.string().max(500).optional().default(''),
  }),
  params: z.object({
    id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid booking ID'),
  }),
});

module.exports = {
  createBookingSchema,
  updateBookingSchema,
  cancelBookingSchema,
};
