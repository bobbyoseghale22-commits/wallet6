const { verifyToken, COOKIE_NAME } = require('../utils/token');
const { fail } = require('../utils/respond');
const User = require('../models/User');

/**
 * Require a valid JWT (from HTTP-only cookie or Bearer header).
 * Populates req.user with the full user document.
 */
async function requireAuth(req, res, next) {
  try {
    let token = req.cookies && req.cookies[COOKIE_NAME];

    if (!token && req.headers.authorization?.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return fail(res, 'Authentication required.', 401);
    }

    const payload = verifyToken(token);
    const user = await User.findById(payload.sub);

    if (!user) {
      return fail(res, 'User no longer exists.', 401);
    }

    if (user.suspended) {
      return fail(res, 'Account suspended. Contact support.', 403);
    }

    req.user = user;
    next();
  } catch (err) {
    return fail(res, 'Invalid or expired session.', 401);
  }
}

/**
 * Require the authenticated user to have one of the given roles.
 * Must run after requireAuth.
 */
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return fail(res, 'Authentication required.', 401);
    }
    if (!roles.includes(req.user.role)) {
      return fail(res, 'Insufficient permissions.', 403);
    }
    next();
  };
}

module.exports = { requireAuth, requireRole };
