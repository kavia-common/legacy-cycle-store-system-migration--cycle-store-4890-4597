'use strict';

const express = require('express');
const router = express.Router();
const { requireAuth, requireRole } = require('../middleware/auth');
const { listInventory, createOrder, sendNotification } = require('../services/clients');
const { validateBody, limiter } = require('../middleware/policies');
const { audit } = require('../services/logging');

// JSON Schemas for request validation
const orderSchema = {
  type: 'object',
  properties: {
    customerId: { type: 'string', minLength: 1 },
    items: { type: 'array', minItems: 1, items: { type: 'object' } },
  },
  required: ['customerId', 'items'],
  additionalProperties: true,
};

const notificationSchema = {
  type: 'object',
  properties: {
    recipient: { type: 'string', minLength: 1 },
    message: { type: 'string', minLength: 1 },
    type: { type: 'string', enum: ['email', 'sms'] },
  },
  required: ['recipient', 'message', 'type'],
  additionalProperties: true,
};

// Auth login (stub) – issues a fake JWT for bootstrap
router.post('/auth/login', limiter(), validateBody({
  type: 'object',
  properties: { username: { type: 'string' }, password: { type: 'string' } },
  required: ['username', 'password'],
}), async (req, res) => {
  const { username } = req.body || {};
  // In production, validate against IdP and sign JWT.
  const token = `stub.${Buffer.from(username).toString('base64')}.token`;
  return res.status(200).json({ token, expiresIn: 3600 });
});

// Users listing (admin protected, stub)
router.get('/users', limiter(), requireAuth, requireRole('admin'), async (_req, res) => {
  return res.status(200).json([{ id: 'u1', name: 'Admin User' }]);
});

// Inventory list – proxy to Business Logic
router.get('/inventory', limiter(), requireAuth, async (req, res, next) => {
  try {
    const data = await listInventory(req.user?.token, {
      requestId: req.requestId,
      actor: req.user?.sub,
    });
    return res.status(200).json(data);
  } catch (e) { next(e); }
});

// Orders – create – proxy to Business Logic
router.post(
  '/orders',
  limiter(),
  requireAuth,
  validateBody(orderSchema),
  audit('ORDER_CREATE', (req, res) => ({ customerId: req.body?.customerId, createdStatus: res.statusCode })),
  async (req, res, next) => {
    try {
      const created = await createOrder(req.user?.token, req.body, { requestId: req.requestId, actor: req.user?.sub });
      return res.status(201).json(created);
    } catch (e) { next(e); }
  }
);

// Notifications – send – proxy to Notification Service
router.post(
  '/notifications',
  limiter(),
  requireAuth,
  validateBody(notificationSchema),
  audit('NOTIFICATION_SEND', (req, res) => ({ recipient: req.body?.recipient, type: req.body?.type, status: res.statusCode })),
  async (req, res, next) => {
    try {
      const result = await sendNotification(req.user?.token, req.body, { requestId: req.requestId, actor: req.user?.sub });
      return res.status(200).json(result);
    } catch (e) { next(e); }
  }
);

module.exports = router;
