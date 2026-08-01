const crypto = require('crypto');
const authService = require('../services/authService');
const oauthService = require('../services/oauthService');
const emailService = require('../services/emailService');
const ApiResponse = require('../utils/ApiResponse');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const {
  FRONTEND_URL,
  STATE_COOKIE,
  STATE_TTL_MS,
  buildAuthorizeUrl,
  signState,
  verifyState,
  parseCookies,
  requireConfig,
  sanitizeRedirect,
} = require('../config/oauth');

const register = asyncHandler(async (req, res) => {
  const { name, email, password, phone } = req.validated?.body || {};
  const { user, verificationToken } = await authService.register({
    name,
    email,
    password,
    phone,
  });
  await emailService.sendVerificationEmail(user, verificationToken);
  ApiResponse.created(
    { user },
    'Registration successful. Please check your email to verify your account.'
  ).send(res);
});

const login = asyncHandler(async (req, res) => {
  const { email, password } = req.validated?.body || {};
  const { user, accessToken, refreshToken } = await authService.login(email, password);
  ApiResponse.success(
    { user, accessToken, refreshToken },
    'Login successful'
  ).send(res);
});

const logout = asyncHandler(async (req, res) => {
  const refreshToken = req.body.refreshToken;
  if (refreshToken) {
    await authService.logout(req.user._id, refreshToken);
  }
  ApiResponse.success(null, 'Logged out successfully').send(res);
});

const refreshToken = asyncHandler(async (req, res) => {
  const { refreshToken: token } = req.body;
  if (!token) {
    return ApiResponse.success(null, 'Refresh token is required').send(res);
  }
  const tokens = await authService.refreshAccessToken(token);
  ApiResponse.success(tokens, 'Token refreshed successfully').send(res);
});

const verifyEmail = asyncHandler(async (req, res) => {
  const { token } = req.validated?.query || {};
  const user = await authService.verifyEmail(token);
  await emailService.sendWelcomeEmail(user);
  ApiResponse.success({ user }, 'Email verified successfully').send(res);
});

const resendVerification = asyncHandler(async (req, res) => {
  const user = req.user;
  if (user.isVerified) {
    return ApiResponse.success(null, 'Email already verified').send(res);
  }
  const crypto = require('crypto');
  const verificationToken = crypto.randomBytes(32).toString('hex');
  user.verificationToken = verificationToken;
  user.verificationTokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
  await user.save();
  await emailService.sendVerificationEmail(user, verificationToken);
  ApiResponse.success(null, 'Verification email resent').send(res);
});

const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.validated?.body || {};
  const result = await authService.forgotPassword(email);
  if (result) {
    await emailService.sendPasswordResetEmail(result.user, result.resetToken);
  }
  ApiResponse.success(
    null,
    'If an account with that email exists, a password reset link has been sent.'
  ).send(res);
});

const resetPassword = asyncHandler(async (req, res) => {
  const { token, password } = req.validated?.body || {};
  await authService.resetPassword(token, password);
  ApiResponse.success(null, 'Password reset successful').send(res);
});

const startOAuth = asyncHandler(async (req, res) => {
  const { provider, redirectTo } = req.body || {};
  if (provider !== 'google' && provider !== 'apple') {
    throw ApiError.badRequest('Unsupported OAuth provider');
  }
  requireConfig(provider);

  const state = crypto.randomBytes(24).toString('hex');
  const nonce = crypto.randomBytes(24).toString('hex');
  const stateToken = signState({
    state,
    nonce,
    provider,
    redirectTo: sanitizeRedirect(redirectTo),
  });

  const stateCookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    path: '/',
    maxAge: STATE_TTL_MS,
  };
  res.cookie(STATE_COOKIE, stateToken, stateCookieOptions);

  const url = buildAuthorizeUrl(provider, state, nonce);
  ApiResponse.success({ url, provider }, 'OAuth authorization URL generated').send(res);
});

const redirectOAuthError = (res, message) => {
  const params = new URLSearchParams({ oauth_error: message });
  res.redirect(`${FRONTEND_URL}/pages/login.html?${params.toString()}`);
};

const completeOAuth = (res, session, { user, accessToken, refreshToken }) => {
  res.clearCookie(STATE_COOKIE, {
    path: '/',
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
  });
  const params = new URLSearchParams({
    access_token: accessToken,
    refresh_token: refreshToken,
    user_name: user.name || '',
    redirect: session.redirectTo || '/',
  });
  res.redirect(`${FRONTEND_URL}/pages/oauth-redirect.html#${params.toString()}`);
};

const readOAuthSession = (req, state) => {
  const cookies = parseCookies(req.headers.cookie);
  const token = cookies[STATE_COOKIE];
  if (!token) {
    throw ApiError.unauthorized('OAuth state is missing');
  }
  let session;
  try {
    session = verifyState(token);
  } catch {
    throw ApiError.unauthorized('OAuth state is invalid or expired');
  }
  if (!session || session.state !== state) {
    throw ApiError.unauthorized('OAuth state mismatch');
  }
  return session;
};

const googleCallback = asyncHandler(async (req, res) => {
  try {
    const { code, state, error } = req.query;
    if (error) {
      return redirectOAuthError(res, `Google sign-in failed: ${error}`);
    }
    if (!code || !state) {
      return redirectOAuthError(res, 'Google sign-in failed: missing parameters');
    }
    const session = readOAuthSession(req, state);
    const profile = await oauthService.exchangeGoogleCode(code);
    const { user, accessToken, refreshToken } = await authService.loginWithOAuth(profile);
    return completeOAuth(res, session, { user, accessToken, refreshToken });
  } catch (err) {
    return redirectOAuthError(res, err.message || 'Google sign-in failed');
  }
});

const appleCallback = asyncHandler(async (req, res) => {
  try {
    const { code, state, user: userJson } = req.body || {};
    if (!code || !state) {
      return redirectOAuthError(res, 'Apple sign-in failed: missing parameters');
    }
    const session = readOAuthSession(req, state);
    const profile = await oauthService.exchangeAppleCode(code, userJson, session.nonce);
    const { user, accessToken, refreshToken } = await authService.loginWithOAuth(profile);
    return completeOAuth(res, session, { user, accessToken, refreshToken });
  } catch (err) {
    return redirectOAuthError(res, err.message || 'Apple sign-in failed');
  }
});

module.exports = {
  register,
  login,
  logout,
  refreshToken,
  verifyEmail,
  resendVerification,
  forgotPassword,
  resetPassword,
  startOAuth,
  googleCallback,
  appleCallback,
};
