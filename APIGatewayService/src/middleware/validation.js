'use strict';

const { validationResult } = require('express-validator');
const { errorBody } = require('../utils/http');

// PUBLIC_INTERFACE
function validateRequest(req, res, next) {
  /** Validate express-validator results; return 400 on validation errors. */
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json(
      errorBody('VALIDATION_ERROR', 'Input validation failed', JSON.stringify(errors.array()))
    );
  }
  return next();
}

module.exports = { validateRequest };
