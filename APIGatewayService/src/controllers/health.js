const healthService = require('../services/health');

class HealthController {
  /**
   * GET / and GET /api/health
   * Returns basic service health information.
   * Response: { status: string, message: string, timestamp: ISO, environment: string }
   */
  check(_req, res) {
    const healthStatus = healthService.getStatus();
    return res.status(200).json(healthStatus);
  }
}

module.exports = new HealthController();
