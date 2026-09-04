const express = require('express');
const router = express.Router();
const bookingController = require('../controllers/bookingController');
const { authenticate } = require('../middleware/auth');
const validate = require('../middleware/validate');
const {
  createBookingSchema,
  updateBookingSchema,
  cancelBookingSchema,
} = require('../validations/bookingValidation');

// Public guest booking creation — customers no longer need an account. All
// data is validated server-side (Zod), dates/room/guests checked, and the price
// is always calculated on the server inside buildAndCreateReservation.
router.post('/', validate(createBookingSchema), bookingController.createBooking);

// The endpoints below manage a customer's own bookings and require a JWT. They
// are NOT part of the guest booking/payment flow (guests book as the POST above
// and pay via the secure Razorpay order/verify endpoints).
router.get('/my', authenticate, bookingController.getUserBookings);
router.get('/:id', authenticate, bookingController.getBooking);
router.put('/:id', authenticate, bookingController.updateBooking);
router.put('/:id/cancel', authenticate, bookingController.cancelBooking);

module.exports = router;
