'use strict';

/**
 * Central configuration loader for API Gateway.
 * Values are sourced from environment variables. Do not hardcode secrets.
 */
const config = {
  env: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT || 3000),
  host: process.env.HOST || '0.0.0.0',

  // JWT settings (for token verification/issuance)
  jwt: {
    issuer: process.env.JWT_ISSUER || 'cyclestore-api-gateway',
    audience: process.env.JWT_AUDIENCE || 'cyclestore-clients',
    algorithm: process.env.JWT_ALG || 'HS256',
    // This secret must be provided by orchestrator in .env
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN || '1h',
  },

  // Downstream service endpoints
  services: {
    businessLogic: process.env.BUSINESS_LOGIC_URL || 'http://business-logic:4000',
    dataService: process.env.DATA_SERVICE_URL || 'http://data-service:5000',
    notificationService: process.env.NOTIFICATION_SERVICE_URL || 'http://notification-service:6000',
    monitoringService: process.env.MONITORING_SERVICE_URL || 'http://monitoring-service:7000',
    testAutomationService: process.env.TEST_AUTOMATION_SERVICE_URL || 'http://test-automation:8000',
  },

  // Rate limiting
  rateLimit: {
    windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS || 60_000),
    max: Number(process.env.RATE_LIMIT_MAX || 100),
    standardHeaders: true,
    legacyHeaders: false,
  },

  // CORS
  cors: {
    origin: process.env.CORS_ORIGIN || '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id'],
  },
};

module.exports = config;
