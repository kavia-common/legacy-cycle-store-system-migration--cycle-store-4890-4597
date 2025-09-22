const morgan = require('morgan');

/**
 * Create a request logger middleware with request id support.
 */
const logger = morgan((tokens, req, res) => {
  const parts = [
    `[${req.id}]`,
    tokens.method(req, res),
    tokens.url(req, res),
    tokens.status(req, res),
    tokens.res(req, res, 'content-length'), '-',
    tokens['response-time'](req, res), 'ms'
  ];
  return parts.join(' ');
});

module.exports = logger;
