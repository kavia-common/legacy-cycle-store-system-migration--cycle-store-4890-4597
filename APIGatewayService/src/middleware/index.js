const logger = require('./logger');
const rateLimiter = require('./rateLimiter');
const { authenticateJWT } = require('./auth');
const { requireRoles } = require('./rbac');
const { handleValidation } = require('./validate');

// This file will export middleware as the application grows
module.exports = {
  logger,
  rateLimiter,
  authenticateJWT,
  requireRoles,
  handleValidation,
};
