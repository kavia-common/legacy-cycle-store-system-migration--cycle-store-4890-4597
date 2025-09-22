const rateLimit = require('express-rate-limit');

const windowMs = Number(process.env.RATE_LIMIT_WINDOW_MS || 60000); // 1 minute
const max = Number(process.env.RATE_LIMIT_MAX || 100);

const limiter = rateLimit({
  windowMs,
  max,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: 'error',
    errorCode: 'RATE_LIMIT_EXCEEDED',
    message: 'Too many requests, please try again later'
  },
});

module.exports = limiter;
