const mongoose = require('mongoose');

const availabilityBlockSchema = new mongoose.Schema(
  {
    room: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Room',
      required: [true, 'Room is required'],
    },
    unit: {
      type: Number,
      default: 0,
      min: 0,
    },
    date: {
      type: Date,
      required: [true, 'Date is required'],
    },
    kind: {
      type: String,
      enum: ['BOOKED', 'RESERVED', 'MAINTENANCE', 'BLOCKED'],
      default: 'BOOKED',
    },
    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Booking',
      default: null,
    },
    startedAt: Date,
    endedAt: Date,
    reason: {
      type: String,
      default: '',
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

availabilityBlockSchema.index({ room: 1, unit: 1, date: 1 }, { unique: true });
availabilityBlockSchema.index({ room: 1, date: 1 });
availabilityBlockSchema.index({ date: 1 });
availabilityBlockSchema.index({ kind: 1 });
availabilityBlockSchema.index({ bookingId: 1 });

availabilityBlockSchema.methods.toDayString = function () {
  return this.date.toISOString().split('T')[0];
};

module.exports = mongoose.model('AvailabilityBlock', availabilityBlockSchema);