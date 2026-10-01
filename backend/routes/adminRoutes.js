const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const adminController = require('../controllers/adminController');
const reviewController = require('../controllers/reviewController');
const bookingController = require('../controllers/bookingController');
const roomController = require('../controllers/roomController');
const availabilityController = require('../controllers/availabilityController');
const { authenticate, authorizeAdmin } = require('../middleware/auth');
const validate = require('../middleware/validate');
const adminValidation = require('../validations/adminValidation');
const upload = require('../middleware/upload');
const siteImageController = require('../controllers/siteImageController');
const journalController = require('../controllers/journalController');
const journalValidation = require('../validations/journalValidation');

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

// Site-wide image manager. Every public image slot is addressable by a stable
// key; these routes list them, upload replacements to Cloudinary and apply or
// revert an override.
router.get('/site-images', siteImageController.getSiteImages);
router.get('/site-images/library', siteImageController.getLibrary);
router.post('/site-images/upload', upload.single('image'), siteImageController.uploadImage);
router.put('/site-images/:key', siteImageController.updateImage);
router.post('/site-images/:key/revert', siteImageController.revertImage);

/* Journal. The data lives in backend/scripts/journalData.js and every write
   re-runs backend/scripts/buildJournal.js, so all of these sit after
   router.use(authenticate, authorizeAdmin) and are admin-only.

   The slug is the article's identity in the data file and in its public URL, so
   it is validated on every route that carries one. Mutations are serialised in
   the service, because two builds writing the same files would race. */
// A Journal write shells out to the generator and rewrites every article page,
// so it is both slow and worth capping. Reads are cheap and stay on the global
// limiter that app.js already applies to /api/.
const journalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many Journal changes in a row. Wait a minute and try again.' },
});

router.get('/journal', journalController.getJournal);
router.get('/journal/images', journalController.getJournalImages);
router.post('/journal/rebuild', journalLimiter, journalController.rebuildJournal);
router.get(
  '/journal/preview/:slug',
  validate(journalValidation.slugParamsSchema),
  journalController.previewArticle
);
router.post(
  '/journal',
  journalLimiter,
  validate(journalValidation.createJournalArticleSchema),
  journalController.createArticle
);
router.get(
  '/journal/:slug',
  validate(journalValidation.slugParamsSchema),
  journalController.getJournalArticle
);
router.put(
  '/journal/:slug',
  journalLimiter,
  validate(journalValidation.updateJournalArticleSchema),
  journalController.updateArticle
);
router.put(
  '/journal/:slug/publish',
  journalLimiter,
  validate(journalValidation.publishSchema),
  journalController.publishArticle
);
router.put(
  '/journal/:slug/feature',
  journalLimiter,
  validate(journalValidation.slugParamsSchema),
  journalController.featureArticle
);
router.delete(
  '/journal/:slug',
  journalLimiter,
  validate(journalValidation.slugParamsSchema),
  journalController.deleteArticle
);
router.post(
  '/journal/:slug/restore',
  journalLimiter,
  validate(journalValidation.slugParamsSchema),
  journalController.restoreArticle
);

router.get('/revenue', adminController.getRevenueAnalytics);
router.get('/reports/bookings', adminController.getBookingReports);
router.get('/reports/occupancy', adminController.getOccupancyReport);
router.get('/reports/popular-rooms', adminController.getPopularRooms);
router.get('/reports/trends', adminController.getBookingTrends);

router.get('/reviews', reviewController.getAllReviews);
router.put('/reviews/:id/approve', reviewController.approveReview);

module.exports = router;