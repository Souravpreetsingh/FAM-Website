const Razorpay = require('razorpay');

const PLACEHOLDER_PATTERN = /your-|placeholder|xxxx|rzp_live_xxxxxxxxxxxx|change-me/i;

function isConfigured() {
  const keyId = process.env.RAZORPAY_KEY_ID || '';
  const keySecret = process.env.RAZORPAY_KEY_SECRET || '';
  return !!(
    keyId &&
    keySecret &&
    !PLACEHOLDER_PATTERN.test(keyId) &&
    !PLACEHOLDER_PATTERN.test(keySecret)
  );
}

function isTestMode() {
  const keyId = process.env.RAZORPAY_KEY_ID || '';
  return /^rzp_test_/i.test(keyId);
}

let instance = null;

function getRazorpay() {
  if (!isConfigured()) {
    throw new Error('Razorpay is not configured. Set real RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.');
  }
  if (!instance) {
    instance = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });
  }
  return instance;
}

module.exports = getRazorpay;
module.exports.isConfigured = isConfigured;
module.exports.isTestMode = isTestMode;
