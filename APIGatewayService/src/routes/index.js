const express = require('express');
const healthController = require('../controllers/health');
const authRoutes = require('./auth');
const userRoutes = require('./user');
const proxyRoutes = require('./proxy');

const router = express.Router();

/**
 * @swagger
 * /:
 *   get:
 *     tags: [Health]
 *     summary: Health endpoint
 *     responses:
 *       200:
 *         description: Service health check passed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: ok
 *                 message:
 *                   type: string
 *                   example: Service is healthy
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                 environment:
 *                   type: string
 *                   example: development
 */
router.get('/', healthController.check.bind(healthController));

// Auth endpoints
router.use('/auth', authRoutes);

// User endpoints
router.use('/api/user', userRoutes);

// Proxies to backend services
router.use('/api', proxyRoutes);

module.exports = router;
