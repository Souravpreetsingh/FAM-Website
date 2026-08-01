const jwt = require('jsonwebtoken');
const ApiError = require('../utils/ApiError');

const APP_URL = process.env.APP_URL || `http://localhost:${process.env.PORT || 5000}`;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

const STATE_COOKIE = 'fam_oauth_state';
const STATE_TTL_MS = 10 * 60 * 1000;

function getRedirectUri(provider) {
  return `${APP_URL}/api/v1/auth/oauth/${provider}/callback`;
}

function isConfigured(provider) {
  if (provider === 'google') {
    return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
  }
  if (provider === 'apple') {
    return Boolean(
      process.env.APPLE_CLIENT_ID &&
        process.env.APPLE_TEAM_ID &&
        process.env.APPLE_KEY_ID &&
        process.env.APPLE_PRIVATE_KEY
    );
  }
  return false;
}

function requireConfig(provider) {
  if (!isConfigured(provider)) {
    const label = provider === 'apple' ? 'Apple' : 'Google';
    throw ApiError.badRequest(`${label} sign-in is not configured yet.`);
  }
}

function buildAuthorizeUrl(provider, state, nonce) {
  requireConfig(provider);
  const redirectUri = getRedirectUri(provider);
  const params = new URLSearchParams({
    redirect_uri: redirectUri,
    response_type: 'code',
    state,
  });

  if (provider === 'google') {
    params.set('client_id', process.env.GOOGLE_CLIENT_ID);
    params.set('scope', 'openid email profile');
    params.set('prompt', 'select_account');
    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  params.set('client_id', process.env.APPLE_CLIENT_ID);
  params.set('scope', 'name email');
  params.set('response_mode', 'form_post');
  params.set('nonce', nonce);
  return `https://appleid.apple.com/auth/authorize?${params.toString()}`;
}

function signState(payload) {
  if (!process.env.SESSION_SECRET) {
    throw ApiError.internal('SESSION_SECRET is not configured');
  }
  return jwt.sign(payload, process.env.SESSION_SECRET, {
    algorithm: 'HS256',
    expiresIn: '10m',
  });
}

function verifyState(token) {
  if (!process.env.SESSION_SECRET) {
    throw ApiError.internal('SESSION_SECRET is not configured');
  }
  return jwt.verify(token, process.env.SESSION_SECRET, { algorithms: ['HS256'] });
}

function parseCookies(header) {
  const cookies = {};
  if (!header) return cookies;
  header.split(';').forEach((part) => {
    const idx = part.indexOf('=');
    if (idx > -1) {
      const key = part.slice(0, idx).trim();
      const value = part.slice(idx + 1).trim();
      if (key) {
        try {
          cookies[key] = decodeURIComponent(value);
        } catch {
          cookies[key] = value;
        }
      }
    }
  });
  return cookies;
}

function sanitizeRedirect(redirectTo) {
  if (!redirectTo) return '/';
  if (redirectTo.startsWith('//')) return '/';
  if (!redirectTo.startsWith('/')) return '/';
  return redirectTo;
}

module.exports = {
  APP_URL,
  FRONTEND_URL,
  STATE_COOKIE,
  STATE_TTL_MS,
  getRedirectUri,
  isConfigured,
  requireConfig,
  buildAuthorizeUrl,
  signState,
  verifyState,
  parseCookies,
  sanitizeRedirect,
};
