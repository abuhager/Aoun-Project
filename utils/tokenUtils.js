const jwt = require('jsonwebtoken');

const generateAccessToken = (user) => {
  const payload = {
    user: {
      id: user._id?.toString?.() || user.id,
      role: user.role,
    },
  };

  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: '15m',
  });
};

const generateRefreshToken = (user) => {
  const payload = {
    user: {
      id: user._id?.toString?.() || user.id,
    },
  };

  return jwt.sign(payload, process.env.JWT_REFRESH_SECRET, {
    expiresIn: '7d',
  });
};

const isProduction = process.env.NODE_ENV === 'production';

const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: isProduction,
  sameSite: isProduction ? 'none' : 'lax',
  secure: isProduction,
  sameSite: isProduction ? 'none' : 'lax',
  maxAge: 7 * 24 * 60 * 60 * 1000,
  path: '/',
  path: '/',
};

const CLEAR_REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: isProduction,
  sameSite: isProduction ? 'none' : 'lax',
  path: '/',
  secure: isProduction,
  sameSite: isProduction ? 'none' : 'lax',
  path: '/',
};

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  REFRESH_COOKIE_OPTIONS,
  CLEAR_REFRESH_COOKIE_OPTIONS,
};
