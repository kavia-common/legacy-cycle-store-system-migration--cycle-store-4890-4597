'use strict';
const crypto = require('crypto');
const { logger } = require('../services/logging');

const AUTH_HEADER = 'authorization';
const ALG = (process.env.JWT_ALG || 'RS256').toUpperCase();
const SECRET = process.env.JWT_SECRET || '';
const PUBKEY_B64 = process.env.JWT_PUBLIC_KEY_BASE64 || '';

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

// PUBLIC_INTERFACE
function requireAuth(req, res, next) {
  /** Verifies Bearer token (HS256/RS256), attaches decoded claims to req.user and preserves raw token. */
  try {
    const h = req.get(AUTH_HEADER);
    if (!h || !h.toLowerCase().startsWith('bearer ')) {
      return res.status(401).json({ status: 'error', message: 'Unauthorized' });
    }
    const token = h.substring(7).trim();
    if (!token) {
      return res.status(401).json({ status: 'error', message: 'Unauthorized' });
    }
    let claims = null;
    if (ALG === 'HS256') {
      if (!SECRET) {
        logger('warn', 'jwt_secret_missing');
        return res.status(500).json({ status: 'error', message: 'Gateway misconfigured' });
      }
      claims = verifyHS256(token, SECRET);
    } else if (ALG === 'RS256') {
      const pub = parsePublicKey();
      if (!pub) {
        logger('warn', 'jwt_public_key_missing');
        return res.status(500).json({ status: 'error', message: 'Gateway misconfigured' });
      }
      claims = verifyRS256(token, pub);
    } else {
      logger('warn', 'unsupported_jwt_alg', { alg: ALG });
      return res.status(500).json({ status: 'error', message: 'Gateway misconfigured' });
    }
    if (!claims) {
      return res.status(401).json({ status: 'error', message: 'Unauthorized' });
    }
    // Basic exp/nbf checks if present
    const now = Math.floor(Date.now() / 1000);
    if ((claims.exp && now > claims.exp) || (claims.nbf && now < claims.nbf)) {
      return res.status(401).json({ status: 'error', message: 'Token expired or not yet valid' });
    }
    req.user = {
      sub: claims.sub || claims.user_id || 'unknown',
      roles: Array.isArray(claims.roles) ? claims.roles : (claims.role ? [claims.role] : []),
      scopes: (typeof claims.scope === 'string' ? claims.scope.split(' ') : (claims.scopes || [])),
      claims,
      token,
    };
    next();
  } catch (e) {
    logger('error', 'auth_exception', { message: e.message });
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

// PUBLIC_INTERFACE
function requireScope(scope) {
  /** Enforces presence of OAuth2 scope in token. */
  return (req, res, next) => {
    const scopes = req.user?.scopes || [];
    if (!scopes.includes(scope)) {
      return res.status(403).json({ status: 'error', message: 'Forbidden' });
    }
    next();
  };
}

module.exports = { requireAuth, requireRole, requireScope };
