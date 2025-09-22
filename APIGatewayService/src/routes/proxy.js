const express = require('express');
const { authenticateJWT } = require('../middleware/auth');
const { requireRoles } = require('../middleware/rbac');
const { buildProxy } = require('../services/proxy');

const router = express.Router();

const BL_URL = process.env.BUSINESS_LOGIC_URL || 'http://localhost:4000';
const DATA_URL = process.env.DATA_SERVICE_URL || 'http://localhost:3001/api/v1';
const NOTIFY_URL = process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:5000/api/v1';

/**
 * Basic RBAC mapping for demo; adjust policies as needed.
 * Returns middleware which checks the path and enforces roles.
 */
function rbacPolicy() {
  return (req, res, next) => {
    const path = req.path.toLowerCase();

    // Admin-only access to /users
    if (path.startsWith('/users')) {
      return requireRoles(['admin'])(req, res, next);
    }

    // Orders require staff or admin to create/update/delete; reads allowed for viewer
    if (path.startsWith('/orders')) {
      if (req.method === 'GET') return requireRoles(['viewer', 'staff', 'admin'])(req, res, next);
      return requireRoles(['staff', 'admin'])(req, res, next);
    }

    // Inventory readable by all authenticated roles; write only for staff/admin
    if (path.startsWith('/inventory')) {
      if (req.method === 'GET') return requireRoles(['viewer', 'staff', 'admin'])(req, res, next);
      return requireRoles(['staff', 'admin'])(req, res, next);
    }

    // Default: require any authenticated user
    return requireRoles([])(req, res, next);
  };
}

/**
 * @swagger
 * /api/bl/{path}:
 *   get:
 *     tags: [Gateway]
 *     summary: Proxy to Business Logic Service (GET)
 *     parameters:
 *       - in: path
 *         name: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Proxied response
 *   post:
 *     tags: [Gateway]
 *     summary: Proxy to Business Logic Service (POST)
 *     parameters:
 *       - in: path
 *         name: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Proxied response
 */
router.use('/bl', authenticateJWT, rbacPolicy(), buildProxy(BL_URL, { '^/api/bl': '' }));

/**
 * @swagger
 * /api/data/{path}:
 *   get:
 *     tags: [Gateway]
 *     summary: Proxy to Data Service (GET)
 *     parameters:
 *       - in: path
 *         name: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Proxied response
 *   post:
 *     tags: [Gateway]
 *     summary: Proxy to Data Service (POST)
 *     parameters:
 *       - in: path
 *         name: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Proxied response
 */
router.use('/data', authenticateJWT, requireRoles(['staff', 'admin', 'viewer']), buildProxy(DATA_URL, { '^/api/data': '' }));

/**
 * @swagger
 * /api/notify/{path}:
 *   post:
 *     tags: [Gateway]
 *     summary: Proxy to Notification Service (POST)
 *     parameters:
 *       - in: path
 *         name: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Proxied response
 */
router.use('/notify', authenticateJWT, requireRoles(['staff', 'admin']), buildProxy(NOTIFY_URL, { '^/api/notify': '' }));

module.exports = router;
