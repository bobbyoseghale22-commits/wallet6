const User = require('../models/User');
const { asyncHandler, ok, fail } = require('../utils/respond');

/**
 * GET /api/user
 * Return the authenticated user's profile.
 */
const getMe = asyncHandler(async (req, res) => {
  return ok(res, { user: req.user.toPublicJSON() });
});

/**
 * PUT /api/user/update
 * Update the authenticated user's own name and/or password.
 */
const updateMe = asyncHandler(async (req, res) => {
  const { name, password } = req.body;
  const user = req.user;

  if (typeof name === 'string' && name.trim()) {
    user.name = name.trim();
  }

  if (typeof password === 'string' && password.length >= 8) {
    user.password = password; // virtual setter -> rehash on save
  }

  await user.save();
  return ok(res, { user: user.toPublicJSON() });
});

/**
 * GET /api/user/balance
 * Return the authenticated user's wallet balance.
 */
const getBalance = asyncHandler(async (req, res) => {
  return ok(res, { balance: req.user.balance });
});

/**
 * PUT /api/user/balance
 * Update the authenticated user's own balance.
 * (Demo feature — in a real wallet, balance changes come from ledgered
 * transactions, never a direct client write.)
 */
const updateBalance = asyncHandler(async (req, res) => {
  const { balance } = req.body;
  const value = Number(balance);

  if (Number.isNaN(value) || value < 0) {
    return fail(res, 'Balance must be a non-negative number.', 422);
  }

  req.user.balance = value;
  await req.user.save();

  return ok(res, { balance: req.user.balance });
});

module.exports = { getMe, updateMe, getBalance, updateBalance };
