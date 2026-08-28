const { z } = require('zod');

const createRoomSchema = z.object({
  body: z.object({
    name: z
      .string()
      .trim()
      .min(2, 'Room name must be at least 2 characters')
      .max(100, 'Room name cannot exceed 100 characters'),
    description: z
      .string()
      .trim()
      .min(10, 'Description must be at least 10 characters')
      .max(2000, 'Description cannot exceed 2000 characters'),
    shortDescription: z.string().trim().max(300).optional().default(''),
    pricePerNight: z.number().positive('Price must be a positive number'),
    discountPrice: z.number().positive().optional().nullable().default(null),
    currency: z.enum(['INR', 'USD']).optional().default('INR'),
    capacity: z.object({
      adults: z.number().int().positive().optional().default(2),
      children: z.number().int().min(0).optional().default(0),
      maxGuests: z.number().int().positive(),
    }),
    size: z.number().positive().optional().default(0),
    unit: z.string().optional().default('sq ft'),
    bedType: z.string().optional().default('King'),
    type: z
      .enum(['Standard', 'Deluxe', 'Suite', 'Luxury', 'Villa', 'Other'])
      .optional()
      .default('Standard'),
    weekendPrice: z.number().positive().nullable().optional().default(null),
    seasonalPrice: z.number().positive().nullable().optional().default(null),
    amenities: z.array(z.string()).optional().default([]),
    isAvailable: z.boolean().optional().default(true),
    isFeatured: z.boolean().optional().default(false),
    totalRooms: z.number().int().positive().optional().default(1),
    cancellationPolicy: z.string().optional(),
    checkInTime: z.string().optional().default('14:00'),
    checkOutTime: z.string().optional().default('11:00'),
  }),
});

const updateRoomSchema = z.object({
  body: z.object({
    name: z
      .string()
      .trim()
      .min(2)
      .max(100)
      .optional(),
    description: z.string().trim().min(10).max(2000).optional(),
    shortDescription: z.string().trim().max(300).optional(),
    pricePerNight: z.number().positive().optional(),
    discountPrice: z.number().positive().nullable().optional(),
    currency: z.enum(['INR', 'USD']).optional(),
    capacity: z
      .object({
        adults: z.number().int().positive().optional(),
        children: z.number().int().min(0).optional(),
        maxGuests: z.number().int().positive().optional(),
      })
      .optional(),
    size: z.number().positive().optional(),
    unit: z.string().optional(),
    bedType: z.string().optional(),
    type: z.enum(['Standard', 'Deluxe', 'Suite', 'Luxury', 'Villa', 'Other']).optional(),
    weekendPrice: z.number().positive().nullable().optional(),
    seasonalPrice: z.number().positive().nullable().optional(),
    amenities: z.array(z.string()).optional(),
    isAvailable: z.boolean().optional(),
    isFeatured: z.boolean().optional(),
    totalRooms: z.number().int().positive().optional(),
    cancellationPolicy: z.string().optional(),
    checkInTime: z.string().optional(),
    checkOutTime: z.string().optional(),
  }),
  params: z.object({
    id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid room ID'),
  }),
});

const checkAvailabilitySchema = z.object({
  query: z.object({
    checkIn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid check-in date format (YYYY-MM-DD)'),
    checkOut: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid check-out date format (YYYY-MM-DD)'),
    roomId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid room ID').optional(),
  }),
});

module.exports = {
  createRoomSchema,
  updateRoomSchema,
  checkAvailabilitySchema,
};
