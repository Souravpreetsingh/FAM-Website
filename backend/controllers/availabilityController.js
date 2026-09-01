const mongoose = require('mongoose');
const AvailabilityBlock = require('../models/AvailabilityBlock');
const Booking = require('../models/Booking');
const ApiResponse = require('../utils/ApiResponse');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const availabilityService = require('../services/availabilityService');
const auditService = require('../services/auditService');

/** Admin month-grid calendar: per room × per day status. */
const getAvailabilityCalendar = asyncHandler(async (req, res) => {
  const month = parseInt(req.query.month);
  const year = parseInt(req.query.year);
  const m = Number.isInteger(month) && month >= 0 && month <= 11 ? month : new Date().getMonth();
  const y = Number.isInteger(year) && year >= 2000 ? year : new Date().getFullYear();

  const Room = require('../models/Room');
  const rooms = await Room.find({}).sort({ createdAt: 1 });
  const calendar = await availabilityService.buildMonthCalendar(rooms, m, y);

  ApiResponse.success({ calendar, month: m, year: y }).send(res);
});

/** Create a manual block (BLOCKED, MAINTENANCE) or hold (RESERVED) for a date range. */
const createBlock = asyncHandler(async (req, res) => {
  const { roomId, startDate, endDate, reason, kind } = req.validated?.body || req.body || {};
  const blockKind = (kind || 'BLOCKED').toUpperCase();
  if (!['BLOCKED', 'RESERVED', 'MAINTENANCE'].includes(blockKind)) {
    throw ApiError.badRequest('Kind must be BLOCKED, RESERVED, or MAINTENANCE');
  }

  const Room = require('../models/Room');
  const room = await Room.findById(roomId);
  if (!room) throw ApiError.notFound('Room not found');

  const start = availabilityService.toDay(startDate);
  const end = availabilityService.toDay(endDate);
  if (start >= end) throw ApiError.badRequest('End date must be after start date');

  const stay = await availabilityService.checkStay(room, start, end);
  if (!stay.available) {
    const conflictDates = stay.conflictingDates && stay.conflictingDates.length
      ? ' Conflicting dates: ' + stay.conflictingDates.map(function (d) { return availabilityService.formatDay(d); }).join(', ')
      : '';
    throw ApiError.conflict('This room has an existing reservation during the selected dates (' + stay.reason + ').' + conflictDates);
  }

  const nights = availabilityService.generateNights(start, end);
  try {
    await availabilityService.acquireDates(room, nights, {
      kind: blockKind,
      createdBy: req.user ? req.user._id : null,
      reason: reason || (blockKind === 'RESERVED' ? 'Held reservation' : blockKind === 'MAINTENANCE' ? 'Scheduled maintenance' : 'Blocked by staff'),
    });
  } catch {
    throw ApiError.conflict('Cannot create block: some dates are already occupied');
  }

  await auditService.log(req, {
    action: 'create_availability_block',
    entity: 'availability',
    entityId: String(roomId),
    changes: { room: room.name, roomId: String(roomId), startDate: availabilityService.formatDay(start), endDate: availabilityService.formatDay(end), kind: blockKind, reason: reason || '' },
  });

  ApiResponse.success({ roomId, startDate: start, endDate: end, kind: blockKind, reason: reason || '' }, 'Block created').send(res);
});

/** Remove a manual block/hold by its ledger row id. */
const removeBlock = asyncHandler(async (req, res) => {
  const block = await AvailabilityBlock.findById(req.params.blockId);
  if (!block) throw ApiError.notFound('Block not found');
  if (block.kind === 'BOOKED') {
    throw ApiError.badRequest('Use the booking cancellation flow to remove booked dates');
  }

  await AvailabilityBlock.findByIdAndDelete(block._id);

  await auditService.log(req, {
    action: 'delete_availability_block',
    entity: 'availability',
    entityId: String(block.room),
    changes: { blockId: String(block._id), date: availabilityService.formatDay(block.date), kind: block.kind },
  });

  ApiResponse.success(null, 'Block removed').send(res);
});

/** Public availability for a date range across all (or one) rooms. */
const checkAvailabilityPublic = asyncHandler(async (req, res) => {
  const { checkIn, checkOut, roomId } = req.query || {};
  if (!checkIn || !checkOut) throw ApiError.badRequest('checkIn and checkOut are required');

  const Room = require('../models/Room');
  const filter = {};
  if (roomId) filter._id = roomId;
  if (!mongoose.Types.ObjectId.isValid(roomId || '')) delete filter._id;

  const rooms = await Room.find(filter);
  const start = availabilityService.toDay(checkIn);
  const end = availabilityService.toDay(checkOut);
  const nights = availabilityService.nightsBetween(start, end);

  const availability = await Promise.all(
    rooms.map(async (room) => {
      const stay = await availabilityService.checkStay(room, start, end);
      return {
        room: { _id: room._id, name: room.name, slug: room.slug },
        available: stay.available,
        reason: stay.available ? null : stay.reason,
        nights,
      };
    })
  );

  ApiResponse.success({ availability, checkIn: start, checkOut: end }).send(res);
});

/** Remove all manual/reserved blocks for a room within a date range (not bookings). */
const clearRange = asyncHandler(async (req, res) => {
  const { roomId, startDate, endDate } = req.validated?.body || req.body || {};
  const Room = require('../models/Room');
  const room = await Room.findById(roomId);
  if (!room) throw ApiError.notFound('Room not found');

  const start = availabilityService.toDay(startDate);
  const end = availabilityService.toDay(endDate);
  if (start >= end) throw ApiError.badRequest('End date must be after start date');

  const removed = await AvailabilityBlock.deleteMany({
    room: roomId,
    date: { $gte: start, $lt: end },
    kind: { $in: ['BLOCKED', 'RESERVED', 'MAINTENANCE'] },
  });

  await auditService.log(req, {
    action: 'clear_availability_block',
    entity: 'availability',
    entityId: String(roomId),
    changes: { room: room.name, roomId: String(roomId), startDate: availabilityService.formatDay(start), endDate: availabilityService.formatDay(end), removed: removed.deletedCount || 0 },
  });

  ApiResponse.success({ roomId, startDate: availabilityService.formatDay(start), endDate: availabilityService.formatDay(end), removed: removed.deletedCount || 0 }, 'Blocks cleared').send(res);
});

module.exports = {
  getAvailabilityCalendar,
  createBlock,
  removeBlock,
  clearRange,
  checkAvailabilityPublic,
};