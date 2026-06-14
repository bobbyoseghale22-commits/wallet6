const { fail } = require('../utils/respond');
const config = require('../config');

/**
 * 404 handler for unmatched API routes.
 */
function notFound(req, res) {
  return fail(res, `Route not found: ${req.method} ${req.originalUrl}`, 404);
}

/**
 * Global error handler.
 */
function errorHandler(err, req, res, next) {
  // CSRF token errors from csurf
  if (err.code === 'EBADCSRFTOKEN') {
    return fail(res, 'Invalid CSRF token.', 403);
  }

  // Mongoose duplicate key
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    return fail(res, `An account with that ${field} already exists.`, 409);
  }

  // Mongoose validation
  if (err.name === 'ValidationError') {
    const first = Object.values(err.errors)[0];
    return fail(res, first?.message || 'Validation error.', 422);
  }

  const status = err.status || 500;
  const message =
    status === 500 && config.isProd ? 'Internal server error.' : err.message;

  if (status === 500) {
    console.error('Unhandled error:', err);
  }

  return fail(res, message, status);
}

module.exports = { notFound, errorHandler };
