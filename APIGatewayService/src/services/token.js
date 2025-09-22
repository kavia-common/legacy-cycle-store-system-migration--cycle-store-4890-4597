const jwt = require('jsonwebtoken');

const defaultExpiresIn = Number(process.env.JWT_EXPIRES_IN || 3600);

// PUBLIC_INTERFACE
function signToken(payload, options = {}) {
  /** Signs a JWT with configured secret and expiry. */
  const secret = process.env.JWT_SECRET || 'please-change-me';
  return jwt.sign(payload, secret, { expiresIn: defaultExpiresIn, ...options });
}

// PUBLIC_INTERFACE
function verifyToken(token) {
  /** Verifies a JWT and returns payload or throws. */
  const secret = process.env.JWT_SECRET || 'please-change-me';
  return jwt.verify(token, secret);
}

module.exports = { signToken, verifyToken };
