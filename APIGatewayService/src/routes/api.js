'use strict';

const express = require('express');
const router = express.Router();
const { requireAuth, requireRole, requireAnyRole, adminOnly } = require('../middleware/auth');
const { rateLimitTiers } = require('../middleware/security');
const { validateBody } = require('../middleware/policies');
const { audit } = require('../services/logging');
const {
  listInventory,
  createOrder,
  sendNotification,
  getUsers,
  createUser,
  getUserById,
  updateUser,
  deleteUser,
  getCustomers,
  createCustomer,
  getSupportTickets,
  createSupportTicket
} = require('../services/clients');

const rateLimits = rateLimitTiers();

// JSON Schemas for request validation
const loginSchema = {
  type: 'object',
  properties: {
    username: { type: 'string', minLength: 1, maxLength: 255 },
    password: { type: 'string', minLength: 1, maxLength: 255 }
  },
  required: ['username', 'password'],
  additionalProperties: false
};

const orderSchema = {
  type: 'object',
  properties: {
    customerId: { type: 'string', minLength: 1 },
    items: { 
      type: 'array', 
      minItems: 1,
      items: {
        type: 'object',
        properties: {
          sku: { type: 'string', minLength: 1 },
          qty: { type: 'integer', minimum: 1 },
          price: { type: 'number', minimum: 0 }
        },
        required: ['sku', 'qty'],
        additionalProperties: true
      }
    },
    totalAmount: { type: 'number', minimum: 0 }
  },
  required: ['customerId', 'items'],
  additionalProperties: true
};

const notificationSchema = {
  type: 'object',
  properties: {
    recipient: { type: 'string', minLength: 1 },
    message: { type: 'string', minLength: 1, maxLength: 5000 },
    type: { type: 'string', enum: ['email', 'sms'] },
    subject: { type: 'string', maxLength: 255 },
    templateId: { type: 'string' },
    parameters: { type: 'object' }
  },
  required: ['recipient', 'message', 'type'],
  additionalProperties: true
};

const userSchema = {
  type: 'object',
  properties: {
    username: { type: 'string', minLength: 1, maxLength: 255 },
    email: { type: 'string', format: 'email', maxLength: 255 },
    name: { type: 'string', minLength: 1, maxLength: 255 },
    roles: { 
      type: 'array',
      items: { type: 'string', enum: ['admin', 'user', 'support', 'manager'] }
    },
    active: { type: 'boolean' }
  },
  required: ['username', 'email', 'name'],
  additionalProperties: false
};

const customerSchema = {
  type: 'object',
  properties: {
    firstName: { type: 'string', minLength: 1, maxLength: 100 },
    lastName: { type: 'string', minLength: 1, maxLength: 100 },
    email: { type: 'string', format: 'email', maxLength: 255 },
    phone: { type: 'string', maxLength: 20 }
  },
  required: ['firstName', 'lastName', 'email'],
  additionalProperties: false
};

const supportTicketSchema = {
  type: 'object',
  properties: {
    customerId: { type: 'string', minLength: 1 },
    subject: { type: 'string', minLength: 1, maxLength: 255 },
    description: { type: 'string', minLength: 1, maxLength: 5000 },
    priority: { type: 'string', enum: ['low', 'medium', 'high', 'critical'] },
    category: { type: 'string', maxLength: 100 }
  },
  required: ['customerId', 'subject', 'description'],
  additionalProperties: false
};

// =============================================================================
// AUTHENTICATION ENDPOINTS
// =============================================================================

// Auth login - Enhanced with proper JWT generation
router.post('/auth/login', 
  rateLimits.auth, 
  validateBody(loginSchema),
  audit('AUTH_LOGIN', (req, res) => ({ 
    username: req.body?.username, 
    success: res.statusCode === 200,
    ip: req.ip
  })),
  async (req, res) => {
    try {
      const { username, password } = req.body;
      
      // TODO: In production, validate against IdP/database
      // For now, demo authentication with basic validation
      if (!username || !password) {
        return res.status(400).json({ 
          status: 'error', 
          message: 'Username and password required',
          requestId: req.requestId
        });
      }
      
      // Demo JWT generation (replace with real authentication)
      const jwt = require('jsonwebtoken');
      const secret = process.env.JWT_SECRET || 'demo-secret-key';
      
      const roles = username === 'admin' ? ['admin', 'user'] : ['user'];
      const token = jwt.sign(
        {
          sub: username,
          username,
          roles,
          scopes: ['read', 'write'],
          iat: Math.floor(Date.now() / 1000),
          exp: Math.floor(Date.now() / 1000) + 3600
        },
        secret,
        { algorithm: 'HS256' }
      );
      
      return res.status(200).json({ 
        token, 
        expiresIn: 3600,
        tokenType: 'Bearer',
        user: {
          username,
          roles,
          scopes: ['read', 'write']
        }
      });
    } catch (error) {
      return res.status(500).json({
        status: 'error',
        message: 'Authentication service error',
        requestId: req.requestId
      });
    }
  }
);

// Auth logout
router.post('/auth/logout',
  rateLimits.api,
  requireAuth,
  audit('AUTH_LOGOUT', (req, res) => ({ 
    user: req.user?.sub 
  })),
  async (req, res) => {
    // TODO: In production, invalidate token in token store/blacklist
    return res.status(204).send();
  }
);

// Get current user profile
router.get('/auth/profile',
  rateLimits.api,
  requireAuth,
  async (req, res) => {
    return res.status(200).json({
      user: {
        sub: req.user.sub,
        username: req.user.name || req.user.sub,
        email: req.user.email,
        roles: req.user.roles,
        scopes: req.user.scopes
      }
    });
  }
);

// =============================================================================
// USER MANAGEMENT ENDPOINTS (Admin Only)
// =============================================================================

// List users (admin only)
router.get('/users', 
  rateLimits.api, 
  requireAuth, 
  adminOnly,
  audit('USERS_LIST', (req, res) => ({ 
    actor: req.user?.sub,
    count: Array.isArray(res.locals.data) ? res.locals.data.length : 0
  })),
  async (req, res, next) => {
    try {
      const users = await getUsers(req.user?.token, {
        requestId: req.requestId,
        actor: req.user?.sub,
      });
      res.locals.data = users;
      return res.status(200).json(users);
    } catch (e) { 
      next(e); 
    }
  }
);

// Create user (admin only)
router.post('/users',
  rateLimits.api,
  requireAuth,
  adminOnly,
  validateBody(userSchema),
  audit('USER_CREATE', (req, res) => ({ 
    username: req.body?.username,
    actor: req.user?.sub,
    success: res.statusCode === 201
  })),
  async (req, res, next) => {
    try {
      const user = await createUser(req.user?.token, req.body, {
        requestId: req.requestId,
        actor: req.user?.sub,
      });
      return res.status(201).json(user);
    } catch (e) { 
      next(e); 
    }
  }
);

// Get user by ID (admin only)
router.get('/users/:id',
  rateLimits.api,
  requireAuth,
  adminOnly,
  async (req, res, next) => {
    try {
      const user = await getUserById(req.user?.token, req.params.id, {
        requestId: req.requestId,
        actor: req.user?.sub,
      });
      return res.status(200).json(user);
    } catch (e) { 
      next(e); 
    }
  }
);

// =============================================================================
// INVENTORY ENDPOINTS
// =============================================================================

// Get inventory list
router.get('/inventory', 
  rateLimits.api, 
  requireAuth, 
  async (req, res, next) => {
    try {
      const data = await listInventory(req.user?.token, {
        requestId: req.requestId,
        actor: req.user?.sub,
        query: req.query
      });
      return res.status(200).json(data);
    } catch (e) { 
      next(e); 
    }
  }
);

// =============================================================================
// ORDER ENDPOINTS
// =============================================================================

// Create order
router.post('/orders',
  rateLimits.api,
  requireAuth,
  validateBody(orderSchema),
  audit('ORDER_CREATE', (req, res) => ({ 
    customerId: req.body?.customerId, 
    itemCount: req.body?.items?.length,
    totalAmount: req.body?.totalAmount,
    actor: req.user?.sub,
    success: res.statusCode === 201
  })),
  async (req, res, next) => {
    try {
      const created = await createOrder(req.user?.token, req.body, { 
        requestId: req.requestId, 
        actor: req.user?.sub 
      });
      return res.status(201).json(created);
    } catch (e) { 
      next(e); 
    }
  }
);

// =============================================================================
// CUSTOMER ENDPOINTS
// =============================================================================

// List customers
router.get('/customers',
  rateLimits.api,
  requireAuth,
  requireAnyRole(['admin', 'support', 'manager']),
  async (req, res, next) => {
    try {
      const customers = await getCustomers(req.user?.token, {
        requestId: req.requestId,
        actor: req.user?.sub,
        query: req.query
      });
      return res.status(200).json(customers);
    } catch (e) { 
      next(e); 
    }
  }
);

// Create customer
router.post('/customers',
  rateLimits.api,
  requireAuth,
  validateBody(customerSchema),
  audit('CUSTOMER_CREATE', (req, res) => ({ 
    email: req.body?.email,
    actor: req.user?.sub,
    success: res.statusCode === 201
  })),
  async (req, res, next) => {
    try {
      const customer = await createCustomer(req.user?.token, req.body, {
        requestId: req.requestId,
        actor: req.user?.sub,
      });
      return res.status(201).json(customer);
    } catch (e) { 
      next(e); 
    }
  }
);

// =============================================================================
// SUPPORT TICKET ENDPOINTS
// =============================================================================

// List support tickets
router.get('/support/tickets',
  rateLimits.api,
  requireAuth,
  requireAnyRole(['admin', 'support']),
  async (req, res, next) => {
    try {
      const tickets = await getSupportTickets(req.user?.token, {
        requestId: req.requestId,
        actor: req.user?.sub,
        query: req.query
      });
      return res.status(200).json(tickets);
    } catch (e) { 
      next(e); 
    }
  }
);

// Create support ticket
router.post('/support/tickets',
  rateLimits.api,
  requireAuth,
  validateBody(supportTicketSchema),
  audit('SUPPORT_TICKET_CREATE', (req, res) => ({ 
    customerId: req.body?.customerId,
    subject: req.body?.subject,
    priority: req.body?.priority,
    actor: req.user?.sub,
    success: res.statusCode === 201
  })),
  async (req, res, next) => {
    try {
      const ticket = await createSupportTicket(req.user?.token, req.body, {
        requestId: req.requestId,
        actor: req.user?.sub,
      });
      return res.status(201).json(ticket);
    } catch (e) { 
      next(e); 
    }
  }
);

// =============================================================================
// NOTIFICATION ENDPOINTS
// =============================================================================

// Send notification
router.post('/notifications',
  rateLimits.api,
  requireAuth,
  validateBody(notificationSchema),
  audit('NOTIFICATION_SEND', (req, res) => ({ 
    recipient: req.body?.recipient, 
    type: req.body?.type,
    actor: req.user?.sub,
    success: res.statusCode === 200
  })),
  async (req, res, next) => {
    try {
      const result = await sendNotification(req.user?.token, req.body, { 
        requestId: req.requestId, 
        actor: req.user?.sub 
      });
      return res.status(200).json(result);
    } catch (e) { 
      next(e); 
    }
  }
);

module.exports = router;
