'use strict';

const jwt = require('jsonwebtoken');
const config = require('../config');
const { errorBody } = require('../utils/http');

// PUBLIC_INTERFACE
async function login(req, res) {
  /**
   * Authenticate user and issue JWT token.
   * Body: { username: string, password: string }
   * Returns: { token: string }
   * Note: Replace placeholder credential check with real IdP/Directory in production.
   */
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json(errorBody('VALIDATION_ERROR', 'username and password are required'));
  }

  // Placeholder authentication logic. Integrate with proper identity provider here.
  // For demo, accept any non-empty creds and set roles based on username pattern.
  const roles = username === 'admin' ? ['admin'] : ['user'];

  if (!config.jwt.secret) {
    return res.status(500).json(errorBody('CONFIG_ERROR', 'JWT secret not configured'));
  }

  const token = jwt.sign(
    { sub: username, roles },
    config.jwt.secret,
    {
      algorithm: config.jwt.algorithm,
      issuer: config.jwt.issuer,
      audience: config.jwt.audience,
      expiresIn: config.jwt.expiresIn,
    }
  );

  return res.status(200).json({ token });
}

module.exports = { login };
