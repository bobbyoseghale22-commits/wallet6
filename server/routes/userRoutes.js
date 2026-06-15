const express = require('express');
const { body } = require('express-validator');
const {
  getMe,
  updateMe,
  getBalance,
  updateBalance,
} = require('../controllers/userController');
const {
  createWithdrawal,
  listMyWithdrawals,
} = require('../controllers/withdrawalController');
const { requireAuth } = require('../middleware/auth');
const { handleValidation } = require('../middleware/validate');

const router = express.Router();

// All user routes require authentication
router.use(requireAuth);

router.get('/', getMe);

router.put(
  '/update',
  [
    body('name').optional().isString().trim().isLength({ min: 1, max: 120 }),
    body('password')
      .optional()
      .isString()
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters.'),
  ],
  handleValidation,
  updateMe
);

router.get('/balance', getBalance);

router.put(
  '/balance',
  [body('balance').isNumeric().withMessage('Balance must be a number.')],
  handleValidation,
  updateBalance
);

router.get('/withdrawals', listMyWithdrawals);

router.post(
  '/withdrawals',
  [
    body('method').isIn(['bank', 'crypto']).withMessage('Method must be bank or crypto.'),
    body('amount').isFloat({ gt: 0 }).withMessage('Amount must be a positive number.'),
    body('bankName').optional().isString().trim().isLength({ max: 200 }),
    body('accountName').optional().isString().trim().isLength({ max: 200 }),
    body('accountNumber').optional().isString().trim().isLength({ max: 60 }),
    body('routingNumber').optional().isString().trim().isLength({ max: 60 }),
    body('cryptoAsset').optional().isIn(['BTC', 'ETH', 'USDT']),
    body('walletAddress').optional().isString().trim().isLength({ max: 200 }),
    body('network').optional().isString().trim().isLength({ max: 60 }),
  ],
  handleValidation,
  createWithdrawal
);

module.exports = router;
