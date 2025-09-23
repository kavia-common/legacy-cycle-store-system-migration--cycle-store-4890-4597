const jwt = require('jsonwebtoken');

// Set test environment before importing modules
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'testsecret';
process.env.LOG_LEVEL = 'error';

const policies = require('../middleware/policies');
const { requireAuth, adminOnly } = require('../middleware/auth');

function mockReqRes(next = jest.fn()) {
  const req = { 
    headers: {}, 
    user: null, 
    requestId: 'test-req-123',
    ip: '127.0.0.1',
    method: 'GET',
    originalUrl: '/test',
    get: jest.fn((header) => {
      const headers = {
        'authorization': req.headers.authorization,
        'content-type': 'application/json',
        'user-agent': 'test-agent'
      };
      return headers[header.toLowerCase()];
    })
  };
  
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
    headersSent: false
  };
  
  return { req, res, next };
}

describe('API Gateway - Auth middleware', () => {
  const SECRET = 'testsecret';

  beforeAll(() => {
    process.env.JWT_SECRET = SECRET;
    process.env.NODE_ENV = 'test';
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should 401 when no auth header', () => {
    const { req, res, next } = mockReqRes();
    requireAuth(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      status: 'error',
      message: expect.stringContaining('Unauthorized')
    }));
    expect(next).not.toHaveBeenCalled();
  });

  it('should 401 when invalid auth header format', () => {
    const { req, res, next } = mockReqRes();
    req.headers.authorization = 'Invalid';
    requireAuth(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      status: 'error',
      message: expect.stringContaining('Unauthorized')
    }));
    expect(next).not.toHaveBeenCalled();
  });

  it('should 401 when invalid token', () => {
    const { req, res, next } = mockReqRes();
    req.headers.authorization = 'Bearer invalid.token.here';
    requireAuth(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      status: 'error',
      message: expect.stringContaining('Unauthorized')
    }));
    expect(next).not.toHaveBeenCalled();
  });

  it('should set req.user when valid token', () => {
    const token = jwt.sign({ 
      sub: 'u1', 
      roles: ['admin'],
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600
    }, SECRET);
    
    const { req, res, next } = mockReqRes();
    req.headers.authorization = `Bearer ${token}`;
    
    requireAuth(req, res, next);
    
    expect(req.user).toBeTruthy();
    expect(req.user.roles).toContain('admin');
    expect(req.user.sub).toBe('u1');
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('should reject expired tokens', () => {
    const expiredToken = jwt.sign({ 
      sub: 'u1', 
      roles: ['admin'],
      iat: Math.floor(Date.now() / 1000) - 7200, // 2 hours ago
      exp: Math.floor(Date.now() / 1000) - 3600  // 1 hour ago (expired)
    }, SECRET);
    
    const { req, res, next } = mockReqRes();
    req.headers.authorization = `Bearer ${expiredToken}`;
    
    requireAuth(req, res, next);
    
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      status: 'error',
      message: expect.stringContaining('expired')
    }));
    expect(next).not.toHaveBeenCalled();
  });
});

describe('API Gateway - RBAC policies', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('adminOnly should 403 if no user', () => {
    const { req, res, next } = mockReqRes();
    adminOnly(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      status: 'error',
      message: expect.stringContaining('Forbidden')
    }));
    expect(next).not.toHaveBeenCalled();
  });

  it('adminOnly should 403 if user has no roles', () => {
    const { req, res, next } = mockReqRes();
    req.user = { sub: 'user-123' }; // No roles array
    adminOnly(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      status: 'error',
      message: expect.stringContaining('Forbidden')
    }));
    expect(next).not.toHaveBeenCalled();
  });

  it('adminOnly should 403 if user lacks admin role', () => {
    const { req, res, next } = mockReqRes();
    req.user = { roles: ['user'], sub: 'user-123' };
    adminOnly(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      status: 'error',
      message: expect.stringContaining('Forbidden')
    }));
    expect(next).not.toHaveBeenCalled();
  });

  it('adminOnly should pass for admin role', () => {
    const { req, res, next } = mockReqRes();
    req.user = { roles: ['admin'], sub: 'admin-user' };
    adminOnly(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
  });

  it('adminOnly should pass for user with multiple roles including admin', () => {
    const { req, res, next } = mockReqRes();
    req.user = { roles: ['user', 'admin', 'manager'], sub: 'admin-user' };
    adminOnly(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
  });
});
