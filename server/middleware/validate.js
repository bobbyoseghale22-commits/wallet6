const { validationResult } = require('express-validator');
const rateLimit = require('express-rate-limit');
const { fail } = require('../utils/respond');

/**
 * Collect express-validator errors and short-circuit with a 422.
 */
function handleValidation(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const first = errors.array()[0];
    return fail(res, first.msg || 'Validation failed.', 422);
  }
  next();
}

/**
 * General API rate limiter.
 */
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many requests, please try again later.' },
});

/**
 * Stricter limiter for auth endpoints.
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many auth attempts, please slow down.' },
});

module.exports = { handleValidation, apiLimiter, authLimiter };
