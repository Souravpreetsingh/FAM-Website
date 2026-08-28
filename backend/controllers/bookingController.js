const mongoose = require('mongoose');
const Booking = require('../models/Booking');
const Room = require('../models/Room');
const User = require('../models/User');
const ApiResponse = require('../utils/ApiResponse');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { createNotification } = require('./notificationController');
const { paginate, paginationResponse } = require('../utils/pagination');
const availabilityService = require('../services/availabilityService');

const { generateNights, checkStay, acquireDates, releaseBookingDates } = availabilityService;

/**
 * Shared reservation builder. Claims the dates FIRST via the atomic ledger so
 * concurrent bookings can never double-book; the Booking document is created
 * with the same _id used for the ledger rows so releases are tracked by booking.
 */
async function buildAndCreateReservation({
  roomId,
  checkInDate,
  checkOutDate,
  guests,
  specialRequests = '',
  guestName = '',
  guestEmail = '',
  guestPhone = '',
  source = 'ONLINE',
  notes = '',
  status = 'pending',
  actor = null,
}) {
  const room = await Room.findById(roomId);
  if (!room) throw ApiError.notFound('Room not found');
  if (room.status === 'maintenance' || room.status === 'out_of_service') {
    throw ApiError.badRequest('Room is currently out of service');
  }

  const start = availabilityService.toDay(checkInDate);
  const end = availabilityService.toDay(checkOutDate);
  const today = availabilityService.toDay(new Date());

  if (start < today) throw ApiError.badRequest('Check-in cannot be in the past');
  if (start >= end) throw ApiError.badRequest('Check-out must be after check-in');

  const nights = availabilityService.nightsBetween(start, end);
  if (nights < room.minStay) throw ApiError.badRequest(`Minimum stay is ${room.minStay} night(s)`);
  if (nights > room.maxStay) throw ApiError.badRequest(`Maximum stay is ${room.maxStay} night(s)`);
  if (guests.adults > room.capacity.maxGuests) {
    throw ApiError.badRequest(`Maximum ${room.capacity.maxGuests} guests allowed`);
  }

  const stay = await checkStay(room, start, end);
  if (!stay.available) {
    if (stay.reason === 'maintenance') throw ApiError.badRequest('Room is under maintenance during selected dates');
    throw ApiError.conflict('Room is not available for the selected dates');
  }

  const pricePerNight = room.discountPrice || room.pricePerNight;
  const totalAmount = pricePerNight * nights;
  const bookingId = new mongoose.Types.ObjectId();
  const nightDates = generateNights(start, end);

  await acquireDates(room, nightDates, {
    kind: 'BOOKED',
    bookingId,
    createdBy: actor ? actor._id : null,
  });

  const guestSource = source || 'ONLINE';
  let created;
  try {
    created = await Booking.create({
      _id: bookingId,
      user: actor && guestSource === 'ONLINE' ? actor._id : null,
      room: roomId,
      checkIn: start,
      checkOut: end,
      guests,
      totalAmount,
      amountPaid: 0,
      currency: room.currency || 'INR',
      nights,
      specialRequests,
      status,
      paymentStatus: 'pending',
      guestName,
      guestEmail,
      guestPhone,
      source: guestSource,
      notes,
      createdBy: actor ? actor._id : null,
    });
  } catch (err) {
    await releaseBookingDates(roomId, bookingId).catch(() => {});
    if (err.name === 'ValidationError') throw ApiError.badRequest(err.message);
    if (err.code === 11000) throw ApiError.conflict('Room is not available for the selected dates');
    throw err;
  }

  // Legacy mirror (best-effort so older code paths stay consistent)
  await availabilityService.mirrorBookedDates(roomId, start, end, bookingId).catch(() => {});
  if (actor) {
    await User.findByIdAndUpdate(actor._id, { $push: { bookings: bookingId } }).catch(() => {});
  }

  return { bookingId, totalAmount, nights };
}

const createBooking = asyncHandler(async (req, res) => {
  const {
    room: roomId,
    checkIn,
    checkOut,
    guests,
    specialRequests,
    guestName,
    guestEmail,
    guestPhone,
    notes,
  } = req.validated?.body || req.body || {};

  const actor = req.user || null;
  const result = await buildAndCreateReservation({
    roomId,
    checkInDate: checkIn,
    checkOutDate: checkOut,
    guests,
    specialRequests: specialRequests || '',
    guestName: guestName || actor?.name || '',
    guestEmail: guestEmail || actor?.email || '',
    guestPhone: guestPhone || actor?.phone || '',
    source: 'ONLINE',
    notes: notes || '',
    actor,
  });

  const booking = await Booking.findById(result.bookingId).populate('room').populate('user', 'name email phone');

  if (actor) {
    await createNotification(
      actor._id,
      'booking_submitted',
      'Booking Request Submitted',
      `Your booking for ${booking.room.name} has been submitted and is pending confirmation.`,
      `/dashboard/booking/${booking._id}`,
      { bookingId: booking._id, roomName: booking.room.name }
    ).catch(() => {});
  }

  ApiResponse.created({ booking }, 'Booking created successfully').send(res);
});

/** Staff/offline reservation: walk-in, phone, or admin-created bookings without an account. */
const createOfflineBooking = asyncHandler(async (req, res) => {
  const {
    room: roomId,
    checkIn,
    checkOut,
    guests,
    specialRequests,
    guestName,
    guestEmail,
    guestPhone,
    source,
    notes,
    status,
  } = req.validated?.body || req.body || {};

  const result = await buildAndCreateReservation({
    roomId,
    checkInDate: checkIn,
    checkOutDate: checkOut,
    guests,
    specialRequests: specialRequests || '',
    guestName: guestName || (req.user && req.user.name) || '',
    guestEmail: guestEmail || '',
    guestPhone: guestPhone || '',
    source: source || 'OFFLINE',
    notes: notes || '',
    status: status || 'pending',
    actor: req.user,
  });

  const booking = await Booking.findById(result.bookingId).populate('room').populate('user', 'name email phone');
  ApiResponse.created({ booking }, 'Reservation created successfully').send(res);
});

const getUserBookings = asyncHandler(async (req, res) => {
  const { page, limit, skip } = paginate(req.query.page, req.query.limit);
  const filter = { user: req.user._id };
  if (req.query.status) filter.status = req.query.status;

  const [bookings, total] = await Promise.all([
    Booking.find(filter)
      .populate('room', 'name images thumbnail slug pricePerNight')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Booking.countDocuments(filter),
  ]);

  ApiResponse.success({
    results: bookings,
    pagination: paginationResponse(total, page, limit),
  }).send(res);
});

const getBooking = asyncHandler(async (req, res) => {
  const booking = await Booking.findById(req.params.id)
    .populate('room')
    .populate('user', 'name email phone')
    .populate('payment');

  if (!booking) throw ApiError.notFound('Booking not found');
  const owner = booking.user && booking.user._id ? booking.user._id.toString() : null;
  if (!req.user || (owner && owner !== req.user._id.toString() && req.user.role !== 'admin')) {
    throw ApiError.forbidden('Not authorized to view this booking');
  }
  if (!owner && (!req.user || req.user.role !== 'admin')) {
    throw ApiError.forbidden('Not authorized to view this booking');
  }

  ApiResponse.success({ booking }).send(res);
});

const updateBooking = asyncHandler(async (req, res) => {
  const booking = await Booking.findById(req.params.id);
  if (!booking) throw ApiError.notFound('Booking not found');
  if (booking.user && booking.user.toString() === req.user._id.toString()) {
    if (!booking.canModify()) throw ApiError.badRequest('Cannot modify a booking in its current state');
  } else if (req.user.role !== 'admin') {
    throw ApiError.forbidden('Not authorized to update this booking');
  }

  const { checkIn, checkOut, guests, specialRequests } = req.body;

  let newCheckIn = booking.checkIn;
  let newCheckOut = booking.checkOut;

  if (checkIn) newCheckIn = new Date(checkIn);
  if (checkOut) newCheckOut = new Date(checkOut);

  if (newCheckIn >= newCheckOut) throw ApiError.badRequest('Check-out must be after check-in');
  const nights = availabilityService.nightsBetween(newCheckIn, newCheckOut);
  if (nights < 1) throw ApiError.badRequest('Minimum 1 night required');

  const room = await Room.findById(booking.room);
  if (room && guests?.adults && guests.adults > room.capacity.maxGuests) {
    throw ApiError.badRequest(`Maximum ${room.capacity.maxGuests} guests allowed`);
  }

  const datesChanged = availabilityService.toDay(newCheckIn).getTime() !== availabilityService.toDay(booking.checkIn).getTime() ||
    availabilityService.toDay(newCheckOut).getTime() !== availabilityService.toDay(booking.checkOut).getTime();

  if (datesChanged) {
    const stay = await checkStay(room, newCheckIn, newCheckOut, booking._id);
    if (!stay.available) {
      if (stay.reason === 'maintenance') throw ApiError.badRequest('Room is under maintenance during selected dates');
      throw ApiError.conflict('Room is not available for the selected dates');
    }

    await releaseBookingDates(booking.room, booking._id);
    await availabilityService.unMirrorBookedDates(booking.room, booking.checkIn, booking.checkOut, booking._id);

    const nightDates = generateNights(newCheckIn, newCheckOut);
    await acquireDates(room, nightDates, { kind: 'BOOKED', bookingId: booking._id, createdBy: req.user._id });
    await availabilityService.mirrorBookedDates(booking.room, newCheckIn, newCheckOut, booking._id);

    booking.checkIn = newCheckIn;
    booking.checkOut = newCheckOut;
    booking.nights = nights;
    if (room) {
      const ppn = room.discountPrice || room.pricePerNight;
      booking.totalAmount = ppn * nights;
    }
  }

  if (guests) {
    if (guests.adults) booking.guests.adults = guests.adults;
    if (guests.children !== undefined) booking.guests.children = guests.children;
  }
  if (specialRequests !== undefined) booking.specialRequests = specialRequests;

  await booking.save();

  if (booking.user) {
    await createNotification(
      booking.user._id || req.user._id,
      'booking_modified',
      'Booking Modified',
      'Your booking has been updated successfully.',
      `/dashboard/booking/${booking._id}`,
      { bookingId: booking._id }
    ).catch(() => {});
  }

  const populated = await Booking.findById(booking._id).populate('room').populate('user', 'name email phone');
  ApiResponse.success({ booking: populated }, 'Booking updated successfully').send(res);
});

const cancelBooking = asyncHandler(async (req, res) => {
  const booking = await Booking.findById(req.params.id).populate('room');
  if (!booking) throw ApiError.notFound('Booking not found');

  const owner = booking.user ? booking.user.toString() : null;
  const isOwner = owner && req.user && owner === req.user._id.toString();
  const isAdmin = req.user && req.user.role === 'admin';

  if (!isOwner) {
    if (!isAdmin) throw ApiError.forbidden('Not authorized to cancel this booking');
    if (!booking.canCancel()) throw ApiError.badRequest('Booking cannot be cancelled in its current state');
  } else {
    if (!booking.canCancel()) throw ApiError.badRequest('Booking cannot be cancelled in its current state');
  }

  booking.status = 'cancelled';
  booking.cancellationReason = req.body?.reason || '';
  booking.cancelledAt = new Date();
  const historyEntry = booking.statusHistory.find((e) => e.status === 'cancelled');
  if (historyEntry) historyEntry.note = booking.cancellationReason || 'Booking cancelled';
  await booking.save();

  await releaseBookingDates(booking.room, booking._id);
  await availabilityService.unMirrorBookedDates(booking.room, booking.checkIn, booking.checkOut, booking._id);

  const targetUser = booking.user || req.user;
  if (targetUser) {
    await createNotification(
      targetUser,
      'booking_cancelled',
      'Booking Cancelled',
      'Your booking has been cancelled.',
      `/dashboard/booking/${booking._id}`,
      { bookingId: booking._id }
    ).catch(() => {});
  }

  ApiResponse.success({ booking }, 'Booking cancelled successfully').send(res);
});

const getAllBookings = asyncHandler(async (req, res) => {
  const { page, limit, skip } = paginate(req.query.page, req.query.limit);
  const filter = {};
  if (req.query.status) filter.status = req.query.status;
  if (req.query.paymentStatus) filter.paymentStatus = req.query.paymentStatus;
  if (req.query.roomId) filter.room = req.query.roomId;
  if (req.query.userId) filter.user = req.query.userId;
  if (req.query.source) filter.source = req.query.source;
  if (req.query.fromDate) filter.checkIn = { $gte: new Date(req.query.fromDate) };
  if (req.query.toDate) {
    filter.checkOut = { ...filter.checkOut, $lte: new Date(req.query.toDate) };
  }
  if (req.query.search) {
    const search = { $regex: req.query.search, $options: 'i' };
    filter.$or = [{ guestName: search }, { guestEmail: search }, { guestPhone: search }];
  }

  const [bookings, total] = await Promise.all([
    Booking.find(filter)
      .populate('user', 'name email phone')
      .populate('room', 'name images thumbnail slug')
      .populate('payment')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Booking.countDocuments(filter),
  ]);

  ApiResponse.success({
    bookings,
    pagination: paginationResponse(total, page, limit),
  }).send(res);
});

const confirmBooking = asyncHandler(async (req, res) => {
  const booking = await Booking.findById(req.params.id).populate('room').populate('user', 'name email');
  if (!booking) throw ApiError.notFound('Booking not found');
  if (!Booking.isValidTransition(booking.status, 'confirmed')) {
    throw ApiError.badRequest(`Cannot confirm a ${booking.status} booking`);
  }

  booking.status = 'confirmed';
  const historyEntry = booking.statusHistory.find((e) => e.status === 'confirmed');
  if (historyEntry) historyEntry.changedBy = req.user?.email || 'admin';
  await booking.save();

  if (booking.user) {
    await createNotification(
      booking.user._id,
      'booking_confirmed',
      'Booking Confirmed',
      `Your booking for ${booking.room?.name || 'the room'} has been confirmed.`,
      `/dashboard/booking/${booking._id}`,
      { bookingId: booking._id, roomName: booking.room?.name }
    ).catch(() => {});
  }

  ApiResponse.success({ booking }, 'Booking confirmed successfully').send(res);
});

const checkInBooking = asyncHandler(async (req, res) => {
  const booking = await Booking.findById(req.params.id).populate('room');
  if (!booking) throw ApiError.notFound('Booking not found');
  if (!Booking.isValidTransition(booking.status, 'checked_in')) {
    throw ApiError.badRequest(`Cannot check in a ${booking.status} booking`);
  }

  booking.status = 'checked_in';
  const historyEntry = booking.statusHistory.find((e) => e.status === 'checked_in');
  if (historyEntry) historyEntry.changedBy = req.user?.email || 'admin';
  await booking.save();

  await Room.findByIdAndUpdate(booking.room, { status: 'occupied' });

  ApiResponse.success({ booking }, 'Guest checked in successfully').send(res);
});

const checkOutBooking = asyncHandler(async (req, res) => {
  const booking = await Booking.findById(req.params.id).populate('room');
  if (!booking) throw ApiError.notFound('Booking not found');
  if (!Booking.isValidTransition(booking.status, 'checked_out')) {
    throw ApiError.badRequest(`Cannot check out a ${booking.status} booking`);
  }

  booking.status = 'checked_out';
  const historyEntry = booking.statusHistory.find((e) => e.status === 'checked_out');
  if (historyEntry) historyEntry.changedBy = req.user?.email || 'admin';
  await booking.save();

  await Room.findByIdAndUpdate(booking.room, { status: 'cleaning' });

  ApiResponse.success({ booking }, 'Guest checked out successfully').send(res);
});

const markNoShow = asyncHandler(async (req, res) => {
  const booking = await Booking.findById(req.params.id);
  if (!booking) throw ApiError.notFound('Booking not found');
  if (!Booking.isValidTransition(booking.status, 'no_show')) {
    throw ApiError.badRequest(`Cannot mark no-show for a ${booking.status} booking`);
  }

  booking.status = 'no_show';
  const historyEntry = booking.statusHistory.find((e) => e.status === 'no_show');
  if (historyEntry) historyEntry.changedBy = req.user?.email || 'admin';
  await booking.save();

  ApiResponse.success({ booking }, 'Marked as no-show').send(res);
});

const moveBookingRoom = asyncHandler(async (req, res) => {
  const { newRoomId } = req.body;
  if (!newRoomId) throw ApiError.badRequest('New room ID is required');

  const booking = await Booking.findById(req.params.id);
  if (!booking) throw ApiError.notFound('Booking not found');
  if (booking.status !== 'confirmed' && booking.status !== 'pending') {
    throw ApiError.badRequest('Can only move confirmed or pending bookings');
  }

  const newRoom = await Room.findById(newRoomId);
  if (!newRoom) throw ApiError.notFound('New room not found');

  const stay = await checkStay(newRoom, booking.checkIn, booking.checkOut, booking._id);
  if (!stay.available) throw ApiError.conflict('New room is not available for the selected dates');

  const oldRoom = booking.room;
  await releaseBookingDates(oldRoom, booking._id);
  await availabilityService.unMirrorBookedDates(oldRoom, booking.checkIn, booking.checkOut, booking._id);

  booking.previousRoom = oldRoom;
  booking.room = newRoomId;

  const nightDates = generateNights(booking.checkIn, booking.checkOut);
  await acquireDates(newRoom, nightDates, { kind: 'BOOKED', bookingId: booking._id, createdBy: req.user?._id || null });
  await availabilityService.mirrorBookedDates(newRoomId, booking.checkIn, booking.checkOut, booking._id);

  const historyEntry = booking.statusHistory.find((e) => e.status === booking.status);
  if (historyEntry) historyEntry.note = `Moved to room: ${newRoom.name}`;

  await booking.save();

  const populated = await Booking.findById(booking._id).populate('room');
  ApiResponse.success({ booking: populated }, 'Booking moved to new room').send(res);
});

/** Admin edit of any reservation (dates, room, guests, status, payment, notes). */
const updateReservation = asyncHandler(async (req, res) => {
  const booking = await Booking.findById(req.params.id);
  if (!booking) throw ApiError.notFound('Booking not found');

  const {
    checkIn,
    checkOut,
    room: newRoomId,
    guests,
    specialRequests,
    status,
    paymentStatus,
    amountPaid,
    notes,
    guestName,
    guestEmail,
    guestPhone,
  } = req.validated?.body || req.body || {};

  let newCheckIn = booking.checkIn;
  let newCheckOut = booking.checkOut;
  let targetRoomId = booking.room;

  const roomChanged = newRoomId && newRoomId !== booking.room.toString();
  if (checkIn) newCheckIn = new Date(checkIn);
  if (checkOut) newCheckOut = new Date(checkOut);
  if (roomChanged) {
    const target = await Room.findById(newRoomId);
    if (!target) throw ApiError.notFound('New room not found');
    targetRoomId = target._id;
  }

  if (newCheckIn >= newCheckOut) throw ApiError.badRequest('Check-out must be after check-in');
  const nights = availabilityService.nightsBetween(newCheckIn, newCheckOut);
  if (nights < 1) throw ApiError.badRequest('Minimum 1 night required');

  const stayRoom = await Room.findById(targetRoomId);
  const stay = await checkStay(stayRoom, newCheckIn, newCheckOut, booking._id);
  if (!stay.available) {
    if (stay.reason === 'maintenance') throw ApiError.badRequest('Room is under maintenance during selected dates');
    throw ApiError.conflict('Room is not available for the selected dates');
  }

  const datesChanged = availabilityService.toDay(newCheckIn).getTime() !== availabilityService.toDay(booking.checkIn).getTime() ||
    availabilityService.toDay(newCheckOut).getTime() !== availabilityService.toDay(booking.checkOut).getTime();

  if (datesChanged || roomChanged) {
    await releaseBookingDates(booking.room, booking._id);
    await availabilityService.unMirrorBookedDates(booking.room, booking.checkIn, booking.checkOut, booking._id);

    const nightDates = generateNights(newCheckIn, newCheckOut);
    await acquireDates(stayRoom, nightDates, { kind: 'BOOKED', bookingId: booking._id, createdBy: req.user?._id || null });
    await availabilityService.mirrorBookedDates(targetRoomId, newCheckIn, newCheckOut, booking._id);

    booking.checkIn = newCheckIn;
    booking.checkOut = newCheckOut;
    booking.nights = nights;
    if (roomChanged) {
      booking.previousRoom = booking.room;
      booking.room = targetRoomId;
    }
    if (stayRoom) {
      const ppn = stayRoom.discountPrice || stayRoom.pricePerNight;
      booking.totalAmount = ppn * nights;
    }
  }

  if (guests) {
    if (guests.adults !== undefined) booking.guests.adults = guests.adults;
    if (guests.children !== undefined) booking.guests.children = guests.children;
  }
  if (specialRequests !== undefined) booking.specialRequests = specialRequests;
  if (notes !== undefined) booking.notes = notes;
  if (guestName !== undefined) booking.guestName = guestName;
  if (guestEmail !== undefined) booking.guestEmail = guestEmail;
  if (guestPhone !== undefined) booking.guestPhone = guestPhone;
  if (amountPaid !== undefined) booking.amountPaid = amountPaid;

  if (status && status !== booking.status) {
    if (!Booking.isValidTransition(booking.status, status)) {
      throw ApiError.badRequest(`Cannot change status from ${booking.status} to ${status}`);
    }
    booking.status = status;
  }
  if (paymentStatus && paymentStatus !== booking.paymentStatus) {
    booking.paymentStatus = paymentStatus;
    if (paymentStatus !== 'pending' && paymentStatus !== 'failed') {
      if (amountPaid === undefined) booking.amountPaid = paymentStatus === 'paid' ? booking.totalAmount : booking.amountPaid;
    }
  }

  await booking.save();

  const populated = await Booking.findById(booking._id).populate('room').populate('user', 'name email phone');
  ApiResponse.success({ booking: populated }, 'Reservation updated successfully').send(res);
});

const getBookingTimeline = asyncHandler(async (req, res) => {
  const booking = await Booking.findById(req.params.id);
  if (!booking) throw ApiError.notFound('Booking not found');

  const owner = booking.user ? booking.user.toString() : null;
  const isOwner = owner && req.user && owner === req.user._id.toString();
  if (!isOwner && !(req.user && req.user.role === 'admin')) {
    throw ApiError.forbidden('Not authorized');
  }

  const timeline = booking.statusHistory.map((entry) => ({
    status: entry.status,
    changedAt: entry.changedAt,
    changedBy: entry.changedBy,
    note: entry.note,
  }));

  ApiResponse.success({ timeline, currentStatus: booking.status }).send(res);
});

const getBookingCalendar = asyncHandler(async (req, res) => {
  const { month, year, roomId } = req.query;
  const m = parseInt(month) || new Date().getMonth();
  const y = parseInt(year) || new Date().getFullYear();

  const startDate = new Date(y, m, 1);
  const endDate = new Date(y, m + 1, 0, 23, 59, 59);

  const filter = {};
  if (roomId) filter.room = roomId;

  const bookings = await Booking.find({
    ...filter,
    checkIn: { $lte: endDate },
    checkOut: { $gte: startDate },
    status: { $in: ['confirmed', 'checked_in', 'checked_out', 'pending'] },
  })
    .populate('room', 'name')
    .populate('user', 'name');

  const calendar = [];
  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
    const dateStr = d.toISOString().split('T')[0];
    const dayBookings = bookings.filter((b) => {
      const ci = new Date(b.checkIn).toISOString().split('T')[0];
      const co = new Date(b.checkOut).toISOString().split('T')[0];
      return dateStr >= ci && dateStr < co;
    });
    calendar.push({ date: dateStr, bookings: dayBookings.map((b) => ({ id: b._id, guest: b.guestName || b.user?.name || 'Guest', room: b.room?.name || 'Room', status: b.status })) });
  }

  ApiResponse.success({ calendar, month: m, year: y }).send(res);
});

module.exports = {
  createBooking,
  createOfflineBooking,
  getUserBookings,
  getBooking,
  updateBooking,
  updateReservation,
  cancelBooking,
  getAllBookings,
  confirmBooking,
  checkInBooking,
  checkOutBooking,
  markNoShow,
  moveBookingRoom,
  getBookingTimeline,
  getBookingCalendar,
};