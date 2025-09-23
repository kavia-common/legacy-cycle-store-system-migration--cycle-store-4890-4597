'use strict';

/**
 * Simple JWT auth middleware stub.
 * In production, replace verifyToken with a real JWT verification using a shared secret or JWKS.
 */

const AUTH_HEADER = 'authorization';

// PUBLIC_INTERFACE
function requireAuth(req, res, next) {
  /** Enforces presence of a bearer token and attaches decoded user to req.user (stub). */
  try {
    const h = req.get(AUTH_HEADER);
    if (!h || !h.toLowerCase().startsWith('bearer ')) {
      return res.status(401).json({ status: 'error', message: 'Unauthorized' });
    }
    const token = h.substring(7).trim();
    if (!token) {
      return res.status(401).json({ status: 'error', message: 'Unauthorized' });
    }
    // Stub decode – replace with real verification.
    req.user = { sub: 'user-123', roles: ['user'], token };
    next();
  } catch (e) {
    return res.status(401).json({ status: 'error', message: 'Unauthorized' });
  }
}

// PUBLIC_INTERFACE
function requireRole(role) {
  /** Enforces that req.user contains a specific role. */
  return (req, res, next) => {
    if (!req.user || !Array.isArray(req.user.roles) || !req.user.roles.includes(role)) {
      return res.status(403).json({ status: 'error', message: 'Forbidden' });
    }
    next();
  };
}

module.exports = { requireAuth, requireRole };
