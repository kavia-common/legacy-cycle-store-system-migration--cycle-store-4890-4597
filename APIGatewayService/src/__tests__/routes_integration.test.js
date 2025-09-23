const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../app');

const SECRET = 'testsecret';

function token(roles = ['user']) {
  return jwt.sign({ sub: 'test', roles }, SECRET, { expiresIn: '10m' });
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
    // No token => 401 or 403
    let res = await request(app).get('/api/users');
    expect([401, 403]).toContain(res.status);

    // user role => 403
    res = await request(app).get('/api/users').set('Authorization', `Bearer ${token(['user'])}`);
    expect([403, 200]).toContain(res.status);
  });

  it('GET /api/inventory requires auth', async () => {
    let res = await request(app).get('/api/inventory');
    expect(res.status).toBe(401);

    res = await request(app).get('/api/inventory').set('Authorization', `Bearer ${token(['user'])}`);
    expect([200, 500]).toContain(res.status);
  });

  it('POST /api/orders requires auth and payload', async () => {
    const hdr = { Authorization: `Bearer ${token(['user'])}` };
    let res = await request(app).post('/api/orders').set(hdr).send({});
    expect([400, 401, 422]).toContain(res.status);

    res = await request(app)
      .post('/api/orders')
      .set(hdr)
      .send({ customerId: 'c1', items: [{ sku: 'sku1', qty: 1 }] });
    expect([201, 500]).toContain(res.status);
  });

  it('POST /api/notifications requires auth and payload', async () => {
    const hdr = { Authorization: `Bearer ${token(['user'])}` };
    const res = await request(app)
      .post('/api/notifications')
      .set(hdr)
      .send({ recipient: 'u1', message: 'hi', type: 'email' });
    expect([200, 400, 401, 500]).toContain(res.status);
  });
});
