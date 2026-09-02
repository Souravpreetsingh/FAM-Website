/**
 * Startup environment validation.
 *
 * In production we fail fast (refuse to boot) if required Razorpay credentials
 * are missing or still hold placeholder values, so a misconfigured deploy never
 * serves a half-broken payment flow. Logs only whether each credential is
 * valid/invalid — never the value itself.
 */

const razorpayConfig = require('./razorpay');

const PLACEHOLDER = /your-|placeholder|xxxx|change-me/i;

function valid(name) {
  const v = process.env[name];
  return typeof v === 'string' && v.trim() !== '' && !PLACEHOLDER.test(v);
}

function validateEnvironment() {
  const problems = [];

  if (valid('RAZORPAY_KEY_ID') && valid('RAZORPAY_KEY_SECRET')) {
    if (!razorpayConfig.isConfigured()) {
      problems.push('RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET appear to hold placeholder values');
    }
  } else {
    problems.push('RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET are missing or placeholder (payment gateway will not work)');
  }

  if (process.env.RAZORPAY_WEBHOOK_SECRET && !valid('RAZORPAY_WEBHOOK_SECRET')) {
    problems.push('RAZORPAY_WEBHOOK_SECRET appears to hold a placeholder value');
  }

  const mode = razorpayConfig.isTestMode() ? 'TEST' : 'LIVE';
  console.log(`[env] Razorpay mode: ${mode}`);

  if (problems.length) {
    const message = problems.join('; ');
    if (process.env.NODE_ENV === 'production') {
      throw new Error(`Environment validation failed: ${message}`);
    }
    console.warn(`[env] WARNING: ${message} (proceeding in non-production mode)`);
  }

  return { problems, mode };
}

module.exports = { validateEnvironment, valid };
