const AvailabilityBlock = require('../models/AvailabilityBlock');
const Booking = require('../models/Booking');
const Room = require('../models/Room');
const ApiError = require('../utils/ApiError');
const mongoose = require('mongoose');

const ACTIVE_BOOKING_STATUSES = ['pending', 'confirmed', 'checked_in', 'checked_out'];
const BLOCK_LABELS = {
  BOOKED: 'booked',
  RESERVED: 'reserved',
  MAINTENANCE: 'maintenance',
  BLOCKED: 'blocked',
};

/** Day-granularity helpers — all dates are normalised to UTC midnight of their YYYY-MM-DD value. */
function toDay(dateLike) {
  const d = new Date(dateLike);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function formatDay(date) {
  return toDay(date).toISOString().split('T')[0];
}

function nightsBetween(checkIn, checkOut) {
  const ms = toDay(checkOut).getTime() - toDay(checkIn).getTime();
  return Math.max(0, Math.round(ms / (1000 * 60 * 60 * 24)));
}

function generateNights(checkIn, checkOut) {
  const start = toDay(checkIn);
  const end = toDay(checkOut);
  const nights = [];
  const cursor = new Date(start);
  while (cursor < end) {
    nights.push(new Date(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return nights;
}

/**
 * Authoritative stay check for a room across a date range.
 * Combines live bookings, the AvailabilityBlock ledger, legacy bookedDates and
 * maintenance so the result is correct even for pre-existing data.
 * @returns {{ available: boolean, reason?: string, conflictingDates?: string[] }}
 */
async function checkStay(room, checkIn, checkOut, excludeBookingId = null) {
  const start = toDay(checkIn);
  const end = toDay(checkOut);
  if (nightsBetween(start, end) < 1) {
    throw ApiError.badRequest('Check-out must be after check-in');
  }

  const exclude = excludeBookingId ? { _id: { $ne: excludeBookingId } } : {};

  const activeOverlap = await Booking.findOne({
    room: room._id,
    checkIn: { $lt: end },
    checkOut: { $gt: start },
    status: { $in: ACTIVE_BOOKING_STATUSES },
    ...exclude,
  }).select('checkIn checkOut');
  if (activeOverlap) {
    const overlapStart = activeOverlap.checkIn > start ? activeOverlap.checkIn : start;
    const overlapEnd = activeOverlap.checkOut < end ? activeOverlap.checkOut : end;
    return {
      available: false,
      reason: 'fully_booked',
      conflictingDates: generateNights(overlapStart, overlapEnd).map(formatDay),
    };
  }

  if (room.status === 'maintenance' || room.status === 'out_of_service') {
    return { available: false, reason: 'maintenance' };
  }

  const nights = generateNights(start, end);
  for (const night of nights) {
    if (room.isDateBlockedForMaintenance(night)) {
      return { available: false, reason: 'maintenance', conflictingDates: [formatDay(night)] };
    }
    const bd = room.bookedDates.find((b) => b.date.toDateString() === night.toDateString());
    if (bd && bd.count >= room.totalRooms && bd.bookingId && bd.bookingId.toString() !== String(excludeBookingId || '')) {
      return { available: false, reason: 'fully_booked', conflictingDates: [formatDay(night)] };
    }
  }

  const ledgerMatch = { room: room._id, date: { $gte: start, $lt: end } };
  if (excludeBookingId) {
    ledgerMatch.bookingId = { $ne: new mongoose.Types.ObjectId(String(excludeBookingId)) };
  }

  const byDate = await AvailabilityBlock.aggregate([
    { $match: ledgerMatch },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$date' } },
        units: { $addToSet: '$unit' },
        reason: { $first: '$kind' },
      },
    },
  ]);

  for (const row of byDate) {
    let units = row.units || [];
    if (row.reason && row.reason !== 'BOOKED') units = row.units; // bookable kinds still occupy a unit
    if (units.length >= room.totalRooms) {
      return { available: false, reason: BLOCK_LABELS[row.reason] || 'fully_booked', conflictingDates: [row._id] };
    }
  }

  return { available: true };
}

/**
 * Atomically claim every night for one unit of a room using the unique
 * (room, unit, date) ledger index. Concurrent requests for the same unit/date
 * cannot both succeed — one throws a 11000 duplicate key.
 * @returns {number} the unit that was acquired.
 */
async function acquireDates(room, nights, { kind = 'BOOKED', bookingId = null, createdBy = null, reason = '' } = {}) {
  for (let unit = 0; unit < room.totalRooms; unit++) {
    const docs = nights.map((date) => ({
      room: room._id,
      unit,
      date,
      kind,
      ...(bookingId ? { bookingId } : {}),
      ...(createdBy ? { createdBy } : {}),
      ...(reason ? { reason } : {}),
    }));
    try {
      await AvailabilityBlock.insertMany(docs, { ordered: false });
      return unit;
    } catch (err) {
      const isDup = err.code === 11000 || (err.writeErrors && err.writeErrors.some((we) => we.code === 11000));
      if (isDup) {
        const cleanup = { room: room._id, unit };
        if (bookingId) cleanup.bookingId = bookingId;
        else cleanup.date = { $in: nights };
        await AvailabilityBlock.deleteMany(cleanup);
        continue;
      }
      throw err;
    }
  }
  throw ApiError.conflict('Room is not available for the selected dates');
}

/** Release the ledger rows created for a booking (used on cancel / move / date change). */
async function releaseBookingDates(roomId, bookingId) {
  if (!bookingId) return;
  await AvailabilityBlock.deleteMany({ room: roomId, bookingId, kind: 'BOOKED' });
}

/** Release manual blocks (BLOCKED / RESERVED / MAINTENANCE) for a date range. */
async function releaseManualBlocks(roomId, kind, start, end, reason = undefined) {
  const filter = { room: roomId, kind };
  if (start && end) filter.date = { $gte: toDay(start), $lt: toDay(end) };
  if (reason !== undefined && reason !== null) filter.reason = reason;
  await AvailabilityBlock.deleteMany(filter);
}

async function getBlocksForRange(roomId, start, end, options = {}) {
  const filter = { room: roomId, date: { $gte: toDay(start), $lt: toDay(end) } };
  if (options.kind) filter.kind = options.kind;
  return AvailabilityBlock.find(filter).populate('bookingId', 'guestName guestEmail status').lean();
}

/** Mirror a booking into the legacy room.bookedDates array (kept for backwards compatibility). */
async function mirrorBookedDates(roomId, checkIn, checkOut, bookingId) {
  const room = await Room.findById(roomId);
  if (!room) return;
  const nights = generateNights(checkIn, checkOut);
  for (const date of nights) {
    const existing = room.bookedDates.find((bd) => bd.date.toDateString() === date.toDateString());
    if (existing) existing.count += 1;
    else room.bookedDates.push({ date, count: 1, bookingId });
  }
  room.isAvailable = false;
  if (room.status === 'available') room.status = 'booked';
  await room.save();
}

/** Remove a booking's nights from the legacy room.bookedDates array. */
async function unMirrorBookedDates(roomId, checkIn, checkOut, bookingId) {
  const room = await Room.findById(roomId);
  if (!room) return;
  const nights = generateNights(checkIn, checkOut);
  for (const date of nights) {
    const existing = room.bookedDates.find((bd) => bd.date.toDateString() === date.toDateString());
    if (existing) {
      existing.count = Math.max(0, existing.count - 1);
      if (existing.count === 0) existing.bookingId = undefined;
    }
  }
  room.bookedDates = room.bookedDates.filter((bd) => bd.count > 0);
  if (room.bookedDates.length === 0) {
    room.isAvailable = true;
    if (room.status === 'booked') room.status = 'available';
  }
  await room.save();
}

/**
 * Per-room, per-day status map for a month used by the admin calendar.
 * @returns {Promise<Array>} rooms each with `days: [{date, status, booking, blockId}]`
 */
async function buildMonthCalendar(rooms, month, year) {
  const start = toDay(new Date(Date.UTC(year, month, 1)));
  const end = toDay(new Date(Date.UTC(year, month + 1, 1)));
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const dayKeys = [];
  for (let d = 1; d <= daysInMonth; d++) dayKeys.push(formatDay(new Date(Date.UTC(year, month, d))));

  const [blocks, activeBookings] = await Promise.all([
    AvailabilityBlock.find({ date: { $gte: start, $lt: end } })
      .populate('bookingId', 'guestName guestEmail guestPhone status source')
      .lean(),
    Booking.find({
      checkIn: { $lt: end },
      checkOut: { $gt: start },
      status: { $in: ACTIVE_BOOKING_STATUSES },
    })
      .populate('room', 'name')
      .populate('user', 'name email')
      .lean(),
  ]);

  const roomsById = new Map(rooms.map((r) => [r._id.toString(), r]));

  return rooms.map((room) => {
    const roomBlocks = blocks.filter((b) => b.room.toString() === room._id.toString());
    const roomBookings = activeBookings.filter((b) => b.room._id.toString() === room._id.toString());
    const days = dayKeys.map((key) => {
      const date = toDay(key);
      const block = roomBlocks.find((b) => formatDay(b.date) === key);
      const booking = roomBookings.find((b) => key >= formatDay(b.checkIn) && key < formatDay(b.checkOut));
      const maintenance = room.isDateBlockedForMaintenance(date);
      let status = 'available';
      if (room.status === 'maintenance' || room.status === 'out_of_service' || maintenance) status = 'maintenance';
      else if (block) status = BLOCK_LABELS[block.kind] || 'blocked';
      else if (booking) status = 'booked';
      else if (room.status === 'occupied' && key === formatDay(new Date())) status = 'booked';
      return {
        date: key,
        status,
        blockId: block ? String(block._id) : null,
        blockKind: block ? block.kind : null,
        bookingId: booking ? String(booking._id) : null,
        guest: booking ? booking.guestName || booking.user?.name || 'Guest' : null,
        note: maintenance ? block?.reason || '' : '',
      };
    });
    const roomObj = roomsById.get(room._id.toString());
    return {
      room: { _id: room._id, name: room.name, slug: room.slug, status: room.status, totalRooms: room.totalRooms },
      days,
      availableNights: days.filter((d) => d.status === 'available').length,
      occupiedNights: days.filter((d) => d.status !== 'available').length,
      thumbnail: roomObj ? roomObj.thumbnail : null,
      pricePerNight: roomObj ? roomObj.pricePerNight : null,
    };
  });
}

module.exports = {
  ACTIVE_BOOKING_STATUSES,
  BLOCK_LABELS,
  toDay,
  formatDay,
  nightsBetween,
  generateNights,
  checkStay,
  acquireDates,
  releaseBookingDates,
  releaseManualBlocks,
  getBlocksForRange,
  mirrorBookedDates,
  unMirrorBookedDates,
  buildMonthCalendar,
};