const jwt = require('jsonwebtoken');

function unauthorized(res, requestId, message = 'Unauthorized') {
  return res.status(401).json({
    status: 'error',
    errorCode: 'UNAUTHORIZED',
    message,
    requestId,
  });
}

// PUBLIC_INTERFACE
function authenticateJWT(req, res, next) {
  /** Authenticates request using Bearer JWT from Authorization header. Attaches req.user on success. */
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.substring(7) : null;
  if (!token) return unauthorized(res, req.id, 'Missing bearer token');

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'please-change-me');
    req.user = payload;
    return next();
  } catch (err) {
    return unauthorized(res, req.id, 'Invalid or expired token');
  }
}

module.exports = { authenticateJWT };
