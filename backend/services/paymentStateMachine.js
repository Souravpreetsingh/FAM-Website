/**
 * Payment + booking payment-status state machine.
 *
 * Guards every transition so a payment can only move through a defined path and
 * a booking's paymentStatus can never regress or jump to an impossible state.
 * This is the single source of truth used by both /verify and the webhook.
 */

const ALLOWED = {
  created: ['attempted', 'paid', 'failed', 'expired'],
  attempted: ['attempted', 'paid', 'failed', 'expired'],
  paid: ['refunded'],
  failed: ['attempted', 'paid'],
  refunded: [],
};

// Booking paymentStatus transitions. `pending` is the starting state.
const BOOKING_ALLOWED = {
  pending: ['partial', 'paid', 'failed'],
  partial: ['paid', 'refunded'],
  paid: ['refunded'],
  refunded: [],
  failed: ['pending', 'partial', 'paid'],
};

const TERMINAL = ['paid', 'refunded'];

function canTransition(from, to) {
  if (!from) return true;
  const next = ALLOWED[from];
  return Array.isArray(next) && next.includes(to);
}

function canBookingPaymentTransition(from, to) {
  if (!from) return true;
  const next = BOOKING_ALLOWED[from];
  return Array.isArray(next) && next.includes(to);
}

module.exports = {
  ALLOWED,
  BOOKING_ALLOWED,
  TERMINAL,
  canTransition,
  canBookingPaymentTransition,
  isTerminal: (status) => TERMINAL.includes(status),
};
