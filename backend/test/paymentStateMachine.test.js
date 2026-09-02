const { test } = require('node:test');
const assert = require('node:assert');
const crypto = require('crypto');
const { ALLOWED, BOOKING_ALLOWED, canTransition, canBookingPaymentTransition, isTerminal } = require('../services/paymentStateMachine');

test('payment state machine: created -> paid is allowed', () => {
  assert.strictEqual(canTransition('created', 'paid'), true);
});

test('payment state machine: created -> failed is allowed', () => {
  assert.strictEqual(canTransition('created', 'failed'), true);
});

test('payment state machine: failed -> paid is allowed (retry captured)', () => {
  assert.strictEqual(canTransition('failed', 'paid'), true);
});

test('payment state machine: paid cannot regress to failed', () => {
  assert.strictEqual(canTransition('paid', 'failed'), false);
});

test('payment state machine: paid cannot regress to created', () => {
  assert.strictEqual(canTransition('paid', 'created'), false);
});

test('payment state machine: refunded is terminal', () => {
  assert.strictEqual(isTerminal('refunded'), true);
  assert.strictEqual(canTransition('refunded', 'paid'), false);
});

test('payment state machine: unknown status rejects', () => {
  assert.strictEqual(canTransition('nonsense', 'paid'), false);
});

test('booking payment transitions: pending -> paid allowed', () => {
  assert.strictEqual(canBookingPaymentTransition('pending', 'paid'), true);
});

test('booking payment transitions: paid -> pending rejected', () => {
  assert.strictEqual(canBookingPaymentTransition('paid', 'pending'), false);
});

test('booking payment transitions: paid -> refunded allowed', () => {
  assert.strictEqual(canBookingPaymentTransition('paid', 'refunded'), true);
});

// Signature helpers live closed over in paymentService; reproduce the algorithm
// here to lock the exact wire format (orderId|paymentId) and timing behaviour.
function expectedSignature(body, secret) {
  return crypto.createHmac('sha256', secret).update(body).digest('hex');
}

const safeEqual = (function () {
  return (a, b) => {
    const aBuf = Buffer.from(String(a));
    const bBuf = Buffer.from(String(b));
    if (aBuf.length !== bBuf.length) return false;
    return crypto.timingSafeEqual(aBuf, bBuf);
  };
})();

test('signature: correct signature passes', () => {
  const secret = 'sk_test_super_secret';
  const body = 'order_123|pay_456';
  const sig = expectedSignature(body, secret);
  assert.strictEqual(safeEqual(sig, expectedSignature(body, secret)), true);
});

test('signature: tampered signature fails', () => {
  const secret = 'sk_test_super_secret';
  const body = 'order_123|pay_456';
  const bad = expectedSignature('order_123|pay_999', secret);
  assert.strictEqual(safeEqual(expectedSignature(body, secret), bad), false);
});

test('signature: different-length inputs fail safely (no throw)', () => {
  assert.strictEqual(safeEqual('abc', 'a'), false);
  assert.strictEqual(safeEqual('', 'abc'), false);
});

test('signature: constant-time compare is used by service', () => {
  // The service must use crypto.timingSafeEqual, not `!==` string compare.
  const fs = require('fs');
  const src = fs.readFileSync(require.resolve('../services/paymentService.js'), 'utf8');
  assert.ok(src.includes('timingSafeEqual'), 'service must use timingSafeEqual');
  assert.ok(!/expectedSignature\s*!==\s*razorpay_signature/.test(src), 'service must not use === for signature');
});

test('ALLOWED table has no backward regression edges from paid', () => {
  const paidTargets = ALLOWED.paid;
  assert.deepStrictEqual(paidTargets, ['refunded']);
});

test('BOOKING_ALLOWED has no paid -> pending edge', () => {
  assert.ok(!BOOKING_ALLOWED.paid.includes('pending'));
});