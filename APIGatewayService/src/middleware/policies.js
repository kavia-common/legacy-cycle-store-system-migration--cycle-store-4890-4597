'use strict';
const rateLimit = require('express-rate-limit');
const Ajv = require('ajv');
const addFormats = require('ajv-formats');

const ajv = new Ajv({ allErrors: true, removeAdditional: true });
addFormats(ajv);

// PUBLIC_INTERFACE
function validateBody(schema) {
  /** Validates req.body against provided JSON schema; sets 400 on failure with details. */
  const validate = ajv.compile(schema);
  return (req, res, next) => {
    const ok = validate(req.body || {});
    if (!ok) {
      const errors = validate.errors || [];
      return res.status(400).json({
        status: 'error',
        message: 'Invalid request body',
        details: { errors },
      });
    }
    next();
  };
}

// PUBLIC_INTERFACE
function limiter() {
  /** Returns an express-rate-limit limiter configured via env. */
  const windowMs = Number(process.env.RATE_LIMIT_WINDOW_MS || 60000);
  const max = Number(process.env.RATE_LIMIT_MAX || 100);
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    message: { status: 'error', message: 'Too many requests' },
  });
}

module.exports = { validateBody, limiter };
