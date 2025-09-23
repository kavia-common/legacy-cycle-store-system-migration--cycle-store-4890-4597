'use strict';

const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { validateBody, limiter } = require('../middleware/policies');
const { audit } = require('../services/logging');

// JSON Schemas for request validation
const loginSchema = {
  type: 'object',
  properties: {
    username: { type: 'string', minLength: 1 },
    password: { type: 'string', minLength: 1 },
  },
  required: ['username', 'password'],
  additionalProperties: false,
};

/**
 * POST /api/auth/login
 * Authenticate user and issue JWT token
 * @summary Authenticate user and issue JWT token
 * @tags Auth
 * @param {LoginRequest} request.body.required - User credentials
 * @returns {LoginResponse} 200 - JWT token issued
 * @returns {ErrorResponse} 401 - Invalid credentials
 * @returns {ErrorResponse} 400 - Invalid request body
 */
router.post('/login', 
  limiter(), 
  validateBody(loginSchema),
  audit('AUTH_LOGIN', (req, res) => ({ 
    username: req.body?.username, 
    success: res.statusCode === 200,
    ip: req.ip 
  })),
  async (req, res) => {
    try {
      const { username, password } = req.body;

      // In production, validate against IdP and sign JWT.
      // For now, this is a stub implementation for testing
      if (username && password) {
        // Create a mock JWT response
        const mockToken = `mock.${Buffer.from(JSON.stringify({
          sub: username,
          username: username,
          roles: username === 'admin' ? ['admin', 'user'] : ['user'],
          scopes: username === 'admin' ? ['read', 'write'] : ['read', 'write'],
          iat: Math.floor(Date.now() / 1000),
          exp: Math.floor(Date.now() / 1000) + 3600
        })).toString('base64')}.signature`;

        return res.status(200).json({ 
          token: mockToken,
          expiresIn: 3600,
          tokenType: 'Bearer',
          user: {
            username: username,
            roles: username === 'admin' ? ['admin', 'user'] : ['user'],
            scopes: username === 'admin' ? ['read', 'write'] : ['read', 'write']
          }
        });
      }

      return res.status(401).json({ 
        status: 'error', 
        message: 'Invalid credentials',
        requestId: req.requestId
      });
    } catch (error) {
      return res.status(500).json({ 
        status: 'error', 
        message: 'Internal server error',
        requestId: req.requestId
      });
    }
  }
);

/**
 * POST /api/auth/logout
 * Logout user and invalidate JWT
 * @summary Logout user and invalidate JWT
 * @tags Auth
 * @returns {void} 204 - Logged out successfully
 * @returns {ErrorResponse} 401 - Unauthorized
 * @security bearerAuth
 */
router.post('/logout', 
  requireAuth,
  audit('AUTH_LOGOUT', (req) => ({ 
    user: req.user?.sub,
    ip: req.ip 
  })),
  async (req, res) => {
    // In production, you would invalidate the token in a blacklist/cache
    // For now, just return success
    return res.status(204).send();
  }
);

/**
 * GET /api/auth/profile
 * Get authenticated user's profile
 * @summary Get authenticated user's profile
 * @tags Auth
 * @returns {UserProfile} 200 - User profile
 * @returns {ErrorResponse} 401 - Unauthorized
 * @security bearerAuth
 */
router.get('/profile', 
  requireAuth,
  async (req, res) => {
    try {
      return res.status(200).json({
        user: {
          sub: req.user.sub,
          username: req.user.name || req.user.sub,
          email: req.user.email,
          roles: req.user.roles,
          scopes: req.user.scopes
        },
        requestId: req.requestId
      });
    } catch (error) {
      return res.status(500).json({ 
        status: 'error', 
        message: 'Internal server error',
        requestId: req.requestId
      });
    }
  }
);

module.exports = router;
