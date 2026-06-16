const express = require('express');
const { body } = require('express-validator');
const { register, login, logout, me } = require('../controllers/authController');
const { requireAuth } = require('../middleware/auth');
const { handleValidation, authLimiter } = require('../middleware/validate');

const router = express.Router();

router.post(
  '/register',
  authLimiter,
  [
    body('name').isString().trim().isLength({ min: 1, max: 120 }).withMessage('Name is required.'),
    body('email').isEmail().withMessage('A valid email is required.'),
    body('password')
      .isString()
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters.'),
    body('country').isString().trim().isLength({ min: 1, max: 100 }).withMessage('Country is required.'),
    body('phone').isString().trim().isLength({ min: 5, max: 30 }).withMessage('A valid phone number is required.'),
  ],
  handleValidation,
  register
);

router.post(
  '/login',
  authLimiter,
  [
    body('email').isEmail().withMessage('A valid email is required.'),
    body('password').isString().notEmpty().withMessage('Password is required.'),
  ],
  handleValidation,
  login
);

router.post('/logout', logout);

router.get('/me', requireAuth, me);

module.exports = router;
