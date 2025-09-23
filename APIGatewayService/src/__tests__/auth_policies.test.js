const jwt = require('jsonwebtoken');
const policies = require('../middleware/policies');
const auth = require('../middleware/auth');

function mockReqRes(next = jest.fn()) {
  const req = { headers: {}, user: null };
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
  };
  return { req, res, next };
}

describe('API Gateway - Auth middleware', () => {
  const SECRET = 'testsecret';

  beforeAll(() => {
    process.env.JWT_SECRET = SECRET;
  });

  it('should 401 when no auth header', () => {
    const { req, res, next } = mockReqRes();
    auth(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('should set req.user when valid token', () => {
    const token = jwt.sign({ sub: 'u1', roles: ['admin'] }, SECRET);
    const { req, res, next } = mockReqRes(jest.fn());
    req.headers.authorization = `Bearer ${token}`;
    auth(req, res, next);
    expect(req.user).toBeTruthy();
    expect(req.user.roles).toContain('admin');
  });
});

describe('API Gateway - RBAC policies', () => {
  it('adminOnly should 403 if no user', () => {
    const { req, res, next } = mockReqRes(jest.fn());
    policies.adminOnly(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('adminOnly should pass for admin role', () => {
    const { req, res, next } = mockReqRes(jest.fn());
    req.user = { roles: ['admin'] };
    policies.adminOnly(req, res, next);
    expect(next).toHaveBeenCalled();
  });
});
