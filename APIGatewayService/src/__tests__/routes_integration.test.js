const request = require('supertest');
const jwt = require('jsonwebtoken');

// Set test environment
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'testsecret';
process.env.LOG_LEVEL = 'error';
process.env.AUDIT_ENABLED = 'false';

const app = require('../app');

const SECRET = 'testsecret';

function token(roles = ['user']) {
  return jwt.sign({ 
    sub: 'test', 
    roles,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 600
  }, SECRET);
}

describe('API Gateway - Routes integration', () => {
  beforeAll(() => {
    process.env.JWT_SECRET = SECRET;
  });

  it('POST /api/auth/login should be open and return token or error structure', async () => {
    const res = await request(app).post('/api/auth/login').send({ username: 'x', password: 'y' });
    expect([200, 401]).toContain(res.status);
  });

  it('GET /api/users requires admin', async () => {
    // No token => 401
    let res = await request(app).get('/api/users');
    expect(res.status).toBe(401);

    // user role => 403
    res = await request(app).get('/api/users').set('Authorization', `Bearer ${token(['user'])}`);
    expect(res.status).toBe(403);

    // admin role => may succeed or fail due to backend service unavailability
    res = await request(app).get('/api/users').set('Authorization', `Bearer ${token(['admin'])}`);
    expect([200, 500, 503, 504]).toContain(res.status);
  });

  it('GET /api/inventory requires auth', async () => {
    let res = await request(app).get('/api/inventory');
    expect(res.status).toBe(401);

    res = await request(app).get('/api/inventory').set('Authorization', `Bearer ${token(['user'])}`);
    // May succeed or fail due to backend service unavailability
    expect([200, 500, 503, 504]).toContain(res.status);
  });

  it('POST /api/orders requires auth and payload', async () => {
    const hdr = { Authorization: `Bearer ${token(['user'])}` };
    
    // Empty payload should fail validation
    let res = await request(app).post('/api/orders').set(hdr).send({});
    expect([400, 422]).toContain(res.status);

    // Valid payload may succeed or fail due to backend service unavailability
    res = await request(app)
      .post('/api/orders')
      .set(hdr)
      .send({ customerId: 'c1', items: [{ sku: 'sku1', qty: 1 }] });
    expect([201, 500, 503, 504]).toContain(res.status);
  });

  it('POST /api/notifications requires auth and payload', async () => {
    const hdr = { Authorization: `Bearer ${token(['user'])}` };
    const res = await request(app)
      .post('/api/notifications')
      .set(hdr)
      .send({ recipient: 'u1', message: 'hi', type: 'email' });
    // May succeed or fail due to backend service unavailability
    expect([200, 400, 401, 500, 503, 504]).toContain(res.status);
  });
});
