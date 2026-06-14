const jwt = require('jsonwebtoken');
const config = require('../config');

const COOKIE_NAME = 'marsh_token';

/**
 * Sign a JWT for a given user.
 */
function signToken(user) {
  return jwt.sign(
    {
      sub: user._id.toString(),
      role: user.role,
      email: user.email,
    },
    config.jwtSecret,
    { expiresIn: config.jwtExpiresIn }
  );
}

/**
 * Verify a JWT and return its decoded payload (throws on failure).
 */
function verifyToken(token) {
  return jwt.verify(token, config.jwtSecret);
}

/**
 * Attach the auth token as a secure, HTTP-only cookie.
 */
function setAuthCookie(res, token) {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: config.isProd, // HTTPS only in production
    sameSite: config.isProd ? 'none' : 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    path: '/',
  });
}

/**
 * Clear the auth cookie (logout).
 */
function clearAuthCookie(res) {
  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    secure: config.isProd,
    sameSite: config.isProd ? 'none' : 'lax',
    path: '/',
  });
}

module.exports = {
  COOKIE_NAME,
  signToken,
  verifyToken,
  setAuthCookie,
  clearAuthCookie,
};
