const Room = require('../models/Room');
const Booking = require('../models/Booking');
const AvailabilityBlock = require('../models/AvailabilityBlock');
const ApiResponse = require('../utils/ApiResponse');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const cloudinaryService = require('../services/cloudinaryService');
const availabilityService = require('../services/availabilityService');
const auditService = require('../services/auditService');
const { paginate, paginationResponse } = require('../utils/pagination');

const getRooms = asyncHandler(async (req, res) => {
  const { page, limit, skip } = paginate(req.query.page, req.query.limit);
  const filter = {};

  if (req.query.isAvailable !== undefined) {
    filter.isAvailable = req.query.isAvailable === 'true';
  }
  if (req.query.isFeatured !== undefined) {
    filter.isFeatured = req.query.isFeatured === 'true';
  }
  if (req.query.minPrice) {
    filter.pricePerNight = { $gte: parseFloat(req.query.minPrice) };
  }
  if (req.query.maxPrice) {
    filter.pricePerNight = { ...filter.pricePerNight, $lte: parseFloat(req.query.maxPrice) };
  }
  if (req.query.capacity) {
    filter['capacity.maxGuests'] = { $gte: parseInt(req.query.capacity, 10) };
  }
  if (req.query.search) {
    filter.$or = [
      { name: { $regex: req.query.search, $options: 'i' } },
      { description: { $regex: req.query.search, $options: 'i' } },
      { 'amenities': { $regex: req.query.search, $options: 'i' } },
    ];
  }
  if (req.query.amenities) {
    const amenities = req.query.amenities.split(',');
    filter.amenities = { $all: amenities };
  }
  if (req.query.status) {
    filter.status = req.query.status;
  }
  if (req.query.bedType) {
    filter.bedType = { $regex: req.query.bedType, $options: 'i' };
  }

  if (req.query.checkIn && req.query.checkOut) {
    const checkInDate = availabilityService.toDay(req.query.checkIn);
    const checkOutDate = availabilityService.toDay(req.query.checkOut);
    const nights = availabilityService.nightsBetween(checkInDate, checkOutDate);

    const bookedRoomIds = await Booking.find({
      checkIn: { $lt: checkOutDate },
      checkOut: { $gt: checkInDate },
      status: { $in: ['pending', 'confirmed', 'checked_in', 'checked_out'] },
    }).distinct('room');

    const blockedRoomIds = await AvailabilityBlock.distinct('room', {
      date: { $gte: checkInDate, $lt: checkOutDate },
    });

    const excluded = new Set([...bookedRoomIds.map(String), ...blockedRoomIds.map(String)]);
    if (excluded.size) filter._id = { $nin: Array.from(excluded) };
    filter.isAvailable = true;
    filter.status = { $nin: ['maintenance', 'out_of_service'] };
  }

  const sort = {};
  if (req.query.sort) {
    const [field, order] = req.query.sort.split(':');
    sort[field] = order === 'desc' ? -1 : 1;
  } else {
    sort.createdAt = -1;
  }

  const [rooms, total] = await Promise.all([
    Room.find(filter).sort(sort).skip(skip).limit(limit),
    Room.countDocuments(filter),
  ]);

  const responseData = {
    rooms,
    pagination: paginationResponse(total, page, limit),
  };

  if (req.query.checkIn && req.query.checkOut) {
    const checkInDate = availabilityService.toDay(req.query.checkIn);
    const checkOutDate = availabilityService.toDay(req.query.checkOut);
    const nights = availabilityService.nightsBetween(checkInDate, checkOutDate);
    responseData.rooms = rooms.map((room) => {
      const obj = room.toObject();
      obj.totalPrice = (room.discountPrice || room.pricePerNight) * nights;
      obj.nights = nights;
      return obj;
    });
  }

  ApiResponse.success(responseData).send(res);
});

const getRoom = asyncHandler(async (req, res) => {
  const room = await Room.findById(req.params.id);
  if (!room) throw ApiError.notFound('Room not found');
  ApiResponse.success({ room }).send(res);
});

const getRoomBySlug = asyncHandler(async (req, res) => {
  const room = await Room.findOne({ slug: req.params.slug });
  if (!room) throw ApiError.notFound('Room not found');
  ApiResponse.success({ room }).send(res);
});

const createRoom = asyncHandler(async (req, res) => {
  const roomData = req.validated?.body || {};
  const room = await Room.create(roomData);
  await auditService.log(req, {
    action: 'create_room',
    entity: 'room',
    entityId: String(room._id),
    changes: { name: room.name, slug: room.slug, pricePerNight: room.pricePerNight, status: room.status },
  });
  ApiResponse.created({ room }, 'Room created successfully').send(res);
});

const updateRoom = asyncHandler(async (req, res) => {
  const room = await Room.findByIdAndUpdate(req.params.id, req.validated?.body || {}, {
    new: true,
    runValidators: true,
  });
  if (!room) throw ApiError.notFound('Room not found');
  await auditService.log(req, {
    action: 'update_room',
    entity: 'room',
    entityId: String(req.params.id),
    changes: req.validated?.body || {},
  });
  ApiResponse.success({ room }, 'Room updated successfully').send(res);
});

const deleteRoom = asyncHandler(async (req, res) => {
  const room = await Room.findById(req.params.id);
  if (!room) throw ApiError.notFound('Room not found');
  if (room.images && room.images.length > 0) {
    await cloudinaryService.deleteImages(room.images.map((img) => img.public_id));
  }
  if (room.thumbnail?.public_id) {
    await cloudinaryService.deleteImage(room.thumbnail.public_id);
  }
  await Room.findByIdAndDelete(req.params.id);
  await auditService.log(req, {
    action: 'delete_room',
    entity: 'room',
    entityId: String(req.params.id),
    changes: { name: room.name, slug: room.slug },
  });
  ApiResponse.success(null, 'Room deleted successfully').send(res);
});

const uploadRoomImages = asyncHandler(async (req, res) => {
  const room = await Room.findById(req.params.id);
  if (!room) throw ApiError.notFound('Room not found');
  if (!req.files || req.files.length === 0) throw ApiError.badRequest('No images uploaded');
  const images = await cloudinaryService.uploadImages(req.files, 'fam/rooms');
  room.images.push(...images);
  if (!room.thumbnail && images.length > 0) room.thumbnail = images[0];
  await room.save();
  ApiResponse.success({ room }, 'Images uploaded successfully').send(res);
});

const deleteRoomImage = asyncHandler(async (req, res) => {
  const room = await Room.findById(req.params.id);
  if (!room) throw ApiError.notFound('Room not found');
  const image = room.images.id(req.params.imageId);
  if (!image) throw ApiError.notFound('Image not found');
  await cloudinaryService.deleteImage(image.public_id);
  room.images.pull(req.params.imageId);
  if (room.thumbnail?.public_id === image.public_id) {
    room.thumbnail = room.images.length > 0 ? room.images[0] : undefined;
  }
  await room.save();
  ApiResponse.success({ room }, 'Image deleted successfully').send(res);
});

const checkAvailability = asyncHandler(async (req, res) => {
  const { checkIn, checkOut, roomId } = req.validated?.query || req.query;
  const checkInDate = availabilityService.toDay(checkIn);
  const checkOutDate = availabilityService.toDay(checkOut);

  if (checkInDate >= checkOutDate) throw ApiError.badRequest('Check-out must be after check-in');

  const filter = {};
  if (roomId) filter._id = roomId;

  const rooms = await Room.find(filter);
  const nights = availabilityService.nightsBetween(checkInDate, checkOutDate);

  const availability = await Promise.all(
    rooms.map(async (room) => {
      const stay = await availabilityService.checkStay(room, checkInDate, checkOutDate);
      const totalPrice = (room.discountPrice || room.pricePerNight) * nights;

      return {
        room: {
          _id: room._id,
          name: room.name,
          slug: room.slug,
          pricePerNight: room.pricePerNight,
          discountPrice: room.discountPrice,
          capacity: room.capacity,
          thumbnail: room.thumbnail,
          amenities: room.amenities,
          bedType: room.bedType,
          status: room.status,
          minStay: room.minStay,
          maxStay: room.maxStay,
        },
        available: stay.available,
        nights,
        totalPrice,
        reason: stay.available ? null : stay.reason,
        conflictingDates: stay.available ? [] : (stay.conflictingDates || []),
      };
    })
  );

  ApiResponse.success({ availability, checkIn, checkOut }).send(res);
});

const getFeaturedRooms = asyncHandler(async (req, res) => {
  const rooms = await Room.find({ isFeatured: true, isAvailable: true }).limit(6);
  ApiResponse.success({ rooms }).send(res);
});

const updateRoomStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;
  const validStatuses = ['available', 'booked', 'occupied', 'cleaning', 'maintenance', 'out_of_service'];
  if (!validStatuses.includes(status)) {
    throw ApiError.badRequest(`Invalid status. Must be one of: ${validStatuses.join(', ')}`);
  }

  const prevRoom = await Room.findById(req.params.id);
  if (!prevRoom) throw ApiError.notFound('Room not found');
  const previousStatus = prevRoom.status;

  const room = await Room.findByIdAndUpdate(
    req.params.id,
    { status },
    { new: true }
  );
  if (!room) throw ApiError.notFound('Room not found');

  if (status === 'available') {
    room.isAvailable = true;
    if (room.maintenanceBlocks.length > 0) {
      await availabilityService.releaseManualBlocks(room._id, 'MAINTENANCE', null, null).catch(() => {});
      room.maintenanceBlocks = [];
    }
    await room.save();
  } else if (status === 'maintenance' || status === 'out_of_service') {
    room.isAvailable = false;
    await room.save();
  }

  await auditService.log(req, {
    action: 'update_room_status',
    entity: 'room',
    entityId: String(req.params.id),
    changes: { status, previousStatus },
  });

  ApiResponse.success({ room }, `Room status updated to ${status}`).send(res);
});

const blockForMaintenance = asyncHandler(async (req, res) => {
  const { startDate, endDate, reason } = req.body;
  if (!startDate || !endDate) throw ApiError.badRequest('Start and end dates required');

  const room = await Room.findById(req.params.id);
  if (!room) throw ApiError.notFound('Room not found');

  const start = availabilityService.toDay(startDate);
  const end = availabilityService.toDay(endDate);
  if (start >= end) throw ApiError.badRequest('End date must be after start date');

  const overlapping = await Booking.findOne({
    room: req.params.id,
    checkIn: { $lt: end },
    checkOut: { $gt: start },
    status: { $in: ['confirmed', 'checked_in', 'pending'] },
  });
  if (overlapping) {
    throw ApiError.conflict('Cannot block dates: there are existing bookings in this period');
  }

  // Claim the ledger first — if the exact dates are already occupied, we abort
  // without mutating anything.
  const nights = availabilityService.generateNights(start, end);
  try {
    await availabilityService.acquireDates(room, nights, {
      kind: 'MAINTENANCE',
      createdBy: req.user ? req.user._id : null,
      reason: reason || 'Scheduled maintenance',
    });
  } catch {
    throw ApiError.conflict('Cannot block dates: some dates are already occupied');
  }

  room.maintenanceBlocks.push({
    startDate: start,
    endDate: end,
    reason: reason || 'Scheduled maintenance',
  });
  room.status = 'maintenance';
  room.isAvailable = false;
  await room.save();

  await auditService.log(req, {
    action: 'maintenance_block_create',
    entity: 'room',
    entityId: String(room._id),
    changes: { startDate: start.toISOString(), endDate: end.toISOString(), reason: reason || 'Scheduled maintenance' },
  });

  ApiResponse.success({ room }, 'Room blocked for maintenance').send(res);
});

const removeMaintenanceBlock = asyncHandler(async (req, res) => {
  const room = await Room.findById(req.params.id);
  if (!room) throw ApiError.notFound('Room not found');

  const block = room.maintenanceBlocks.find((b) => b._id.toString() === req.params.blockId);

  room.maintenanceBlocks = room.maintenanceBlocks.filter(
    (block) => block._id.toString() !== req.params.blockId
  );

  if (room.maintenanceBlocks.length === 0 && room.status === 'maintenance') {
    room.status = 'available';
    room.isAvailable = true;
  }
  await room.save();

  if (block) {
    await availabilityService.releaseManualBlocks(
      room._id,
      'MAINTENANCE',
      block.startDate,
      block.endDate
    ).catch(() => {});
  }

  await auditService.log(req, {
    action: 'maintenance_block_remove',
    entity: 'room',
    entityId: String(req.params.id),
    changes: block ? { startDate: block.startDate.toISOString(), endDate: block.endDate.toISOString(), reason: block.reason } : { blockId: req.params.blockId },
  });

  ApiResponse.success({ room }, 'Maintenance block removed').send(res);
});

const getRoomCalendar = asyncHandler(async (req, res) => {
  const { month, year } = req.query;
  const m = parseInt(month) || new Date().getMonth();
  const y = parseInt(year) || new Date().getFullYear();

  const startDate = new Date(y, m, 1);
  const endDate = new Date(y, m + 1, 0, 23, 59, 59);

  const rooms = await Room.find({});

  const blocksInMonth = await AvailabilityBlock.find({
    date: { $gte: new Date(startDate), $lt: endDate },
  }).lean();
  const blocksByRoom = new Map();
  blocksInMonth.forEach((b) => {
    const key = b.room.toString();
    if (!blocksByRoom.has(key)) blocksByRoom.set(key, []);
    blocksByRoom.get(key).push(b);
  });

  const allRoomsStats = await Promise.all(
    rooms.map(async (room) => {
      const bookings = await Booking.find({
        room: room._id,
        checkIn: { $lte: endDate },
        checkOut: { $gte: startDate },
        status: { $in: ['confirmed', 'checked_in', 'checked_out', 'pending'] },
      });

      const roomBlocks = blocksByRoom.get(room._id.toString()) || [];

      const days = [];
      for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
        const dateStr = d.toISOString().split('T')[0];
        const dayBookings = bookings.filter((b) => {
          const ci = new Date(b.checkIn).toISOString().split('T')[0];
          const co = new Date(b.checkOut).toISOString().split('T')[0];
          return dateStr >= ci && dateStr < co;
        });
        const isMaintenance = room.isDateBlockedForMaintenance(d);
        const blockHere = roomBlocks.find((b) => availabilityService.formatDay(b.date) === dateStr);
        days.push({
          date: dateStr,
          available: room.isDateAvailable(d) && !isMaintenance && !blockHere,
          booked: dayBookings.length > 0,
          bookingCount: dayBookings.length,
          maintenance: isMaintenance,
          blocked: !!blockHere,
          blockKind: blockHere ? blockHere.kind : null,
          checkIns: dayBookings.filter((b) => new Date(b.checkIn).toISOString().split('T')[0] === dateStr).map((b) => ({ bookingId: b._id, guest: b.guestName || (b.user ? b.user.toString() : '') })),
          checkOuts: dayBookings.filter((b) => new Date(b.checkOut).toISOString().split('T')[0] === dateStr).map((b) => ({ bookingId: b._id, guest: b.guestName || (b.user ? b.user.toString() : '') })),
        });
      }

      return {
        room: { _id: room._id, name: room.name, slug: room.slug, status: room.status, totalRooms: room.totalRooms },
        days,
      };
    })
  );

  ApiResponse.success({ calendar: allRoomsStats, month: m, year: y }).send(res);
});

module.exports = {
  getRooms,
  getRoom,
  getRoomBySlug,
  createRoom,
  updateRoom,
  deleteRoom,
  uploadRoomImages,
  deleteRoomImage,
  checkAvailability,
  getFeaturedRooms,
  updateRoomStatus,
  blockForMaintenance,
  removeMaintenanceBlock,
  getRoomCalendar,
};
