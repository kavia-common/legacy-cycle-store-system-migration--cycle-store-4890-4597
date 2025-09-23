const cors = require('cors');
const express = require('express');
const routes = require('./routes');
const api = require('./routes/api');
const auth = require('./routes/auth');
const health = require('./routes/health');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('../swagger');
const { requestLogger, errorLogger } = require('./services/logging');
const { limiter } = require('./middleware/policies');
const { securityHeaders } = require('./middleware/security');
const { withServers } = require('./docs/openapi');

// Initialize express app
const app = express();

// Trust proxy configuration based on environment
const nodeEnv = process.env.NODE_ENV || 'development';
if (nodeEnv === 'production') {
  app.set('trust proxy', true);
} else if (nodeEnv === 'test') {
  app.set('trust proxy', 'loopback');
} else {
  app.set('trust proxy', 'loopback');
}

// Security headers
app.use(securityHeaders());

// CORS configuration with proper preflight handling
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id'],
  optionsSuccessStatus: 200, // Set status code for successful OPTIONS requests
  preflightContinue: false   // Pass control to next handler
}));

// Global request logger and JSON parser
app.use(requestLogger);

// Content type validation middleware
app.use((req, res, next) => {
  // Only check content-type for requests with body
  if (['POST', 'PUT', 'PATCH'].includes(req.method) && req.get('content-length') !== '0') {
    const contentType = req.get('content-type');
    if (contentType && !contentType.includes('application/json')) {
      return res.status(415).json({
        status: 'error',
        message: 'Unsupported Media Type - application/json required',
        requestId: req.requestId
      });
    }
  }
  next();
});

app.use(express.json({ limit: '1mb' }));

// Global lightweight rate limiter baseline
app.use(limiter());

// Health and monitoring routes (no auth required)
app.use('/', health);

// Docs with dynamic server resolution
app.use('/docs', swaggerUi.serve, (req, res, next) => {
  const dynamicSpec = withServers(req);
  swaggerUi.setup(dynamicSpec, { explorer: true })(req, res, next);
});

// OpenAPI spec endpoint
app.get('/openapi.json', (req, res) => {
  const dynamicSpec = withServers(req);
  res.json(dynamicSpec);
});

// Mount routes
app.use('/', routes);
app.use('/api', api);
app.use('/api/auth', auth);

// 404 handler for unknown routes
app.use('*', (req, res) => {
  res.status(404).json({
    status: 'error',
    message: `Route ${req.method} ${req.originalUrl} not found`,
    requestId: req.requestId
  });
});

// Error logging and standardized error response
app.use(errorLogger);
app.use((err, req, res, _next) => {
  const status = err.status || 500;
  const message = err?.details?.message || err.message || 'Internal Server Error';
  
  res.status(status).json({
    status: 'error',
    message: message,
    details: process.env.DEV_DETAILED_ERRORS === 'true' ? err.details : undefined,
    requestId: req.requestId,
  });
});

module.exports = app;
