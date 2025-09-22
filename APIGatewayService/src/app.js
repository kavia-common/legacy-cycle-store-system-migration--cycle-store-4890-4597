const cors = require('cors');
const express = require('express');
const helmet = require('helmet');
const { v4: uuidv4 } = require('uuid');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('../swagger');
const routes = require('./routes');
const logger = require('./middleware/logger');
const rateLimiter = require('./middleware/rateLimiter');

require('dotenv').config();

// Initialize express app
const app = express();

const allowedOrigins = (process.env.CORS_ORIGINS || '*').split(',').map(s => s.trim()).filter(Boolean);

app.use(helmet());
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error('CORS not allowed'), false);
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id']
}));
app.set('trust proxy', true);

// Attach request id
app.use((req, res, next) => {
  const reqId = req.header('X-Request-Id') || uuidv4();
  req.id = reqId;
  res.setHeader('X-Request-Id', reqId);
  next();
});

// Request logging
app.use(logger);

// Rate limiting (global)
app.use(rateLimiter);

// Parse JSON request body with limit and error handling
app.use(express.json({ limit: '1mb' }));

// Swagger UI with dynamic server URL
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

// Mount routes
app.use('/', routes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    status: 'error',
    errorCode: 'NOT_FOUND',
    message: 'Route not found',
    requestId: req.id,
  });
});

// Centralized error handling middleware
app.use((err, req, res, next) => {
  // eslint-disable-next-line no-console
  console.error(`[${req.id}]`, err);
  const status = err.status || 500;
  const message = status === 500 ? 'Internal Server Error' : err.message;
  res.status(status).json({
    status: 'error',
    errorCode: err.code || 'INTERNAL_SERVER_ERROR',
    message,
    details: process.env.NODE_ENV === 'production' ? undefined : err.details,
    requestId: req.id,
  });
});

module.exports = app;
