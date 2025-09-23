const { requireAuth, requireRole, requireScope } = require('./auth');
const { validateBody, limiter } = require('./policies');

module.exports = {
  requireAuth,
  requireRole,
  requireScope,
  validateBody,
  limiter,
};
