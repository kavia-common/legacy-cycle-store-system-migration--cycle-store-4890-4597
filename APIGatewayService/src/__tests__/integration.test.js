'use strict';

const request = require('supertest');
const jwt = require('jsonwebtoken');

// Set test environment variables before importing app
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-key-for-testing-purposes-only';
process.env.HEALTH_CHECK_DEPENDENCIES = 'false';
process.env.CIRCUIT_BREAKER_ENABLED = 'false';
process.env.AUDIT_ENABLED = 'false';
process.env.LOG_LEVEL = 'error';
process.env.DEV_DETAILED_ERRORS = 'true';

const app = require('../app');

const SECRET = process.env.JWT_SECRET;

describe('API Gateway Integration Tests', () => {
  let adminToken, userToken, invalidToken;

  beforeAll(() => {
    // Create test tokens
    adminToken = jwt.sign({
      sub: 'admin-user',
      username: 'admin-user',
      roles: ['admin', 'user'],
      scopes: ['read', 'write'],
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600
    }, SECRET);

    userToken = jwt.sign({
      sub: 'regular-user',
      username: 'regular-user',
      roles: ['user'],
      scopes: ['read'],
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600
    }, SECRET);

    invalidToken = 'invalid.token.here';
  });

  describe('Health Endpoints', () => {
    test('GET /health should return basic health status', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body).toMatchObject({
        status: 'healthy',
        environment: 'test'
      });
      expect(response.body.requestId).toBeDefined();
    });

    test('GET /ready should return readiness status', async () => {
      const response = await request(app)
        .get('/ready')
        .expect(200);

      expect(response.body).toMatchObject({
        status: 'ready',
        environment: 'test'
      });
    });

    test('GET /metrics should return Prometheus-style metrics', async () => {
      const response = await request(app)
        .get('/metrics')
        .expect(200);

      expect(response.text).toContain('api_gateway_uptime_seconds');
      expect(response.text).toContain('api_gateway_memory_usage_bytes');
      expect(response.headers['content-type']).toBe('text/plain; charset=utf-8');
    });
  });

  describe('Authentication Endpoints', () => {
    test('POST /api/auth/login should accept valid credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'testuser',
          password: 'testpass'
        })
        .expect(200);

      expect(response.body).toMatchObject({
        token: expect.any(String),
        expiresIn: 3600,
        tokenType: 'Bearer',
        user: {
          username: 'testuser',
          roles: ['user'],
          scopes: ['read', 'write']
        }
      });
    });

    test('POST /api/auth/login should reject missing credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({})
        .expect(400);

      expect(response.body).toMatchObject({
        status: 'error',
        message: expect.stringContaining('Invalid request body')
      });
    });

    test('POST /api/auth/logout should work with valid token', async () => {
      await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(204);
    });

    test('GET /api/auth/profile should return user profile', async () => {
      const response = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        user: {
          sub: 'regular-user',
          username: 'regular-user', // Updated to match actual token content
          roles: ['user'],
          scopes: ['read']
        }
      });
    });
  });

  describe('Authorization Tests', () => {
    test('Admin endpoints should require admin role', async () => {
      // User token should be rejected
      await request(app)
        .get('/api/users')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);

      // Admin token should be accepted (but may fail due to missing backend)
      const response = await request(app)
        .get('/api/users')
        .set('Authorization', `Bearer ${adminToken}`);
      
      // Should either succeed (200) or fail due to backend unavailability (500+)
      expect([200, 500, 503, 504]).toContain(response.status);
    });

    test('Protected endpoints should require authentication', async () => {
      await request(app)
        .get('/api/inventory')
        .expect(401);

      await request(app)
        .get('/api/inventory')
        .set('Authorization', 'Invalid')
        .expect(401);
    });

    test('Invalid tokens should be rejected', async () => {
      await request(app)
        .get('/api/inventory')
        .set('Authorization', `Bearer ${invalidToken}`)
        .expect(401);
    });
  });

  describe('Request Validation', () => {
    test('Should validate request bodies', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          username: '', // Invalid: empty string
          password: 'valid'
        });

      // Should be 400 for validation error
      expect([400, 422]).toContain(response.status);
      expect(response.body).toMatchObject({
        status: 'error'
      });
    });

    test('Should reject unsupported content types', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .set('Content-Type', 'text/plain')
        .send('invalid data')
        .expect(415);

      expect(response.body).toMatchObject({
        status: 'error',
        message: expect.stringContaining('Unsupported Media Type')
      });
    });
  });

  describe('Error Handling', () => {
    test('Should return 404 for unknown routes', async () => {
      const response = await request(app)
        .get('/api/nonexistent')
        .expect(404);

      expect(response.body).toMatchObject({
        status: 'error',
        message: expect.stringContaining('not found')
      });
    });

    test('Should include request IDs in error responses', async () => {
      const response = await request(app)
        .get('/api/nonexistent')
        .expect(404);

      expect(response.body.requestId).toBeDefined();
      expect(typeof response.body.requestId).toBe('string');
    });
  });

  describe('CORS Configuration', () => {
    test('Should include CORS headers', async () => {
      const response = await request(app)
        .options('/api/auth/login')
        .expect(200);

      expect(response.headers['access-control-allow-origin']).toBeDefined();
      expect(response.headers['access-control-allow-methods']).toBeDefined();
      expect(response.headers['access-control-allow-headers']).toBeDefined();
    });
  });

  describe('Security Headers', () => {
    test('Should include security headers', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      // Check for helmet security headers
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-dns-prefetch-control']).toBe('off');
    });

    test('Should not expose Express framework', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.headers['x-powered-by']).toBeUndefined();
    });
  });

  describe('API Documentation', () => {
    test('GET /docs should serve Swagger UI', async () => {
      const response = await request(app)
        .get('/docs/')
        .expect(200);

      expect(response.text).toContain('swagger');
      expect(response.headers['content-type']).toContain('text/html');
    });

    test('GET /openapi.json should return OpenAPI spec', async () => {
      const response = await request(app)
        .get('/openapi.json')
        .expect(200);

      expect(response.body).toMatchObject({
        openapi: expect.stringMatching(/^3\./),
        info: expect.objectContaining({
          title: expect.any(String),
          version: expect.any(String)
        }),
        paths: expect.any(Object)
      });
    });
  });
});
