const express = require('express');
const { body } = require('express-validator');
const {
  listUsers,
  updateUser,
  deleteUser,
  listWithdrawals,
  approveWithdrawal,
  rejectWithdrawal,
} = require('../controllers/adminController');
const {
  listKyc,
  getDocument,
  approveKyc,
  rejectKyc,
  requestResubmit,
} = require('../controllers/kycController');
const { requireAuth, requireRole } = require('../middleware/auth');
const { handleValidation } = require('../middleware/validate');

const router = express.Router();

// Every admin route requires auth + admin role
router.use(requireAuth, requireRole('admin'));

router.get('/users', listUsers);

router.put(
  '/update-user',
  [
    body('id').isString().notEmpty().withMessage('User id is required.'),
    body('email').optional().isEmail().withMessage('Invalid email.'),
    body('password')
      .optional()
      .isString()
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters.'),
    body('balance').optional().isNumeric(),
    body('wallets').optional().isObject(),
    body('wallets.btc').optional().isFloat({ min: 0 }).withMessage('BTC balance must be a non-negative number.'),
    body('wallets.eth').optional().isFloat({ min: 0 }).withMessage('ETH balance must be a non-negative number.'),
    body('wallets.usdt').optional().isFloat({ min: 0 }).withMessage('USDT balance must be a non-negative number.'),
    body('suspended').optional().isBoolean(),
    body('role').optional().isIn(['user', 'admin']),
  ],
  handleValidation,
  updateUser
);

router.delete('/user/:id', deleteUser);

router.get('/withdrawals', listWithdrawals);

router.put('/withdrawals/:id/approve', approveWithdrawal);

router.put(
  '/withdrawals/:id/reject',
  [body('reason').optional().isString().trim().isLength({ max: 500 })],
  handleValidation,
  rejectWithdrawal
);

// KYC
router.get('/kyc', listKyc);
router.get('/kyc/:userId/document/:docType', getDocument);
router.put('/kyc/:userId/approve', approveKyc);
router.put(
  '/kyc/:userId/reject',
  [body('note').isString().trim().isLength({ min: 1, max: 500 }).withMessage('Rejection reason is required.')],
  handleValidation,
  rejectKyc
);
router.put(
  '/kyc/:userId/request-resubmit',
  [body('note').isString().trim().isLength({ min: 1, max: 500 }).withMessage('Please specify what needs to be resubmitted.')],
  handleValidation,
  requestResubmit
);

module.exports = router;
