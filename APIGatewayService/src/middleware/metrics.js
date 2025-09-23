'use strict';

const metricsService = require('../services/metrics');
const { logger } = require('../services/logging');

// PUBLIC_INTERFACE
function metricsMiddleware() {
  /** Express middleware to collect request metrics */
  return (req, res, next) => {
    const startTime = Date.now();
    const originalSend = res.send;
    
    // Track request start
    req.startTime = startTime;
    
    // Override res.send to capture metrics when response is sent
    res.send = function(data) {
      const duration = Date.now() - startTime;
      const method = req.method;
      const path = req.originalUrl || req.url;
      const statusCode = res.statusCode;
      
      // Record the request metrics
      metricsService.recordRequest(method, path, statusCode, duration);
      
      // Log slow requests
      if (duration > 1000) {
        logger('warn', 'slow_request', {
          method,
          path,
          statusCode,
          duration,
          requestId: req.requestId
        });
      }
      
      // Call original send method
      return originalSend.call(this, data);
    };
    
    next();
  };
}

// PUBLIC_INTERFACE
function serviceMetricsWrapper(serviceName) {
  /** Wrapper function to track backend service calls */
  return (originalFunction) => {
    return async (...args) => {
      const startTime = Date.now();
      let statusCode = 200;
      
      try {
        const result = await originalFunction(...args);
        return result;
      } catch (error) {
        statusCode = error.status || 500;
        throw error;
      } finally {
        const duration = Date.now() - startTime;
        const method = args[0] || 'GET'; // Assume first arg is HTTP method
        metricsService.recordBackendRequest(serviceName, method, statusCode, duration);
      }
    };
  };
}

// PUBLIC_INTERFACE
function circuitBreakerMetrics(serviceName, state) {
  /** Update circuit breaker metrics */
  metricsService.updateCircuitBreakerState(serviceName, state);
}

module.exports = {
  metricsMiddleware,
  serviceMetricsWrapper,
  circuitBreakerMetrics
};
