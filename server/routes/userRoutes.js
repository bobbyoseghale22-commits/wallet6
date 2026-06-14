const express = require('express');
const { body } = require('express-validator');
const {
  getMe,
  updateMe,
  getBalance,
  updateBalance,
} = require('../controllers/userController');
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

module.exports = router;
