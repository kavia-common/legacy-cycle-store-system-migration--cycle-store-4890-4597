'use strict';

const jwt = require('jsonwebtoken');
const config = require('../config');
const { errorBody } = require('../utils/http');

/**
 * Extract bearer token from Authorization header
 */
function getBearerToken(header) {
  if (!header) return null;
  const [type, token] = header.split(' ');
  if (type?.toLowerCase() !== 'bearer' || !token) return null;
  return token;
}

// PUBLIC_INTERFACE
function authenticateJWT(req, res, next) {
  /** Authenticate using JWT from Authorization header. On success attaches req.user. */
  const token = getBearerToken(req.headers.authorization);
  if (!token) {
    return res.status(401).json(errorBody('UNAUTHORIZED', 'Missing bearer token'));
  }
  try {
    const payload = jwt.verify(token, config.jwt.secret, {
      algorithms: [config.jwt.algorithm],
      audience: config.jwt.audience,
      issuer: config.jwt.issuer,
    });
    req.user = payload;
    return next();
  } catch (err) {
    return res.status(401).json(errorBody('UNAUTHORIZED', 'Invalid or expired token'));
  }
}

// PUBLIC_INTERFACE
function authorizeRoles(allowedRoles = []) {
  /**
   * Enforce RBAC for a route based on req.user.roles array.
   * Empty allowedRoles -> allow any authenticated user.
   */
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json(errorBody('UNAUTHORIZED', 'Authentication required'));
    }
    if (!allowedRoles.length) return next();
    const roles = Array.isArray(req.user.roles) ? req.user.roles : [];
    const ok = roles.some((r) => allowedRoles.includes(r));
    if (!ok) return res.status(403).json(errorBody('FORBIDDEN', 'Insufficient privileges'));
    return next();
  };
}

module.exports = { authenticateJWT, authorizeRoles };
