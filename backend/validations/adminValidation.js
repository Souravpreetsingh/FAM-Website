const { z } = require('zod');

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid ID');
const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)');

const adminLoginSchema = z.object({
  body: z.object({
    email: z.string().trim().email('Please provide a valid email'),
    password: z.string().min(1, 'Password is required'),
  }),
});

const createOfflineBookingSchema = z.object({
  body: z.object({
    room: objectId,
    checkIn: dateString,
    checkOut: dateString,
    guests: z.object({
      adults: z.number().int().positive().min(1),
      children: z.number().int().min(0).optional().default(0),
    }),
    guestName: z.string().trim().min(2, 'Guest name is required').max(150),
    guestEmail: z.string().trim().email().optional().nullable().default(null),
    guestPhone: z.string().trim().max(20).optional().default('').refine((v) => v === '' || v.length >= 7, 'Guest phone must be at least 7 characters if provided'),
    source: z.enum(['OFFLINE', 'PHONE', 'WALK-IN', 'ADMIN']).optional().default('OFFLINE'),
    notes: z.string().trim().max(2000).optional().default(''),
    amountPaid: z.number().finite().min(0).optional().default(0),
  }),
});

const updateReservationSchema = z.object({
  params: z.object({ id: objectId }),
  body: z
    .object({
      room: objectId.optional(),
      checkIn: dateString.optional(),
      checkOut: dateString.optional(),
      guests: z
        .object({
          adults: z.number().int().positive().optional(),
          children: z.number().int().min(0).optional(),
        })
        .optional(),
      guestName: z.string().trim().min(2).max(150).optional(),
      guestEmail: z.string().trim().email().nullable().optional(),
      guestPhone: z.string().trim().max(20).optional().refine((v) => v === undefined || v === '' || v.length >= 7, 'Guest phone must be at least 7 characters if provided'),
      status: z.enum(['pending', 'confirmed', 'checked_in', 'checked_out', 'cancelled', 'no_show']).optional(),
      paymentStatus: z.enum(['pending', 'paid', 'partial', 'refunded', 'failed']).optional(),
      amountPaid: z.number().finite().min(0).optional(),
      notes: z.string().trim().max(2000).optional(),
      specialRequests: z.string().trim().max(500).optional(),
    })
    .refine((b) => Object.keys(b).length > 0, 'At least one field to update is required'),
});

const updateUserRoleSchema = z.object({
  params: z.object({ id: objectId }),
  body: z.object({
    role: z.enum(['guest', 'admin'], 'Role must be guest or admin'),
  }),
});

const moveRoomSchema = z.object({
  params: z.object({ id: objectId }),
  body: z.object({
    newRoomId: objectId,
  }),
});

const createAvailabilityBlockSchema = z.object({
  body: z.object({
    roomId: objectId,
    startDate: dateString,
    endDate: dateString,
    reason: z.string().trim().max(500).optional().default(''),
    kind: z.enum(['BLOCKED', 'RESERVED', 'MAINTENANCE']).optional().default('BLOCKED'),
  }),
});

const clearAvailabilitySchema = z.object({
  body: z.object({
    roomId: objectId,
    startDate: dateString,
    endDate: dateString,
  }),
});

const blockParamsSchema = z.object({
  params: z.object({
    id: objectId,
  }),
});

const removeBlockParamsSchema = z.object({
  params: z.object({
    blockId: objectId,
  }),
});

module.exports = {
  adminLoginSchema,
  createOfflineBookingSchema,
  updateReservationSchema,
  updateUserRoleSchema,
  moveRoomSchema,
  createAvailabilityBlockSchema,
  blockParamsSchema,
  removeBlockParamsSchema,
  clearAvailabilitySchema,
};