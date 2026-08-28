const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    guestName: {
      type: String,
      trim: true,
      maxlength: [50, 'Guest name cannot exceed 50 characters'],
      default: '',
    },
    guestEmail: {
      type: String,
      lowercase: true,
      trim: true,
      default: '',
    },
    guestPhone: {
      type: String,
      trim: true,
      default: '',
    },
    source: {
      type: String,
      enum: ['ONLINE', 'OFFLINE', 'PHONE', 'WALK-IN', 'ADMIN'],
      default: 'ONLINE',
    },
    notes: {
      type: String,
      maxlength: [1000, 'Notes cannot exceed 1000 characters'],
      default: '',
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    room: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Room',
      required: [true, 'Room is required'],
    },
    checkIn: {
      type: Date,
      required: [true, 'Check-in date is required'],
    },
    checkOut: {
      type: Date,
      required: [true, 'Check-out date is required'],
    },
    guests: {
      adults: {
        type: Number,
        required: true,
        min: 1,
        default: 1,
      },
      children: {
        type: Number,
        default: 0,
        min: 0,
      },
    },
    totalAmount: {
      type: Number,
      required: [true, 'Total amount is required'],
      min: [0, 'Total amount must be a positive number'],
    },
    amountPaid: {
      type: Number,
      default: 0,
      min: 0,
    },
    currency: {
      type: String,
      default: 'INR',
    },
    status: {
      type: String,
      enum: [
        'draft',
        'pending',
        'confirmed',
        'checked_in',
        'checked_out',
        'completed',
        'cancelled',
        'no_show',
        'expired',
      ],
      default: 'pending',
    },
    paymentStatus: {
      type: String,
      enum: ['pending', 'partial', 'paid', 'refunded', 'failed'],
      default: 'pending',
    },
    payment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Payment',
    },
    specialRequests: {
      type: String,
      maxlength: [500, 'Special requests cannot exceed 500 characters'],
      default: '',
    },
    nights: {
      type: Number,
      required: true,
      min: 1,
    },
    cancellationReason: {
      type: String,
      default: '',
    },
    cancelledAt: Date,
    confirmedAt: Date,
    checkedInAt: Date,
    checkedOutAt: Date,
    completedAt: Date,
    expiredAt: Date,
    previousRoom: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Room',
    },
    statusHistory: [
      {
        status: {
          type: String,
          enum: [
            'draft',
            'pending',
            'confirmed',
            'checked_in',
            'checked_out',
            'completed',
            'cancelled',
            'no_show',
            'expired',
          ],
        },
        changedAt: {
          type: Date,
          default: Date.now,
        },
        changedBy: {
          type: String,
          default: 'system',
        },
        note: String,
      },
    ],
  },
  {
    timestamps: true,
  }
);

bookingSchema.index({ user: 1, status: 1 });
bookingSchema.index({ room: 1, checkIn: 1, checkOut: 1 });
bookingSchema.index({ status: 1, createdAt: -1 });
bookingSchema.index({ checkIn: 1, checkOut: 1 });
bookingSchema.index({ source: 1 });
bookingSchema.index({ guestName: 1 });
bookingSchema.index({ guestPhone: 1 });

bookingSchema.pre('save', function (next) {
  if (this.isModified('status')) {
    const now = new Date();
    const entry = { status: this.status, changedAt: now, changedBy: 'system' };
    if (this.status === 'confirmed' && !this.confirmedAt) {
      this.confirmedAt = now;
      entry.note = 'Booking confirmed';
    }
    if (this.status === 'cancelled' && !this.cancelledAt) {
      this.cancelledAt = now;
      entry.note = this.cancellationReason || 'Booking cancelled';
    }
    if (this.status === 'checked_in' && !this.checkedInAt) {
      this.checkedInAt = now;
      entry.note = 'Guest checked in';
    }
    if (this.status === 'checked_out' && !this.checkedOutAt) {
      this.checkedOutAt = now;
      entry.note = 'Guest checked out';
    }
    if (this.status === 'completed' && !this.completedAt) {
      this.completedAt = now;
      entry.note = 'Stay completed';
    }
    if (this.status === 'no_show') {
      entry.note = 'Guest did not show';
    }
    if (this.status === 'expired' && !this.expiredAt) {
      this.expiredAt = now;
      entry.note = 'Booking expired';
    }
    this.statusHistory.push(entry);
  }
  next();
});

bookingSchema.methods.canModify = function () {
  return ['draft', 'pending', 'confirmed'].includes(this.status);
};

bookingSchema.methods.canCancel = function () {
  return ['draft', 'pending', 'confirmed'].includes(this.status);
};

bookingSchema.statics.statusFlow = {
  draft: ['pending', 'cancelled'],
  pending: ['confirmed', 'cancelled', 'expired', 'no_show'],
  confirmed: ['checked_in', 'cancelled', 'no_show', 'expired'],
  checked_in: ['checked_out', 'cancelled'],
  checked_out: ['completed'],
  completed: [],
  cancelled: [],
  no_show: [],
  expired: [],
};

bookingSchema.statics.isValidTransition = function (from, to) {
  const validNext = this.statusFlow[from];
  return validNext && validNext.includes(to);
};

module.exports = mongoose.model('Booking', bookingSchema);
