const User = require('../models/User');
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
  const { id, name, email, password, balance, suspended, role } = req.body;

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
  if (balance !== undefined) {
    const value = Number(balance);
    if (Number.isNaN(value) || value < 0) {
      return fail(res, 'Balance must be a non-negative number.', 422);
    }
    user.balance = value;
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

module.exports = { listUsers, updateUser, deleteUser };
