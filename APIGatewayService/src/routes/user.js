const express = require('express');
const { authenticateJWT } = require('../middleware/auth');

const router = express.Router();

/**
 * @swagger
 * /api/user/profile:
 *   get:
 *     tags: [User]
 *     summary: Get authenticated user's profile
 *     responses:
 *       200:
 *         description: User profile
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required: [id, name, email, roles]
 *               properties:
 *                 id:
 *                   type: string
 *                 username:
 *                   type: string
 *                 name:
 *                   type: string
 *                 email:
 *                   type: string
 *                 roles:
 *                   type: array
 *                   items:
 *                     type: string
 */
router.get('/profile', authenticateJWT, (req, res) => {
  const { sub, username, name, email, roles } = req.user || {};
  return res.json({
    id: sub,
    username,
    name,
    email,
    roles: Array.isArray(roles) ? roles : [],
  });
});

module.exports = router;
