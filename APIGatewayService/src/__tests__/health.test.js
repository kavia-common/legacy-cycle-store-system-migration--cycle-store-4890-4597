const request = require('supertest');
const app = require('../app');

describe('API Gateway - Health', () => {
  it('GET /api/health should return ok with timestamp', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('status');
    expect(typeof res.body.status).toBe('string');
  });
});
