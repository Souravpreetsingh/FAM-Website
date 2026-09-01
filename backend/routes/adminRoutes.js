const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const reviewController = require('../controllers/reviewController');
const bookingController = require('../controllers/bookingController');
const roomController = require('../controllers/roomController');
const availabilityController = require('../controllers/availabilityController');
const { authenticate, authorizeAdmin } = require('../middleware/auth');
const validate = require('../middleware/validate');
const adminValidation = require('../validations/adminValidation');

router.post('/login', validate(adminValidation.adminLoginSchema), adminController.adminLogin);

// Session management endpoints. These sit outside the admin authorisation gate
// because refresh and logout must be reachable even when the (short-lived)
// access token has expired.
router.post('/refresh', adminController.adminRefresh);
router.post('/logout', authenticate, adminController.adminLogout);

router.use(authenticate, authorizeAdmin);

router.get('/session', adminController.adminSession);

router.get('/dashboard', adminController.getDashboard);

router.get('/users', adminController.getUsers);
router.get('/users/:id', adminController.getUserDetails);
router.put('/users/:id/role', validate(adminValidation.updateUserRoleSchema), adminController.updateUserRole);
router.delete('/users/:id', adminController.deleteUser);

router.get('/rooms', adminController.getAdminRooms);
router.put('/rooms/:id/status', roomController.updateRoomStatus);
router.post(
  '/rooms/:id/maintenance',
  validate(adminValidation.blockParamsSchema),
  roomController.blockForMaintenance
);
router.delete('/rooms/:id/maintenance/:blockId', roomController.removeMaintenanceBlock);

router.get('/availability/calendar', availabilityController.getAvailabilityCalendar);
router.post(
  '/availability/block',
  validate(adminValidation.createAvailabilityBlockSchema),
  availabilityController.createBlock
);
router.delete(
  '/availability/block/:blockId',
  validate(adminValidation.removeBlockParamsSchema),
  availabilityController.removeBlock
);
router.post(
  '/availability/clear',
  validate(adminValidation.clearAvailabilitySchema),
  availabilityController.clearRange
);

router.get('/bookings', bookingController.getAllBookings);
router.post(
  '/bookings/offline',
  validate(adminValidation.createOfflineBookingSchema),
  bookingController.createOfflineBooking
);
router.patch(
  '/bookings/reservations/:id',
  validate(adminValidation.updateReservationSchema),
  bookingController.updateReservation
);
router.put('/bookings/:id/confirm', bookingController.confirmBooking);
router.put('/bookings/:id/check-in', bookingController.checkInBooking);
router.put('/bookings/:id/check-out', bookingController.checkOutBooking);
router.put('/bookings/:id/no-show', bookingController.markNoShow);
router.put('/bookings/:id/move-room', validate(adminValidation.moveRoomSchema), bookingController.moveBookingRoom);
router.post('/bookings/:id/cancel', bookingController.cancelBooking);
router.get('/bookings/calendar', bookingController.getBookingCalendar);

router.get('/audit-logs', adminController.getAuditLogs);

router.get('/revenue', adminController.getRevenueAnalytics);
router.get('/reports/bookings', adminController.getBookingReports);
router.get('/reports/occupancy', adminController.getOccupancyReport);
router.get('/reports/popular-rooms', adminController.getPopularRooms);
router.get('/reports/trends', adminController.getBookingTrends);

router.get('/reviews', reviewController.getAllReviews);
router.put('/reviews/:id/approve', reviewController.approveReview);

module.exports = router;