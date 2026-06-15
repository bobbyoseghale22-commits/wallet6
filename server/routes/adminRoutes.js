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

module.exports = router;
