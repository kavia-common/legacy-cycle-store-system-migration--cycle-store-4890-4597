'use strict';
const fetch = (...args) => import('node-fetch').then(({ default: f }) => f(...args));

const LEVELS = ['debug', 'info', 'warn', 'error'];
const LOG_LEVEL = process.env.LOG_LEVEL || 'info';
const MONITOR_SERVICE_URL = process.env.MONITOR_SERVICE_URL || 'http://localhost:4601';

function levelEnabled(level) {
  return LEVELS.indexOf(level) >= LEVELS.indexOf(LOG_LEVEL);
}

// PUBLIC_INTERFACE
function logger(level, message, meta = {}) {
  /** Central logger: logs to console and forwards to Monitoring service if configured. */
  if (!LEVELS.includes(level)) level = 'info';
  if (levelEnabled(level)) {
    const payload = { ts: new Date().toISOString(), level: level.toUpperCase(), message, meta };
    // Console
    // eslint-disable-next-line no-console
    console.log(JSON.stringify(payload));
    // Forward asynchronously, ignore failures
    forwardLog(payload).catch(() => {});
  }
}

async function forwardLog(payload) {
  try {
    await fetch(`${MONITOR_SERVICE_URL}/api/v1/logs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        timestamp: payload.ts,
        level: payload.level,
        message: payload.message,
        source: 'APIGatewayService',
        context: payload.meta || {},
      }),
    });
  } catch (_e) {
    // swallow to avoid feedback loops
  }
}

// PUBLIC_INTERFACE
function requestLogger(req, _res, next) {
  /** Express middleware to log incoming requests with correlation id. */
  const requestId = req.headers['x-request-id'] || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  req.requestId = requestId;
  logger('info', 'incoming_request', {
    requestId,
    method: req.method,
    path: req.originalUrl,
    ip: req.ip,
    user: req.user ? { sub: req.user.sub, roles: req.user.roles } : undefined,
  });
  next();
}

// PUBLIC_INTERFACE
function errorLogger(err, req, _res, next) {
  /** Express error-logging middleware. */
  logger('error', 'request_error', {
    requestId: req.requestId,
    message: err.message,
    status: err.status || 500,
    stack: process.env.NODE_ENV === 'production' ? undefined : err.stack,
  });
  next(err);
}

// PUBLIC_INTERFACE
function audit(action, detailsBuilder = () => ({})) {
  /**
   * Returns middleware that emits an audit log entry when the request completes successfully.
   * Example: app.post('/api/orders', audit('ORDER_CREATE', (req,res)=>({...})), handler)
   */
  const enabled = (process.env.AUDIT_ENABLED || 'true').toLowerCase() === 'true';
  return async (req, res, next) => {
    if (!enabled) return next();
    const done = () => {
      res.removeListener('finish', onFinish);
      res.removeListener('close', onClose);
    };
    const onClose = () => done();
    const onFinish = () => {
      try {
        const details = detailsBuilder(req, res) || {};
        logger('info', 'audit_event', {
          action,
          actor: req.user ? req.user.sub : 'anonymous',
          roles: req.user ? req.user.roles : [],
          statusCode: res.statusCode,
          requestId: req.requestId,
          details,
        });
      } catch (_e) {
        // ignore
      } finally {
        done();
      }
    };
    res.on('finish', onFinish);
    res.on('close', onClose);
    next();
  };
}

module.exports = { logger, requestLogger, errorLogger, audit };
