const Withdrawal = require('../models/Withdrawal');
const { asyncHandler, ok, fail } = require('../utils/respond');

/**
 * POST /api/user/withdrawals
 * Create a new withdrawal request (bank or crypto).
 * Body: { method, amount, bankName?, accountName?, accountNumber?,
 *         routingNumber?, cryptoAsset?, walletAddress?, network? }
 */
const createWithdrawal = asyncHandler(async (req, res) => {
  const {
    method,
    amount,
    bankName,
    accountName,
    accountNumber,
    routingNumber,
    cryptoAsset,
    walletAddress,
    network,
  } = req.body;

  const value = Number(amount);
  if (Number.isNaN(value) || value <= 0) {
    return fail(res, 'Amount must be a positive number.', 422);
  }

  if (value > req.user.balance) {
    return fail(res, 'Withdrawal amount exceeds your available balance.', 422);
  }

  if (!['bank', 'crypto'].includes(method)) {
    return fail(res, 'Invalid withdrawal method.', 422);
  }

  const payload = {
    user: req.user._id,
    method,
    amount: value,
    status: 'pending',
  };

  if (method === 'bank') {
    if (!bankName || !accountName || !accountNumber) {
      return fail(res, 'Bank name, account name, and account number are required.', 422);
    }
    payload.bankName = bankName.trim();
    payload.accountName = accountName.trim();
    payload.accountNumber = accountNumber.trim();
    payload.routingNumber = (routingNumber || '').trim();
  } else {
    if (!cryptoAsset || !walletAddress) {
      return fail(res, 'Crypto asset and wallet address are required.', 422);
    }
    if (!['BTC', 'ETH', 'USDT'].includes(cryptoAsset)) {
      return fail(res, 'Invalid crypto asset.', 422);
    }
    payload.cryptoAsset = cryptoAsset;
    payload.walletAddress = walletAddress.trim();
    payload.network = (network || '').trim();
  }

  const withdrawal = await Withdrawal.create(payload);

  return ok(res, { withdrawal: withdrawal.toPublicJSON() }, 201);
});

/**
 * GET /api/user/withdrawals
 * List the authenticated user's withdrawal requests, newest first.
 */
const listMyWithdrawals = asyncHandler(async (req, res) => {
  const withdrawals = await Withdrawal.find({ user: req.user._id }).sort({ createdAt: -1 });
  return ok(res, { withdrawals: withdrawals.map((w) => w.toPublicJSON()) });
});

module.exports = { createWithdrawal, listMyWithdrawals };
