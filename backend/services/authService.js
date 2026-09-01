const crypto = require('crypto');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
} = require('../utils/generateToken');

const REFRESH_TOKEN_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;

class AuthService {
  async register({ name, email, password, phone }) {
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      throw ApiError.conflict('A user with this email already exists');
    }

    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationTokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const user = await User.create({
      name,
      email,
      password,
      phone,
      verificationToken,
      verificationTokenExpires,
    });

    return {
      user,
      verificationToken,
    };
  }

  async login(email, password) {
    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      throw ApiError.unauthorized('Invalid email or password');
    }

    if (user.isDeleted === true) {
      throw ApiError.unauthorized('Invalid email or password');
    }

    if (!user.password) {
      const provider = user.oauthProvider === 'apple' ? 'Apple' : 'Google';
      throw ApiError.unauthorized(`This account uses ${provider} sign-in. Please sign in with ${provider}.`);
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      throw ApiError.unauthorized('Invalid email or password');
    }

    const accessToken = generateAccessToken(user._id, user.role);
    const refreshToken = generateRefreshToken(user._id, user.role);

    user.refreshTokens.push({
      token: refreshToken,
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_EXPIRY_MS),
    });

    if (user.refreshTokens.length > 5) {
      user.refreshTokens = user.refreshTokens.slice(-5);
    }
    await user.save();

    return { user, accessToken, refreshToken };
  }

  async loginWithOAuth({ provider, providerId, email, name, avatar }) {
    let user = await User.findOne({ email }).select('+password');

    if (user) {
      if (user.isDeleted === true) {
        throw ApiError.unauthorized('Account no longer active');
      }
      if (!user.oauthProviderId) {
        user.oauthProvider = provider;
        user.oauthProviderId = providerId;
      }
      user.isVerified = true;
      if (avatar && !user.avatar?.url) {
        user.avatar = { url: avatar };
      }
      await user.save();
    } else {
      user = await User.create({
        name: name || email.split('@')[0] || 'Guest',
        email,
        isVerified: true,
        oauthProvider: provider,
        oauthProviderId: providerId,
        avatar: avatar ? { url: avatar } : undefined,
      });
    }

    const accessToken = generateAccessToken(user._id, user.role);
    const refreshToken = generateRefreshToken(user._id, user.role);

    user.refreshTokens.push({
      token: refreshToken,
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_EXPIRY_MS),
    });

    if (user.refreshTokens.length > 5) {
      user.refreshTokens = user.refreshTokens.slice(-5);
    }
    await user.save();

    return { user, accessToken, refreshToken };
  }

  async refreshAccessToken(refreshToken) {
    let decoded;
    try {
      decoded = verifyRefreshToken(refreshToken);
    } catch {
      throw ApiError.unauthorized('Invalid or expired refresh token');
    }

    const user = await User.findById(decoded.id);
    if (!user || user.isDeleted === true) {
      throw ApiError.unauthorized('User not found');
    }

    const storedToken = user.refreshTokens.find((t) => t.token === refreshToken);
    if (!storedToken || storedToken.expiresAt < new Date()) {
      throw ApiError.unauthorized('Refresh token expired or invalid');
    }

    const newAccessToken = generateAccessToken(user._id, user.role);
    const newRefreshToken = generateRefreshToken(user._id, user.role);

    user.refreshTokens = user.refreshTokens.filter((t) => t.token !== refreshToken);
    user.refreshTokens.push({
      token: newRefreshToken,
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_EXPIRY_MS),
    });
    await user.save();

    return { accessToken: newAccessToken, refreshToken: newRefreshToken };
  }

  async logout(userId, refreshToken) {
    const user = await User.findById(userId);
    if (!user) return;

    user.refreshTokens = user.refreshTokens.filter((t) => t.token !== refreshToken);
    await user.save();
  }

  async verifyEmail(token) {
    const user = await User.findOne({
      verificationToken: token,
      verificationTokenExpires: { $gt: Date.now() },
    });

    if (!user) {
      throw ApiError.badRequest('Invalid or expired verification token');
    }

    user.isVerified = true;
    user.verificationToken = undefined;
    user.verificationTokenExpires = undefined;
    await user.save();

    return user;
  }

  async forgotPassword(email) {
    const user = await User.findOne({ email });
    if (!user) {
      return null;
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = new Date(Date.now() + 60 * 60 * 1000);
    await user.save();

    return { user, resetToken };
  }

  async resetPassword(token, newPassword) {
    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() },
    });

    if (!user) {
      throw ApiError.badRequest('Invalid or expired reset token');
    }

    user.password = newPassword;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    user.refreshTokens = [];
    await user.save();

    return user;
  }

  async changePassword(userId, currentPassword, newPassword) {
    const user = await User.findById(userId).select('+password');
    if (!user) {
      throw ApiError.notFound('User not found');
    }

    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      throw ApiError.badRequest('Current password is incorrect');
    }

    user.password = newPassword;
    user.refreshTokens = [];
    await user.save();

    return user;
  }
}

module.exports = new AuthService();
