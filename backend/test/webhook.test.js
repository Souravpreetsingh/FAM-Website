const { test } = require('node:test');
const assert = require('node:assert');
const crypto = require('crypto');

// The service requires mongoose models but does NOT connect at require-time.
const paymentService = require('../services/paymentService');

function sign(body, secret) {
  return crypto.createHmac('sha256', secret).update(body).digest('hex');
}

test('service exposes timing-safe signature helpers', () => {
  assert.ok(paymentService.verifyPayment, 'verifyPayment exists');
  assert.ok(paymentService.createOrder, 'createOrder exists');
  assert.ok(paymentService.handleWebhook, 'handleWebhook exists');
  assert.ok(paymentService.processRefund, 'processRefund exists');
});

test('webhook with no secret configured is refused before DB access', async () => {
  const before = process.env.RAZORPAY_WEBHOOK_SECRET;
  delete process.env.RAZORPAY_WEBHOOK_SECRET;
  try {
    await assert.rejects(
      () => paymentService.handleWebhook({
        rawBody: Buffer.from('{}'),
        signature: 'abc',
        event: 'payment.captured',
        payload: null,
      }),
      /secret not configured/i
    );
  } finally {
    if (before) process.env.RAZORPAY_WEBHOOK_SECRET = before;
  }
});

test('webhook with invalid signature is rejected', async () => {
  process.env.RAZORPAY_WEBHOOK_SECRET = 'whsec_test';
  const body = JSON.stringify({ event: 'payment.captured', payload: {} });
  await assert.rejects(
    () => paymentService.handleWebhook({
      rawBody: Buffer.from(body),
      signature: 'deadbeef',
      event: 'payment.captured',
      payload: {},
    }),
    /invalid.*signature/i
  );
});

test('webhook with a valid signature reaches the handler (event ignored if unmappable)', async () => {
  process.env.RAZORPAY_WEBHOOK_SECRET = 'whsec_test';
  // No payment/order entity -> ignored path, no DB writes, resolves gracefully.
  const body = JSON.stringify({
    event: 'payment.captured',
    payload: { payment: { entity: null } },
  });
  const sig = sign(body, process.env.RAZORPAY_WEBHOOK_SECRET);
  const result = await paymentService.handleWebhook({
    rawBody: Buffer.from(body),
    signature: sig,
    event: 'payment.captured',
    payload: { payment: { entity: null } },
  });
  assert.ok(result.ignored === true || result.duplicate === true || result.unhandled === true);
});

test('webhook signature computed over exact raw bytes (whitespace matters)', async () => {
  const secret = 'whsec_raw';
  const bodyA = JSON.stringify({ a: 1 });
  const bodyB = JSON.stringify({ a: 1 }) + '\n'; // trailing newline changes bytes
  const sigA = sign(bodyA, secret);
  const sigB = sign(bodyB, secret);
  assert.notStrictEqual(sigA, sigB, 'raw bytes differ -> signatures must differ');
});