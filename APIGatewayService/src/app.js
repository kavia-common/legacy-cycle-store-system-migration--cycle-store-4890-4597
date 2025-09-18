const cors = require('cors');
const express = require('express');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('../swagger');
const config = require('./config');
const { securityMiddleware } = require('./middleware/security');
const gatewayRoutes = require('./routes/gateway');
const indexRoutes = require('./routes');
const { errorBody } = require('./utils/http');

// Initialize express app
const app = express();

app.use(cors(config.cors));
app.set('trust proxy', true);

// Apply security middleware: helmet, rate limit, logging, request id
securityMiddleware(app);

// API docs with dynamic server URL
app.use('/docs', swaggerUi.serve, (req, res, next) => {
  const host = req.get('host');
  let protocol = req.protocol;
  const actualPort = req.socket.localPort;
  const hasPort = host.includes(':');
  const needsPort =
    !hasPort &&
    ((protocol === 'http' && actualPort !== 80) ||
      (protocol === 'https' && actualPort !== 443));
  const fullHost = needsPort ? `${host}:${actualPort}` : host;
  protocol = req.secure ? 'https' : protocol;

  const dynamicSpec = {
    ...swaggerSpec,
    servers: [{ url: `${protocol}://${fullHost}` }],
  };
  swaggerUi.setup(dynamicSpec)(req, res, next);
});

// Parse JSON
app.use(express.json());

// Basic readiness at root preserved
app.use('/', indexRoutes);

// Core Gateway API routes as per OpenAPI
app.use('/', gatewayRoutes);

// 404 handler
app.use((req, res) => {
  return res.status(404).json(errorBody('NOT_FOUND', 'Route not found'));
});

// Error handling middleware
app.use((err, req, res, next) => {
  // eslint-disable-next-line no-console
  console.error(`[${req.id || '-'}]`, err);
  const status = err.status || err.response?.status || 500;
  const message = status === 500 ? 'Internal Server Error' : err.message || 'Request failed';
  return res.status(status).json(errorBody('INTERNAL_ERROR', message));
});

module.exports = app;
