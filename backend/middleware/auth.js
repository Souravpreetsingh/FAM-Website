const { verifyAccessToken } = require('../utils/generateToken');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');

const authenticate = asyncHandler(async (req, res, next) => {
  let token = null;
  const authHeader = req.headers.authorization;

  // Prefer the secure httpOnly cookie (admin session), then fall back to a
  // Bearer header (legacy / customer clients). Tokens are never returned to
  // the admin front-end JavaScript.
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  } else if (req.cookies && req.cookies.access_token) {
    token = req.cookies.access_token;
  }

  if (!token) {
    throw ApiError.unauthorized('Access token is required');
  }

  let decoded;
  try {
    decoded = verifyAccessToken(token);
  } catch {
    throw ApiError.unauthorized('Invalid or expired access token');
  }

  const user = await User.findById(decoded.id);
  if (!user || user.isDeleted === true) {
    throw ApiError.unauthorized('User not found');
  }

  req.user = user;
  next();
});

const authorizeAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    throw ApiError.forbidden('Admin access required');
  }
  next();
};

module.exports = { authenticate, authorizeAdmin };
