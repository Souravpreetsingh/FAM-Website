const mongoose = require('mongoose');

const roomSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Room name is required'],
      trim: true,
      maxlength: [100, 'Room name cannot exceed 100 characters'],
    },
    slug: {
      type: String,
      unique: true,
      lowercase: true,
    },
    description: {
      type: String,
      required: [true, 'Room description is required'],
      maxlength: [2000, 'Description cannot exceed 2000 characters'],
    },
    shortDescription: {
      type: String,
      maxlength: [300, 'Short description cannot exceed 300 characters'],
      default: '',
    },
    pricePerNight: {
      type: Number,
      required: [true, 'Price per night is required'],
      min: [0, 'Price must be a positive number'],
    },
    discountPrice: {
      type: Number,
      min: [0, 'Discount price must be a positive number'],
      default: null,
    },
    currency: {
      type: String,
      default: 'INR',
      enum: ['INR', 'USD'],
    },
    capacity: {
      adults: {
        type: Number,
        required: [true, 'Adult capacity is required'],
        min: 1,
        default: 2,
      },
      children: {
        type: Number,
        default: 0,
        min: 0,
      },
      maxGuests: {
        type: Number,
        required: [true, 'Maximum guests is required'],
        min: 1,
      },
    },
    size: {
      type: Number,
      default: 0,
    },
    unit: {
      type: String,
      default: 'sq ft',
    },
    bedType: {
      type: String,
      default: 'King',
    },
    type: {
      type: String,
      default: '',
    },
    weekendPrice: {
      type: Number,
      min: [0, 'Weekend price must be a positive number'],
      default: null,
    },
    seasonalPrice: {
      type: Number,
      min: [0, 'Seasonal price must be a positive number'],
      default: null,
    },
    amenities: [
      {
        type: String,
      },
    ],
    images: [
      {
        public_id: String,
        url: String,
        alt: {
          type: String,
          default: '',
        },
      },
    ],
    thumbnail: {
      public_id: String,
      url: String,
    },
    isAvailable: {
      type: Boolean,
      default: true,
    },
    isFeatured: {
      type: Boolean,
      default: false,
    },
    totalRooms: {
      type: Number,
      required: [true, 'Total number of rooms is required'],
      min: 1,
      default: 1,
    },
    status: {
      type: String,
      enum: ['available', 'booked', 'occupied', 'cleaning', 'maintenance', 'out_of_service'],
      default: 'available',
    },
    bookedDates: [
      {
        date: Date,
        count: {
          type: Number,
          default: 1,
        },
        bookingId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Booking',
        },
      },
    ],
    maintenanceBlocks: [
      {
        startDate: Date,
        endDate: Date,
        reason: {
          type: String,
          default: 'Scheduled maintenance',
        },
      },
    ],
    minStay: {
      type: Number,
      default: 1,
      min: 1,
    },
    maxStay: {
      type: Number,
      default: 30,
      min: 1,
    },
    cancellationPolicy: {
      type: String,
      default: 'Free cancellation up to 48 hours before check-in',
    },
    checkInTime: {
      type: String,
      default: '14:00',
    },
    checkOutTime: {
      type: String,
      default: '11:00',
    },
    rating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },
    numReviews: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

roomSchema.index({ slug: 1 });
roomSchema.index({ isAvailable: 1, isFeatured: 1 });
roomSchema.index({ pricePerNight: 1 });
roomSchema.index({ status: 1 });

roomSchema.pre('save', function (next) {
  if (this.isModified('name') && !this.slug) {
    this.slug = this.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  }
  next();
});

roomSchema.methods.isDateBlockedForMaintenance = function (date) {
  return this.maintenanceBlocks.some(
    (block) => date >= block.startDate && date < block.endDate
  );
};

roomSchema.methods.isDateAvailable = function (date, excludeBookingId) {
  if (this.status === 'maintenance' || this.status === 'out_of_service') {
    if (!this.isDateBlockedForMaintenance(date)) return true;
    return false;
  }
  const bookingOnDate = this.bookedDates.find((bd) => {
    const bdDate = new Date(bd.date);
    return (
      bdDate.toDateString() === date.toDateString() &&
      bd.count >= this.totalRooms
    );
  });
  return !bookingOnDate || bookingOnDate.bookingId?.toString() === excludeBookingId;
};

module.exports = mongoose.model('Room', roomSchema);
