const User = require('../models/User');
const Withdrawal = require('../models/Withdrawal');
const { asyncHandler, ok, fail } = require('../utils/respond');

/**
 * GET /api/admin/users
 * List users with optional search and pagination.
 * Query: ?search=&page=&limit=
 */
const listUsers = asyncHandler(async (req, res) => {
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 25, 1), 100);
  const search = (req.query.search || '').trim();

  const filter = {};
  if (search) {
    const rx = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$or = [{ name: rx }, { email: rx }];
  }

  const [users, total] = await Promise.all([
    User.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    User.countDocuments(filter),
  ]);

  return ok(res, {
    users: users.map((u) => u.toPublicJSON()),
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  });
});

/**
 * PUT /api/admin/update-user
 * Body: { id, name?, email?, password?, balance?, suspended?, role? }
 * Admin can update another user's fields. Password is rehashed via the
 * model's virtual setter.
 */
const updateUser = asyncHandler(async (req, res) => {
  const { id, name, email, password, balance, wallets, suspended, role } = req.body;

  if (!id) return fail(res, 'User id is required.', 400);

  const user = await User.findById(id);
  if (!user) return fail(res, 'User not found.', 404);

  if (typeof name === 'string' && name.trim()) user.name = name.trim();
  if (typeof email === 'string' && email.trim()) {
    user.email = email.trim().toLowerCase();
  }
  if (typeof password === 'string' && password.length >= 8) {
    user.password = password; // rehashed on save
  }

  if (wallets && typeof wallets === 'object') {
    const assets = ['btc', 'eth', 'usdt'];
    for (const asset of assets) {
      if (wallets[asset] === undefined) continue;
      const value = Number(wallets[asset]);
      if (Number.isNaN(value) || value < 0) {
        return fail(res, `${asset.toUpperCase()} wallet balance must be a non-negative number.`, 422);
      }
      user.wallets[asset] = value;
    }
    user.markModified('wallets');
    // balance is recomputed from wallets in the pre-save hook
  } else if (balance !== undefined) {
    const value = Number(balance);
    if (Number.isNaN(value) || value < 0) {
      return fail(res, 'Balance must be a non-negative number.', 422);
    }
    // Direct balance edits (no per-wallet breakdown given) are applied to
    // the USDT wallet so wallets stay in sync with the total.
    const otherTotal = (user.wallets?.btc || 0) + (user.wallets?.eth || 0);
    user.wallets.usdt = Math.max(0, value - otherTotal);
    user.markModified('wallets');
  }

  if (typeof suspended === 'boolean') user.suspended = suspended;
  if (role && ['user', 'admin'].includes(role)) user.role = role;

  await user.save();
  return ok(res, { user: user.toPublicJSON() });
});

/**
 * DELETE /api/admin/user/:id
 * Permanently delete a user. Admins cannot delete their own account here.
 */
const deleteUser = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (id === req.user._id.toString()) {
    return fail(res, 'You cannot delete your own admin account.', 400);
  }

  const user = await User.findByIdAndDelete(id);
  if (!user) return fail(res, 'User not found.', 404);

  return ok(res, { message: 'User deleted.', id });
});

/**
 * GET /api/admin/withdrawals
 * List withdrawal requests with optional status filter.
 * Query: ?status=pending|approved|rejected&page=&limit=
 */
const listWithdrawals = asyncHandler(async (req, res) => {
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 25, 1), 100);
  const status = (req.query.status || '').trim();

  const filter = {};
  if (['pending', 'approved', 'rejected'].includes(status)) {
    filter.status = status;
  }

  const [withdrawals, total] = await Promise.all([
    Withdrawal.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('user', 'name email'),
    Withdrawal.countDocuments(filter),
  ]);

  return ok(res, {
    withdrawals: withdrawals.map((w) => ({
      ...w.toPublicJSON(),
      user: w.user ? { id: w.user._id, name: w.user.name, email: w.user.email } : null,
    })),
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  });
});

/**
 * PUT /api/admin/withdrawals/:id/approve
 * Approve a pending withdrawal and deduct the amount from the user's balance.
 */
const approveWithdrawal = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const withdrawal = await Withdrawal.findById(id);
  if (!withdrawal) return fail(res, 'Withdrawal request not found.', 404);
  if (withdrawal.status !== 'pending') {
    return fail(res, 'Only pending withdrawal requests can be approved.', 400);
  }

  const user = await User.findById(withdrawal.user);
  if (!user) return fail(res, 'User not found.', 404);

  if (withdrawal.amount > user.balance) {
    return fail(res, "User's balance is insufficient to approve this withdrawal.", 422);
  }

  // Deduct from the relevant wallet(s).
  if (withdrawal.method === 'crypto' && withdrawal.cryptoAsset) {
    const asset = withdrawal.cryptoAsset.toLowerCase();
    const available = user.wallets?.[asset] || 0;
    if (withdrawal.amount > available) {
      return fail(
        res,
        `User's ${withdrawal.cryptoAsset} wallet balance is insufficient for this withdrawal.`,
        422
      );
    }
    user.wallets[asset] = available - withdrawal.amount;
  } else {
    // Bank transfer: deduct proportionally across all wallets.
    let remaining = withdrawal.amount;
    const assets = ['usdt', 'btc', 'eth'];
    for (const asset of assets) {
      if (remaining <= 0) break;
      const available = user.wallets?.[asset] || 0;
      const take = Math.min(available, remaining);
      user.wallets[asset] = available - take;
      remaining -= take;
    }
  }
  user.markModified('wallets');
  await user.save();

  withdrawal.status = 'approved';
  withdrawal.reviewedBy = req.user._id;
  withdrawal.reviewedAt = new Date();
  withdrawal.rejectionReason = '';
  await withdrawal.save();

  return ok(res, { withdrawal: withdrawal.toPublicJSON() });
});

/**
 * PUT /api/admin/withdrawals/:id/reject
 * Reject a pending withdrawal request.
 * Body: { reason? }
 */
const rejectWithdrawal = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;

  const withdrawal = await Withdrawal.findById(id);
  if (!withdrawal) return fail(res, 'Withdrawal request not found.', 404);
  if (withdrawal.status !== 'pending') {
    return fail(res, 'Only pending withdrawal requests can be rejected.', 400);
  }

  withdrawal.status = 'rejected';
  withdrawal.reviewedBy = req.user._id;
  withdrawal.reviewedAt = new Date();
  withdrawal.rejectionReason = (reason || '').trim();
  await withdrawal.save();

  return ok(res, { withdrawal: withdrawal.toPublicJSON() });
});

module.exports = {
  listUsers,
  updateUser,
  deleteUser,
  listWithdrawals,
  approveWithdrawal,
  rejectWithdrawal,
};
