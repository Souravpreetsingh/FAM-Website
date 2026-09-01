const Booking = require('../models/Booking');
const Room = require('../models/Room');
const User = require('../models/User');
const Review = require('../models/Review');
const Contact = require('../models/Contact');
const AuditLog = require('../models/AuditLog');
const AvailabilityBlock = require('../models/AvailabilityBlock');
const ApiResponse = require('../utils/ApiResponse');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const authService = require('../services/authService');
const availabilityService = require('../services/availabilityService');
const auditService = require('../services/auditService');
const { paginate, paginationResponse } = require('../utils/pagination');

const { setAdminAuthCookies, clearAdminAuthCookies } = require('../utils/adminCookies');

const adminLogin = asyncHandler(async (req, res) => {
  const { email, password } = req.validated?.body || req.body || {};
  const result = await authService.login(email, password);
  if (!result.user || result.user.role !== 'admin') {
    throw ApiError.forbidden('Admin access required');
  }

  setAdminAuthCookies(res, {
    accessToken: result.accessToken,
    refreshToken: result.refreshToken,
  });

  await auditService.log(req, {
    action: 'admin_login',
    entity: 'auth',
    entityId: String(result.user._id),
  });

  // Access/refresh tokens are delivered via httpOnly cookies so they are not
  // exposed to JavaScript. The user object is returned so the admin UI can
  // render the current session without reading tokens.
  ApiResponse.success({
    user: result.user,
    sessionInitialized: true,
  }, 'Admin login successful').send(res);
});

/** Rotate the admin refresh token and issue a fresh access token (httpOnly cookies). */
const adminRefresh = asyncHandler(async (req, res) => {
  const refreshToken = req.cookies && req.cookies.refresh_token;
  if (!refreshToken) {
    throw ApiError.unauthorized('Refresh token is required');
  }
  const tokens = await authService.refreshAccessToken(refreshToken);
  setAdminAuthCookies(res, tokens);
  const decoded = require('../utils/generateToken').verifyAccessToken(tokens.accessToken);
  const sessionUser = await User.findById(decoded.id);
  ApiResponse.success({ sessionInitialized: true, user: sessionUser }, 'Session refreshed successfully').send(res);
});

/** Admin logout — invalidates the refresh token and clears auth cookies. */
const adminLogout = asyncHandler(async (req, res) => {
  const refreshToken = req.cookies && req.cookies.refresh_token;
  if (refreshToken && req.user) {
    await authService.logout(req.user._id, refreshToken);
  }
  clearAdminAuthCookies(res);
  ApiResponse.success(null, 'Logged out successfully').send(res);
});

/** Returns the authenticated admin's identity (used to validate page reloads). */
const adminSession = asyncHandler(async (req, res) => {
  ApiResponse.success({ user: req.user }, 'Authenticated').send(res);
});

const getDashboard = asyncHandler(async (req, res) => {
  const [
    totalBookings,
    totalRooms,
    totalUsers,
    pendingBookings,
    confirmedBookings,
    checkedIn,
    pendingReviews,
    unreadMessages,
    activeBookings,
    revenueResult,
    bookingStats,
  ] = await Promise.all([
    Booking.countDocuments(),
    Room.countDocuments(),
    User.countDocuments(),
    Booking.countDocuments({ status: 'pending' }),
    Booking.countDocuments({ status: 'confirmed' }),
    Booking.countDocuments({ status: 'checked_in' }),
    Review.countDocuments({ isApproved: false }),
    Contact.countDocuments({ isRead: false }),
    Booking.countDocuments({ status: { $in: ['confirmed', 'checked_in'] } }),
    Booking.aggregate([
      { $match: { paymentStatus: 'paid' } },
      { $group: { _id: null, total: { $sum: '$totalAmount' } } },
    ]),
    Booking.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),
  ]);

  const totalRevenue = revenueResult.length > 0 ? revenueResult[0].total : 0;

  const now = new Date();
  const sixMonthsAgo = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5, 1));
  const revenueByMonth = await Booking.aggregate([
    {
      $match: {
        createdAt: { $gte: sixMonthsAgo },
        paymentStatus: 'paid',
      },
    },
    {
      $group: {
        _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } },
        revenue: { $sum: '$totalAmount' },
        bookings: { $sum: 1 },
      },
    },
    { $sort: { '_id.year': 1, '_id.month': 1 } },
  ]);

  const recentBookings = await Booking.find()
    .populate('user', 'name email')
    .populate('room', 'name')
    .sort({ createdAt: -1 })
    .limit(5);

  const today = availabilityService.toDay(new Date());
  const tomorrow = new Date(today);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);

  const [todayCheckIns, todayCheckOuts, upcomingStays, roomsStatus] = await Promise.all([
    Booking.countDocuments({
      checkIn: { $gte: today, $lt: tomorrow },
      status: { $in: ['pending', 'confirmed', 'checked_in', 'checked_out'] },
    }),
    Booking.countDocuments({
      checkOut: { $gte: today, $lt: tomorrow },
      status: { $in: ['checked_in', 'checked_out', 'confirmed'] },
    }),
    Booking.countDocuments({
      checkIn: { $gte: tomorrow },
      checkOut: { $gte: tomorrow },
      status: { $in: ['pending', 'confirmed'] },
    }),
    Room.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
  ]);

  const roomsList = await Room.find({}, 'name slug status isAvailable');
  const availabilitySnapshot = await Promise.all(
    roomsList.map(async (room) => {
      const day = await availabilityService.getBlocksForRange(room._id, today, tomorrow);
      const activeBooking = await Booking.findOne({
        room: room._id,
        checkIn: { $lt: tomorrow },
        checkOut: { $gt: today },
        status: { $in: ['pending', 'confirmed', 'checked_in', 'checked_out'] },
      });
      return {
        roomId: room._id,
        name: room.name,
        slug: room.slug,
        status: room.status,
        isAvailable: room.isAvailable,
        blockedToday: day.length > 0,
        blockKind: day.length ? day[0].kind : null,
        currentGuest: activeBooking ? (activeBooking.guestName || null) : null,
      };
    })
  );

  ApiResponse.success({
    stats: {
      totalBookings,
      totalRooms,
      totalUsers,
      pendingBookings,
      confirmedBookings,
      checkedIn,
      activeBookings,
      pendingReviews,
      unreadMessages,
      totalRevenue,
    },
    availability: {
      today: availabilityService.formatDay(today),
      todayCheckIns,
      todayCheckOuts,
      upcomingStays,
      roomsByStatus: roomsStatus.map((s) => ({ status: s._id, count: s.count })),
      rooms: availabilitySnapshot,
    },
    recentBookings,
    revenueByMonth: revenueByMonth.map((r) => ({
      month: `${r._id.year}-${String(r._id.month).padStart(2, '0')}`,
      revenue: r.revenue,
      bookings: r.bookings,
    })),
    bookingStats: bookingStats.map((s) => ({ status: s._id, count: s.count })),
  }).send(res);
});

const getUsers = asyncHandler(async (req, res) => {
  const { page, limit, skip } = paginate(req.query.page, req.query.limit);
  const filter = { isDeleted: { $ne: true } };

  if (req.query.role) filter.role = req.query.role;
  if (req.query.isVerified !== undefined) filter.isVerified = req.query.isVerified === 'true';
  if (req.query.search) {
    filter.$or = [
      { name: { $regex: req.query.search, $options: 'i' } },
      { email: { $regex: req.query.search, $options: 'i' } },
    ];
  }

  const [users, total] = await Promise.all([
    User.find(filter).select('-refreshTokens').sort({ createdAt: -1 }).skip(skip).limit(limit),
    User.countDocuments(filter),
  ]);

  ApiResponse.success({
    users,
    pagination: paginationResponse(total, page, limit),
  }).send(res);
});

const getUserDetails = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id)
    .select('-refreshTokens')
    .populate({ path: 'bookings', options: { sort: { createdAt: -1 }, limit: 20 }, populate: { path: 'room', select: 'name' } });
  if (!user) throw ApiError.notFound('User not found');
  ApiResponse.success({ user }).send(res);
});

const updateUserRole = asyncHandler(async (req, res) => {
  const { role } = req.body;
  if (!['guest', 'admin'].includes(role)) throw ApiError.badRequest('Invalid role');
  const prev = await User.findById(req.params.id);
  if (!prev) throw ApiError.notFound('User not found');
  const user = await User.findByIdAndUpdate(req.params.id, { role }, { new: true });
  await auditService.log(req, {
    action: 'update_user_role',
    entity: 'user',
    entityId: String(req.params.id),
    changes: { from: prev.role, to: role, email: prev.email },
  });
  ApiResponse.success({ user }, 'User role updated').send(res);
});

const deleteUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) throw ApiError.notFound('User not found');

  // Safety: never allow soft-deleting an administrator via this flow.
  if (user.role === 'admin') {
    throw ApiError.badRequest('Administrator accounts cannot be deleted');
  }

  // Explicit confirmation is required at the business-logic level before a
  // user with a booking history can be removed.
  if (req.body && req.body.confirm !== true) {
    throw ApiError.badRequest('Deletion requires explicit confirmation (confirm: true)');
  }

  // Release availability ledger rows only for the user's ACTIVE bookings.
  // Cancelled / completed / historical bookings already released their dates
  // and are intentionally left intact to preserve reporting history.
  const activeBookings = await Booking.find({
    user: user._id,
    status: { $in: availabilityService.ACTIVE_BOOKING_STATUSES },
  }).select('room');

  for (const b of activeBookings) {
    if (b.room) {
      await availabilityService.releaseBookingDates(b.room, b._id).catch(() => {});
      await availabilityService.unMirrorBookedDates(b.room, b.checkIn, b.checkOut, b._id).catch(() => {});
    }
  }

  // Soft-delete: keep the historical record for reports/consistency while
  // revoking all active sessions so the account can no longer sign in.
  user.isDeleted = true;
  user.refreshTokens = [];
  await user.save();

  await auditService.log(req, {
    action: 'delete_user',
    entity: 'user',
    entityId: String(req.params.id),
    changes: { email: user.email, name: user.name, releasedActiveBookings: activeBookings.length },
  });

  ApiResponse.success(null, 'User deleted successfully').send(res);
});

const getRevenueAnalytics = asyncHandler(async (req, res) => {
  const { from, to } = req.query;
  const filter = { paymentStatus: 'paid' };
  if (from) filter.createdAt = { $gte: new Date(from) };
  if (to) filter.createdAt = { ...filter.createdAt, $lte: new Date(to) };

  const [totalRevenue, totalBookings, revenueByRoom, revenueByMonth] = await Promise.all([
    Booking.aggregate([{ $match: filter }, { $group: { _id: null, total: { $sum: '$totalAmount' } } }]),
    Booking.countDocuments(filter),
    Booking.aggregate([
      { $match: filter },
      { $group: { _id: '$room', revenue: { $sum: '$totalAmount' }, bookings: { $sum: 1 } } },
      { $sort: { revenue: -1 } },
      { $limit: 10 },
      { $lookup: { from: 'rooms', localField: '_id', foreignField: '_id', as: 'room' } },
      { $unwind: { path: '$room', preserveNullAndEmptyArrays: true } },
      { $project: { roomName: '$room.name', revenue: 1, bookings: 1 } },
    ]),
    Booking.aggregate([
      { $match: filter },
      {
        $group: {
          _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } },
          revenue: { $sum: '$totalAmount' },
          bookings: { $sum: 1 },
        },
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
    ]),
  ]);

  ApiResponse.success({
    totalRevenue: totalRevenue[0]?.total || 0,
    totalPaidBookings: totalBookings,
    totalBookings: await Booking.countDocuments(),
    revenueByRoom,
    revenueByMonth: revenueByMonth.map((r) => ({
      month: `${r._id.year}-${String(r._id.month).padStart(2, '0')}`,
      revenue: r.revenue,
      bookings: r.bookings,
    })),
  }).send(res);
});

const getBookingReports = asyncHandler(async (req, res) => {
  const { period, from, to } = req.query;
  const now = new Date();
  const today = availabilityService.toDay(now);

  // Period boundaries are normalised to UTC days so they match the same model
  // used by the availability ledger (avoiding server-local timezone drift).
  let startDate;
  switch (period) {
    case 'daily':
      startDate = today;
      break;
    case 'weekly':
      startDate = new Date(today);
      startDate.setUTCDate(startDate.getUTCDate() - 7);
      break;
    case 'monthly':
      startDate = availabilityService.toDay(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)));
      break;
    case 'custom':
      startDate = from ? availabilityService.toDay(from) : availabilityService.toDay(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)));
      break;
    default:
      startDate = availabilityService.toDay(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)));
  }
  const endDate = to ? new Date(to) : now;

  const [bookings, statusBreakdown, dailyBookings] = await Promise.all([
    Booking.find({ createdAt: { $gte: startDate, $lte: endDate } })
      .populate('room', 'name')
      .sort({ createdAt: -1 }),
    Booking.aggregate([
      { $match: { createdAt: { $gte: startDate, $lte: endDate } } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),
    Booking.aggregate([
      { $match: { createdAt: { $gte: startDate, $lte: endDate } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          count: { $sum: 1 },
          revenue: { $sum: '$totalAmount' },
        },
      },
      { $sort: { _id: 1 } },
    ]),
  ]);

  ApiResponse.success({
    period,
    startDate,
    endDate,
    totalBookings: bookings.length,
    totalRevenue: bookings.reduce((sum, b) => sum + b.totalAmount, 0),
    statusBreakdown: statusBreakdown.map((s) => ({ status: s._id, count: s.count })),
    dailyBookings: dailyBookings.map((d) => ({ date: d._id, count: d.count, revenue: d.revenue })),
    bookings,
  }).send(res);
});

const getOccupancyReport = asyncHandler(async (req, res) => {
  const { month, year } = req.query;
  const mRaw = parseInt(month);
  const yRaw = parseInt(year);
  const m = Number.isInteger(mRaw) && mRaw >= 0 && mRaw <= 11 ? mRaw : new Date().getUTCMonth();
  const y = Number.isInteger(yRaw) && yRaw >= 2000 ? yRaw : new Date().getUTCFullYear();

  // Month range in UTC day space — aligned with the availability ledger.
  const startDate = availabilityService.toDay(new Date(Date.UTC(y, m, 1)));
  const endDate = availabilityService.toDay(new Date(Date.UTC(y, m + 1, 1)));
  const daysInMonth = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();

  const rooms = await Room.find({});
  const roomStats = await Promise.all(
    rooms.map(async (room) => {
      const bookings = await Booking.find({
        room: room._id,
        checkIn: { $lt: endDate },
        checkOut: { $gt: startDate },
        status: { $in: ['confirmed', 'checked_in', 'checked_out', 'completed'] },
      });

      let bookedNights = 0;
      for (const b of bookings) {
        const ci = availabilityService.toDay(Math.max(b.checkIn.getTime(), startDate.getTime()));
        const co = availabilityService.toDay(Math.min(b.checkOut.getTime(), endDate.getTime()));
        bookedNights += Math.max(0, availabilityService.nightsBetween(ci, co));
      }

      const totalPossibleNights = daysInMonth * room.totalRooms;
      const occupancyRate = totalPossibleNights > 0 ? (bookedNights / totalPossibleNights) * 100 : 0;

      return {
        roomId: room._id,
        roomName: room.name,
        totalRooms: room.totalRooms,
        bookedNights,
        totalPossibleNights,
        occupancyRate: Math.round(occupancyRate * 100) / 100,
        status: room.status,
      };
    })
  );

  const overallOccupancy = roomStats.length > 0
    ? Math.round((roomStats.reduce((s, r) => s + r.occupancyRate, 0) / roomStats.length) * 100) / 100
    : 0;

  ApiResponse.success({
    month: m,
    year: y,
    daysInMonth,
    totalRooms: rooms.length,
    overallOccupancy,
    roomStats,
  }).send(res);
});

const getPopularRooms = asyncHandler(async (req, res) => {
  const { limit: queryLimit } = req.query;
  const limit = parseInt(queryLimit) || 10;

  const popular = await Booking.aggregate([
    { $match: { status: { $in: ['confirmed', 'checked_in', 'checked_out', 'completed'] } } },
    { $group: { _id: '$room', bookings: { $sum: 1 }, totalRevenue: { $sum: '$totalAmount' } } },
    { $sort: { bookings: -1 } },
    { $limit: limit },
    { $lookup: { from: 'rooms', localField: '_id', foreignField: '_id', as: 'room' } },
    { $unwind: '$room' },
    { $project: { roomName: '$room.name', slug: '$room.slug', thumbnail: '$room.thumbnail', bookings: 1, totalRevenue: 1 } },
  ]);

  ApiResponse.success({ popular }).send(res);
});

const getBookingTrends = asyncHandler(async (req, res) => {
  const months = parseInt(req.query.months) || 12;

  const now = new Date();
  // UTC month-aligned start so monthly bucketing stays consistent.
  const startDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - months, 1));

  const trends = await Booking.aggregate([
    { $match: { createdAt: { $gte: startDate } } },
    {
      $group: {
        _id: {
          year: { $year: '$createdAt' },
          month: { $month: '$createdAt' },
        },
        bookings: { $sum: 1 },
        revenue: { $sum: '$totalAmount' },
        cancelled: { $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] } },
        completed: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
      },
    },
    { $sort: { '_id.year': 1, '_id.month': 1 } },
  ]);

  ApiResponse.success({
    trends: trends.map((t) => ({
      month: `${t._id.year}-${String(t._id.month).padStart(2, '0')}`,
      bookings: t.bookings,
      revenue: t.revenue,
      cancelled: t.cancelled,
      completed: t.completed,
    })),
  }).send(res);
});

const getAdminRooms = asyncHandler(async (req, res) => {
  const { page, limit, skip } = paginate(req.query.page, req.query.limit);
  const filter = {};
  if (req.query.search) {
    filter.$or = [
      { name: { $regex: req.query.search, $options: 'i' } },
      { slug: { $regex: req.query.search, $options: 'i' } },
    ];
  }
  if (req.query.status) {
    filter.status = req.query.status === 'available' ? { $in: ['available'] } : req.query.status;
  }

  const [rooms, total] = await Promise.all([
    Room.find(filter).sort({ createdAt: 1 }).skip(skip).limit(limit),
    Room.countDocuments(filter),
  ]);

  const today = availabilityService.toDay(new Date());
  const tomorrow = new Date(today);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);

  const bookedRoomIds = await Booking.find({
    checkIn: { $lt: tomorrow },
    checkOut: { $gt: today },
    status: { $in: ['pending', 'confirmed', 'checked_in', 'checked_out'] },
  }).distinct('room');

  const blockedRoomIds = await AvailabilityBlock.distinct('room', {
    date: { $gte: today, $lt: tomorrow },
  });

  ApiResponse.success({
    rooms: rooms.map((room) => {
      const r = room.toObject();
      r.currentlyOccupied = bookedRoomIds.some((id) => String(id) === String(room._id));
      r.blockedToday = blockedRoomIds.some((id) => String(id) === String(room._id));
      return r;
    }),
    pagination: paginationResponse(total, page, limit),
  }).send(res);
});

const getAuditLogs = asyncHandler(async (req, res) => {
  const { page, limit, skip } = paginate(req.query.page, req.query.limit);
  const filter = {};
  if (req.query.adminEmail) filter.adminEmail = { $regex: req.query.adminEmail, $options: 'i' };
  if (req.query.action) filter.action = { $regex: req.query.action, $options: 'i' };

  const [logs, total] = await Promise.all([
    AuditLog.find(filter)
      .populate('admin', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    AuditLog.countDocuments(filter),
  ]);

  ApiResponse.success({
    logs,
    pagination: paginationResponse(total, page, limit),
  }).send(res);
});

module.exports = {
  adminLogin,
  adminRefresh,
  adminLogout,
  adminSession,
  getDashboard,
  getUsers,
  getUserDetails,
  updateUserRole,
  deleteUser,
  getRevenueAnalytics,
  getBookingReports,
  getOccupancyReport,
  getPopularRooms,
  getBookingTrends,
  getAdminRooms,
  getAuditLogs,
};
