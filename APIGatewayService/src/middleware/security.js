'use strict';

const { v4: uuidv4 } = require('uuid');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const morgan = require('morgan');
const config = require('../config');

// PUBLIC_INTERFACE
function securityMiddleware(app) {
  /** Apply Helmet and rate limiting and request logging. */
  app.use(helmet({
    contentSecurityPolicy: false,
  }));

  // Request ID
  app.use((req, res, next) => {
    req.id = req.headers['x-request-id'] || uuidv4();
    res.setHeader('X-Request-Id', req.id);
    next();
  });

  // Morgan logging with request id
  morgan.token('id', (req) => req.id);
  app.use(morgan(':id :method :url :status :response-time ms'));

  // Rate limiting (global)
  app.use(
    rateLimit({
      windowMs: config.rateLimit.windowMs,
      max: config.rateLimit.max,
      standardHeaders: config.rateLimit.standardHeaders,
      legacyHeaders: config.rateLimit.legacyHeaders,
      message: { errorCode: 'RATE_LIMIT', message: 'Too many requests, please try again later.' },
    })
  );
}

module.exports = { securityMiddleware };
