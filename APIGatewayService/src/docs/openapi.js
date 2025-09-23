'use strict';
/**
 * Builds OpenAPI specification for the API Gateway at runtime.
 * This file is imported by swagger.js to serve dynamic docs.
 */
const pkg = { name: 'API Gateway Service', version: '1.0.0' };

const baseSpec = {
  openapi: '3.0.3',
  info: {
    title: 'API Gateway REST Interface',
    version: pkg.version,
    description:
      'Gateway providing unified authentication/authorization, request routing, rate limiting, logging, and policy enforcement. Proxies to BusinessLogicService and NotificationService.',
  },
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
    },
    schemas: {
      ErrorResponse: {
        type: 'object',
        properties: {
          status: { type: 'string', example: 'error' },
          message: { type: 'string' },
          details: { type: 'object' },
          requestId: { type: 'string' },
        },
        required: ['status', 'message'],
      },
      LoginRequest: {
        type: 'object',
        properties: {
          username: { type: 'string' },
          password: { type: 'string' },
        },
        required: ['username', 'password'],
      },
      LoginResponse: {
        type: 'object',
        properties: {
          token: { type: 'string' },
          expiresIn: { type: 'integer', example: 3600 },
        },
        required: ['token'],
      },
      Order: {
        type: 'object',
        properties: {
          customerId: { type: 'string' },
          items: { type: 'array', items: { type: 'object' } },
        },
        required: ['customerId', 'items'],
      },
      NotificationRequest: {
        type: 'object',
        properties: {
          recipient: { type: 'string' },
          message: { type: 'string' },
          type: { type: 'string', enum: ['email', 'sms'] },
        },
        required: ['recipient', 'message', 'type'],
      },
    },
  },
  tags: [
    { name: 'Auth', description: 'Authentication endpoints' },
    { name: 'Users', description: 'User management' },
    { name: 'Inventory', description: 'Inventory endpoints' },
    { name: 'Orders', description: 'Order endpoints' },
    { name: 'Notifications', description: 'Notification endpoints' },
    { name: 'Health', description: 'Service health' },
  ],
  paths: {
    '/api/auth/login': {
      post: {
        summary: 'Authenticate user and issue JWT token',
        tags: ['Auth'],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/LoginRequest' } } },
        },
        responses: {
          200: { description: 'JWT issued', content: { 'application/json': { schema: { $ref: '#/components/schemas/LoginResponse' } } } },
          401: { description: 'Invalid credentials', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
        },
        security: [],
      },
    },
    '/api/users': {
      get: {
        summary: 'List users (admin only)',
        tags: ['Users'],
        security: [{ bearerAuth: [] }],
        responses: {
          200: { description: 'List of users' },
          403: { description: 'Forbidden', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
        },
      },
    },
    '/api/inventory': {
      get: {
        summary: 'Get inventory list',
        tags: ['Inventory'],
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: 'Inventory data' }, 401: { description: 'Unauthorized' } },
      },
    },
    '/api/orders': {
      post: {
        summary: 'Create new order',
        tags: ['Orders'],
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/Order' } } },
        },
        responses: {
          201: { description: 'Order created' },
          400: { description: 'Invalid request' },
          401: { description: 'Unauthorized' },
        },
      },
    },
    '/api/notifications': {
      post: {
        summary: 'Send notification',
        tags: ['Notifications'],
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/NotificationRequest' } } },
        },
        responses: { 200: { description: 'Notification sent' }, 400: { description: 'Invalid request' }, 401: { description: 'Unauthorized' } },
      },
    },
    '/api/health': {
      get: {
        summary: 'System health check',
        tags: ['Health'],
        responses: {
          200: {
            description: 'OK',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: { status: { type: 'string', example: 'ok' }, timestamp: { type: 'string', format: 'date-time' } },
                },
              },
            },
          },
        },
      },
    },
  },
};

function withServers(req) {
  const host = req.get('host');
  const actualPort = req.socket.localPort;
  const protocol = req.secure ? 'https' : req.protocol;
  const hasPort = host.includes(':');
  const needsPort = !hasPort && ((protocol === 'http' && actualPort !== 80) || (protocol === 'https' && actualPort !== 443));
  const fullHost = needsPort ? `${host}:${actualPort}` : host;
  return { ...baseSpec, servers: [{ url: `${protocol}://${fullHost}` }] };
}

module.exports = { withServers };
