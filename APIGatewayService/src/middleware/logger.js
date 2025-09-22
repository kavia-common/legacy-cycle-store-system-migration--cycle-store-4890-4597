const morgan = require('morgan');

/**
 * Sanitize URLs by redacting sensitive query parameters to avoid logging secrets.
 */
function sanitizeUrl(url) {
  try {
    const u = new URL(url, 'http://placeholder.local');
    const sensitiveKeys = new Set([
      'password',
      'pass',
      'token',
      'access_token',
      'refresh_token',
      'authorization',
      'api_key',
      'apikey',
      'secret'
    ]);
    for (const key of Array.from(u.searchParams.keys())) {
      if (sensitiveKeys.has(key.toLowerCase())) {
        u.searchParams.set(key, 'REDACTED');
      }
    }
    return u.pathname + (u.search ? u.search : '');
  } catch (_) {
    // If parsing fails, fallback to original
    return url;
  }
}

/**
 * Create a privacy-preserving request logger with request id support.
 * Only logs method, sanitized URL, status, content-length, and response-time.
 */
const logger = morgan((tokens, req, res) => {
  const method = tokens.method(req, res) || '';
  const rawUrl = req.originalUrl || tokens.url(req, res) || '';
  const safeUrl = sanitizeUrl(rawUrl);
  const parts = [
    `[${req.id || '-'}]`,
    method,
    safeUrl,
    tokens.status(req, res),
    tokens.res(req, res, 'content-length'), '-',
    tokens['response-time'](req, res), 'ms'
  ];
  return parts.join(' ');
});

module.exports = logger;
