const express = require('express');
const healthController = require('../controllers/health');

const router = express.Router();

/**
 * Root health endpoint (GET /)
 */
router.get('/', healthController.check.bind(healthController));

/**
 * Also expose /api/health for parity with other services
 */
router.get('/api/health', healthController.check.bind(healthController));

module.exports = router;
