const cors = require('cors');
const express = require('express');
const routes = require('./routes');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('../swagger');
const api = require('./routes/api');
const { requestLogger, errorLogger } = require('./services/logging');
const { limiter } = require('./middleware/policies');
const { withServers } = require('./docs/openapi');

// Initialize express app
const app = express();

// Security headers (basic)
app.disable('x-powered-by');

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id']
}));
app.set('trust proxy', true);

// Global request logger and JSON parser
app.use(requestLogger);
app.use(express.json({ limit: '1mb' }));

// Global lightweight rate limiter baseline
app.use(limiter());

// Docs with dynamic server resolution
app.use('/docs', swaggerUi.serve, (req, res, next) => {
  const dynamicSpec = withServers(req);
  swaggerUi.setup(dynamicSpec, { explorer: true })(req, res, next);
});

// Mount routes
app.use('/', routes);
app.use('/api', api);

// Error logging and standardized error response
app.use(errorLogger);
app.use((err, req, res, _next) => {
  const status = err.status || 500;
  res.status(status).json({
    status: 'error',
    message: err?.details?.message || err.message || 'Internal Server Error',
    details: err.details || undefined,
    requestId: req.requestId,
  });
});

module.exports = app;
