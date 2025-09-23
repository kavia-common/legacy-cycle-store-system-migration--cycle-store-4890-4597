'use strict';
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { logger } = require('../services/logging');

const AUTH_HEADER = 'authorization';
const ALG = (process.env.JWT_ALG || 'HS256').toUpperCase();
const SECRET = process.env.JWT_SECRET || '';
const PUBKEY_B64 = process.env.JWT_PUBLIC_KEY_BASE64 || '';
const OAUTH2_ENABLED = process.env.OAUTH2_ENABLED === 'true';
const OAUTH2_ISSUER = process.env.OAUTH2_ISSUER || '';
const OAUTH2_AUDIENCE = process.env.OAUTH2_AUDIENCE || '';

function base64url(input) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function verifyHS256(token, secret) {
  const [h, p, s] = token.split('.');
  if (!h || !p || !s) return null;
  const sig = crypto.createHmac('sha256', secret).update(`${h}.${p}`).digest('base64')
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  if (sig !== s) return null;
  try { return JSON.parse(Buffer.from(p, 'base64').toString()); } catch { return null; }
}

function verifyRS256(token, publicKey) {
  try {
    const [h, p, s] = token.split('.');
    if (!h || !p || !s) return null;
    const verifier = crypto.createVerify('RSA-SHA256');
    verifier.update(`${h}.${p}`);
    verifier.end();
    const signature = Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
    const ok = verifier.verify(publicKey, signature);
    if (!ok) return null;
    return JSON.parse(Buffer.from(p, 'base64').toString());
  } catch {
    return null;
  }
}

function parsePublicKey() {
  if (!PUBKEY_B64) return '';
  try {
    const pem = Buffer.from(PUBKEY_B64, 'base64').toString('utf8');
    return pem;
  } catch {
    return '';
  }
}

function validateOAuth2Claims(claims) {
  /** Validates OAuth2 specific claims */
  if (!OAUTH2_ENABLED) return true;
  
  // Validate issuer
  if (OAUTH2_ISSUER && claims.iss !== OAUTH2_ISSUER) {
    if (process.env.NODE_ENV !== 'test') {
      logger('warn', 'oauth2_invalid_issuer', { expected: OAUTH2_ISSUER, actual: claims.iss });
    }
    return false;
  }
  
  // Validate audience
  if (OAUTH2_AUDIENCE) {
    const aud = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
    if (!aud.includes(OAUTH2_AUDIENCE)) {
      if (process.env.NODE_ENV !== 'test') {
        logger('warn', 'oauth2_invalid_audience', { expected: OAUTH2_AUDIENCE, actual: claims.aud });
      }
      return false;
    }
  }
  
  return true;
}

// PUBLIC_INTERFACE
function requireAuth(req, res, next) {
  /** Verifies Bearer token (HS256/RS256/OAuth2), attaches decoded claims to req.user and preserves raw token. */
  try {
    const h = req.get ? req.get(AUTH_HEADER) : req.headers[AUTH_HEADER];
    if (!h || !h.toLowerCase().startsWith('bearer ')) {
      return res.status(401).json({ 
        status: 'error', 
        message: 'Unauthorized - Bearer token required',
        requestId: req.requestId
      });
    }
    
    const token = h.substring(7).trim();
    if (!token) {
      return res.status(401).json({ 
        status: 'error', 
        message: 'Unauthorized - Invalid token format',
        requestId: req.requestId
      });
    }
    
    let claims = null;
    
    // Try standard JWT verification first
    if (SECRET && ALG === 'HS256') {
      try {
        claims = jwt.verify(token, SECRET, { algorithms: ['HS256'] });
      } catch (err) {
        if (process.env.NODE_ENV !== 'test') {
          logger('warn', 'jwt_verification_failed', { error: err.message });
        }
        // Try fallback manual verification
        claims = verifyHS256(token, SECRET);
      }
    } else if (ALG === 'RS256') {
      const pub = parsePublicKey();
      if (!pub) {
        if (process.env.NODE_ENV !== 'test') {
          logger('warn', 'jwt_public_key_missing');
        }
        return res.status(500).json({ 
          status: 'error', 
          message: 'Gateway misconfigured - Missing public key',
          requestId: req.requestId
        });
      }
      
      try {
        claims = jwt.verify(token, pub, { algorithms: ['RS256'] });
      } catch (err) {
        if (process.env.NODE_ENV !== 'test') {
          logger('warn', 'jwt_verification_failed', { error: err.message });
        }
        // Try fallback manual verification
        claims = verifyRS256(token, pub);
      }
    } else {
      if (process.env.NODE_ENV !== 'test') {
        logger('warn', 'unsupported_jwt_alg', { alg: ALG });
      }
      return res.status(500).json({ 
        status: 'error', 
        message: 'Gateway misconfigured - Unsupported algorithm',
        requestId: req.requestId
      });
    }
    
    if (!claims) {
      return res.status(401).json({ 
        status: 'error', 
        message: 'Unauthorized - Invalid token',
        requestId: req.requestId
      });
    }
    
    // Validate OAuth2 claims if enabled
    if (!validateOAuth2Claims(claims)) {
      return res.status(401).json({ 
        status: 'error', 
        message: 'Unauthorized - Invalid OAuth2 claims',
        requestId: req.requestId
      });
    }
    
    // Enhanced exp/nbf/iat checks
    const now = Math.floor(Date.now() / 1000);
    if (claims.exp && now > claims.exp) {
      return res.status(401).json({ 
        status: 'error', 
        message: 'Unauthorized - Token expired',
        requestId: req.requestId
      });
    }
    if (claims.nbf && now < claims.nbf) {
      return res.status(401).json({ 
        status: 'error', 
        message: 'Unauthorized - Token not yet valid',
        requestId: req.requestId
      });
    }
    if (claims.iat && now < claims.iat - 300) { // Allow 5min clock skew
      return res.status(401).json({ 
        status: 'error', 
        message: 'Unauthorized - Token issued in future',
        requestId: req.requestId
      });
    }
    
    req.user = {
      sub: claims.sub || claims.user_id || claims.id || 'unknown',
      roles: Array.isArray(claims.roles) ? claims.roles : (claims.role ? [claims.role] : []),
      scopes: (typeof claims.scope === 'string' ? claims.scope.split(' ') : (claims.scopes || [])),
      email: claims.email,
      name: claims.name || claims.preferred_username,
      claims,
      token,
    };
    
    if (process.env.NODE_ENV !== 'test') {
      logger('info', 'auth_success', { 
        sub: req.user.sub, 
        roles: req.user.roles,
        requestId: req.requestId
      });
    }
    
    next();
  } catch (e) {
    if (process.env.NODE_ENV !== 'test') {
      logger('error', 'auth_exception', { message: e.message, requestId: req.requestId });
    }
    return res.status(401).json({ 
      status: 'error', 
      message: 'Unauthorized - Authentication error',
      requestId: req.requestId
    });
  }
}

// PUBLIC_INTERFACE
function requireRole(role) {
  /** Enforces that req.user contains a specific role. */
  return (req, res, next) => {
    if (!req.user || !Array.isArray(req.user.roles) || !req.user.roles.includes(role)) {
      if (process.env.NODE_ENV !== 'test') {
        logger('warn', 'access_denied_role', { 
          required: role, 
          actual: req.user?.roles || [],
          user: req.user?.sub,
          requestId: req.requestId
        });
      }
      return res.status(403).json({ 
        status: 'error', 
        message: `Forbidden - Role '${role}' required`,
        requestId: req.requestId
      });
    }
    next();
  };
}

// PUBLIC_INTERFACE
function requireScope(scope) {
  /** Enforces presence of OAuth2 scope in token. */
  return (req, res, next) => {
    const scopes = req.user?.scopes || [];
    if (!scopes.includes(scope)) {
      if (process.env.NODE_ENV !== 'test') {
        logger('warn', 'access_denied_scope', { 
          required: scope, 
          actual: scopes,
          user: req.user?.sub,
          requestId: req.requestId
        });
      }
      return res.status(403).json({ 
        status: 'error', 
        message: `Forbidden - Scope '${scope}' required`,
        requestId: req.requestId
      });
    }
    next();
  };
}

// PUBLIC_INTERFACE
function requireAnyRole(roles) {
  /** Enforces that req.user contains at least one of the specified roles. */
  return (req, res, next) => {
    if (!req.user || !Array.isArray(req.user.roles)) {
      return res.status(403).json({ 
        status: 'error', 
        message: 'Forbidden - Authentication required',
        requestId: req.requestId
      });
    }
    
    const hasRole = roles.some(role => req.user.roles.includes(role));
    if (!hasRole) {
      if (process.env.NODE_ENV !== 'test') {
        logger('warn', 'access_denied_any_role', { 
          required: roles, 
          actual: req.user.roles,
          user: req.user.sub,
          requestId: req.requestId
        });
      }
      return res.status(403).json({ 
        status: 'error', 
        message: `Forbidden - One of roles [${roles.join(', ')}] required`,
        requestId: req.requestId
      });
    }
    next();
  };
}

// PUBLIC_INTERFACE
function adminOnly(req, res, next) {
  /** Convenience middleware for admin-only endpoints */
  return requireRole('admin')(req, res, next);
}

module.exports = { 
  requireAuth, 
  requireRole, 
  requireScope, 
  requireAnyRole,
  adminOnly
};
