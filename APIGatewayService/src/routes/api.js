'use strict';

const express = require('express');
const router = express.Router();
const { requireAuth, requireRole } = require('../middleware/auth');
const { listInventory, createOrder, sendNotification } = require('../services/clients');

// Auth login (stub) – issues a fake JWT for bootstrap
/**
 * POST /auth/login
 * body: { username, password }
 * returns: { token }
 */
router.post('/auth/login', async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ status: 'error', message: 'username and password are required' });
  }
  // In production, validate against IdP and sign JWT.
  const token = `stub.${Buffer.from(username).toString('base64')}.token`;
  return res.status(200).json({ token });
});

// Users listing (admin protected, stub)
router.get('/users', requireAuth, requireRole('admin'), async (_req, res) => {
  return res.status(200).json([{ id: 'u1', name: 'Admin User' }]);
});

// Inventory list – proxy to Business Logic
router.get('/inventory', requireAuth, async (req, res, next) => {
  try {
    const data = await listInventory(req.user?.token);
    return res.status(200).json(data);
  } catch (e) { next(e); }
});

// Orders – create – proxy to Business Logic
router.post('/orders', requireAuth, async (req, res, next) => {
  try {
    const created = await createOrder(req.user?.token, req.body);
    return res.status(201).json(created);
  } catch (e) { next(e); }
});

// Notifications – send – proxy to Notification Service
router.post('/notifications', requireAuth, async (req, res, next) => {
  try {
    const result = await sendNotification(req.user?.token, req.body);
    return res.status(200).json(result);
  } catch (e) { next(e); }
});

module.exports = router;
