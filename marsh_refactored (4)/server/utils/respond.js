/**
 * Wrap an async route handler so thrown errors hit the error middleware.
 */
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

/**
 * Standard success envelope.
 */
const ok = (res, data = {}, status = 200) =>
  res.status(status).json({ success: true, data });

/**
 * Standard error envelope.
 */
const fail = (res, message = 'Something went wrong', status = 400) =>
  res.status(status).json({ success: false, error: message });

module.exports = { asyncHandler, ok, fail };
