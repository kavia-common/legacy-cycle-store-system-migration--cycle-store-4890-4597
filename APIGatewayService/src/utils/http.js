'use strict';

/**
 * Build a standardized error body
 */
function errorBody(code, message, details = undefined) {
  return {
    errorCode: code,
    message,
    ...(details ? { details } : {}),
  };
}

/**
 * Wrap async route handlers to forward errors to error middleware
 */
function asyncHandler(fn) {
  return function wrapped(req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = { errorBody, asyncHandler };
