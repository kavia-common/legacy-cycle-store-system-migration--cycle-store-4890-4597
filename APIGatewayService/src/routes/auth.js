/* eslint-disable max-len */
const express = require('express');
const { body } = require('express-validator');
const { handleValidation } = require('../middleware/validate');
const { signToken } = require('../services/token');
const { findByUsername, verifyPassword } = require('../services/users');

const router = express.Router();

/**
 * @swagger
 * /auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: Authenticate user and issue JWT token
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [username, password]
 *             properties:
 *               username:
 *                 type: string
 *                 description: Username
 *               password:
 *                 type: string
 *                 format: password
 *                 description: Password
 *     responses:
 *       200:
 *         description: JWT token issued
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required: [token, expiresIn]
 *               properties:
 *                 token:
 *                   type: string
 *                 expiresIn:
 *                   type: integer
 *       401:
 *         description: Invalid credentials
 */
router.post(
  '/login',
  body('username').isString().notEmpty(),
  body('password').isString().notEmpty(),
  handleValidation,
  async (req, res) => {
    const { username, password } = req.body;
    const user = findByUsername(username);
    const valid = await verifyPassword(user, password);
    if (!user || !valid) {
      return res.status(401).json({
        status: 'error',
        errorCode: 'INVALID_CREDENTIALS',
        message: 'Invalid username or password',
        requestId: req.id,
      });
    }
    const token = signToken({ sub: user.id, username: user.username, roles: user.roles, email: user.email, name: user.name });
    const expiresIn = Number(process.env.JWT_EXPIRES_IN || 3600);
    return res.json({ token, expiresIn });
  }
);

/**
 * @swagger
 * /auth/logout:
 *   post:
 *     tags: [Auth]
 *     summary: Logout user (client should discard the JWT)
 *     responses:
 *       204:
 *         description: Logged out successfully
 */
router.post('/logout', (req, res) => {
  // Stateless JWT - instruct client to discard token.
  return res.status(204).send();
});

module.exports = router;
