const User = require('../models/User');
const { asyncHandler, ok, fail } = require('../utils/respond');
const { signToken, setAuthCookie, clearAuthCookie } = require('../utils/token');

/**
 * POST /api/auth/register
 * Body: { name, email, password }
 * Creates a new user with a bcrypt-hashed password and logs them in.
 */
const register = asyncHandler(async (req, res) => {
  const { name, email, password, country, phone } = req.body;

  const existing = await User.findOne({ email: email.toLowerCase() });
  if (existing) {
    return fail(res, 'An account with this email already exists.', 409);
  }

  const user = new User({
    name: name.trim(),
    email: email.toLowerCase().trim(),
    country: (country || '').trim(),
    phone: (phone || '').trim(),
    balance: 0,
    lastLogin: new Date(),
  });
  user.password = password;
  await user.save();

  const token = signToken(user);
  setAuthCookie(res, token);

  return ok(res, { user: user.toPublicJSON() }, 201);
});

/**
 * POST /api/auth/login
 * Body: { email, password }
 */
const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email: email.toLowerCase() }).select(
    '+passwordHash'
  );

  if (!user || !(await user.comparePassword(password))) {
    return fail(res, 'Invalid email or password.', 401);
  }

  if (user.suspended) {
    return fail(res, 'Account suspended. Contact support.', 403);
  }

  user.lastLogin = new Date();
  await user.save();

  const token = signToken(user);
  setAuthCookie(res, token);

  return ok(res, { user: user.toPublicJSON() });
});

/**
 * POST /api/auth/logout
 * Clears the auth cookie.
 */
const logout = asyncHandler(async (req, res) => {
  clearAuthCookie(res);
  return ok(res, { message: 'Logged out.' });
});

/**
 * GET /api/auth/me
 * Return the currently authenticated user.
 */
const me = asyncHandler(async (req, res) => {
  return ok(res, { user: req.user.toPublicJSON() });
});

module.exports = { register, login, logout, me };
