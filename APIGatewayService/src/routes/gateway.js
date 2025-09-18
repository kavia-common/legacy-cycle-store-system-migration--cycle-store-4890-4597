'use strict';

const express = require('express');
const { body } = require('express-validator');
const { authenticateJWT, authorizeRoles } = require('../middleware/auth');
const { validateRequest } = require('../middleware/validation');
const { asyncHandler, errorBody } = require('../utils/http');
const clients = require('../services/internalClients');

const router = express.Router();

/**
 * @swagger
 * /auth/login:
 *   post:
 *     summary: Authenticate user and issue JWT token
 */
router.post(
  '/auth/login',
  [
    body('username').isString().notEmpty(),
    body('password').isString().notEmpty(),
    validateRequest,
  ],
  asyncHandler(async (req, res) => {
    const auth = require('../controllers/auth');
    return auth.login(req, res);
  })
);

/**
 * @swagger
 * /users:
 *   get:
 *     summary: List users (admin only)
 */
router.get(
  '/users',
  authenticateJWT,
  authorizeRoles(['admin']),
  asyncHandler(async (req, res) => {
    // This would typically call a UserService; using BusinessLogic as placeholder
    const resp = await clients.businessLogic.get('/customers'); // placeholder mapping
    return res.status(200).json(resp.data);
  })
);

/**
 * @swagger
 * /orders:
 *   post:
 *     summary: Create new order
 */
router.post(
  '/orders',
  authenticateJWT,
  [
    body('customerId').isString().notEmpty(),
    body('items').isArray({ min: 1 }),
    validateRequest,
  ],
  asyncHandler(async (req, res) => {
    // Route to Business Logic Service for processing sales/orders
    try {
      const resp = await clients.businessLogic.post('/sales', req.body);
      return res.status(201).json(resp.data);
    } catch (e) {
      if (e.response?.status === 400) {
        return res.status(400).json(errorBody('INVALID_REQUEST', 'Invalid order data', e.response.data));
      }
      if (e.response?.status === 401) {
        return res.status(401).json(errorBody('UNAUTHORIZED', 'Unauthorized'));
      }
      throw e;
    }
  })
);

/**
 * @swagger
 * /inventory:
 *   get:
 *     summary: Get inventory list
 */
router.get(
  '/inventory',
  authenticateJWT,
  asyncHandler(async (req, res) => {
    // depending on architecture, inventory can be exposed via BusinessLogic or DataService
    const resp = await clients.businessLogic.get('/inventory');
    return res.status(200).json(resp.data);
  })
);

/**
 * @swagger
 * /notifications:
 *   post:
 *     summary: Send notification
 */
router.post(
  '/notifications',
  authenticateJWT,
  [
    body('recipient').isString().notEmpty(),
    body('message').isString().notEmpty(),
    body('type').isString().isIn(['email', 'sms']),
    validateRequest,
  ],
  asyncHandler(async (req, res) => {
    // Translate to Notification Service schema
    const payload = {
      type: req.body.type,
      recipients: [{ recipientId: req.body.recipient, type: 'user' }],
      templateId: 'direct-message',
      parameters: { message: req.body.message },
    };
    try {
      const resp = await clients.notificationService.post('/notifications', payload);
      return res.status(200).json(resp.data);
    } catch (e) {
      const status = e.response?.status || 500;
      if (status === 400) return res.status(400).json(errorBody('INVALID_REQUEST', 'Invalid request'));
      if (status === 401) return res.status(401).json(errorBody('UNAUTHORIZED', 'Unauthorized'));
      throw e;
    }
  })
);

/**
 * @swagger
 * /health:
 *   get:
 *     summary: System health check
 */
router.get(
  '/health',
  asyncHandler(async (req, res) => {
    return res.status(200).json({ status: 'ok' });
  })
);

module.exports = router;
