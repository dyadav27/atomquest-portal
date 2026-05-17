'use strict';

/**
 * Global error handler middleware.
 * Must be registered LAST in the Express middleware chain.
 *
 * Handles:
 * - Validation errors (400)
 * - Auth errors (401/403)
 * - Supabase-specific error codes
 * - Generic server errors (500)
 */
function errorHandler(err, req, res, next) {
  // Avoid handling after response has been sent
  if (res.headersSent) {
    return next(err);
  }

  // Log full error in development, condensed in production
  if (process.env.NODE_ENV !== 'production') {
    console.error('[ErrorHandler]', err);
  } else {
    console.error('[ErrorHandler]', err.message);
  }

  // Determine status code
  let statusCode = err.statusCode || err.status || 500;
  let message = err.message || 'Internal server error';

  // Handle specific error types
  if (err.name === 'ValidationError') {
    statusCode = 400;
  }

  if (err.code === 'PGRST116') {
    // PostgREST: row not found
    statusCode = 404;
    message = 'Resource not found';
  }

  if (err.code === '23505') {
    // PostgreSQL: unique violation
    statusCode = 409;
    message = 'Resource already exists (unique constraint violation)';
  }

  if (err.code === '23503') {
    // PostgreSQL: foreign key violation
    statusCode = 400;
    message = 'Referenced resource does not exist';
  }

  if (err.code === '23514') {
    // PostgreSQL: check constraint violation
    statusCode = 400;
    message = err.message || 'Data validation failed (constraint violation)';
  }

  // Ensure status code is valid HTTP
  if (statusCode < 400 || statusCode > 599) {
    statusCode = 500;
  }

  res.status(statusCode).json({
    error: statusCode >= 500 ? 'Internal Server Error' : 'Request Error',
    message:
      process.env.NODE_ENV === 'production' && statusCode >= 500
        ? 'An unexpected error occurred. Please try again later.'
        : message,
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
  });
}

/**
 * Helper to create a structured API error.
 *
 * @param {number} statusCode
 * @param {string} message
 * @returns {Error}
 */
function createError(statusCode, message) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

module.exports = { errorHandler, createError };
