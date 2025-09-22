const { validationResult } = require('express-validator');

// PUBLIC_INTERFACE
function handleValidation(req, res, next) {
  /** Processes express-validator results and returns 400 with details if invalid. */
  const errors = validationResult(req);
  if (errors.isEmpty()) return next();
  return res.status(400).json({
    status: 'error',
    errorCode: 'VALIDATION_ERROR',
    message: 'Request validation failed',
    details: errors.array(),
    requestId: req.id,
  });
}

module.exports = { handleValidation };
