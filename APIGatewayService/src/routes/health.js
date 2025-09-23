'use strict';

const express = require('express');
const router = express.Router();
const os = require('os');

// Startup time for calculating uptime
const startTime = Date.now();

/**
 * GET /health
 * Basic health check endpoint
 * @summary System health check
 * @tags Health
 * @returns {HealthResponse} 200 - Service is healthy
 */
router.get('/health', (req, res) => {
  const healthStatus = {
    status: 'healthy',
    message: 'API Gateway is operational',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    version: process.env.npm_package_version || '1.0.0',
    uptime: Math.floor((Date.now() - startTime) / 1000),
    requestId: req.requestId
  };

  // In production, you might want to check external dependencies
  const checkDependencies = process.env.HEALTH_CHECK_DEPENDENCIES !== 'false';
  if (checkDependencies) {
    // Add dependency checks here if needed
    healthStatus.dependencies = {
      database: 'not_checked',
      cache: 'not_checked',
      external_services: 'not_checked'
    };
  }

  res.status(200).json(healthStatus);
});

/**
 * GET /ready
 * Kubernetes readiness probe endpoint
 * @summary Readiness probe endpoint
 * @tags Health
 * @returns {ReadinessResponse} 200 - Service is ready
 * @returns {ReadinessResponse} 503 - Service is not ready
 */
router.get('/ready', (req, res) => {
  // Check if service is ready to accept traffic
  const isReady = true; // In production, check actual readiness conditions
  
  const readinessStatus = {
    status: isReady ? 'ready' : 'not_ready',
    message: isReady ? 'Service is ready to accept traffic' : 'Service is not ready',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    requestId: req.requestId
  };

  res.status(isReady ? 200 : 503).json(readinessStatus);
});

/**
 * GET /live
 * Kubernetes liveness probe endpoint
 * @summary Liveness probe endpoint
 * @tags Health
 * @returns {LivenessResponse} 200 - Service is alive
 */
router.get('/live', (req, res) => {
  res.status(200).json({
    status: 'alive',
    message: 'Service is alive',
    timestamp: new Date().toISOString(),
    requestId: req.requestId
  });
});

/**
 * GET /metrics
 * Prometheus-style metrics endpoint
 * @summary Prometheus metrics
 * @tags Health
 * @returns {string} 200 - Prometheus formatted metrics
 */
router.get('/metrics', (req, res) => {
  const uptime = Math.floor((Date.now() - startTime) / 1000);
  const memUsage = process.memoryUsage();
  
  const metrics = [
    '# HELP api_gateway_uptime_seconds Time the API Gateway has been running',
    '# TYPE api_gateway_uptime_seconds gauge',
    `api_gateway_uptime_seconds ${uptime}`,
    '',
    '# HELP api_gateway_memory_usage_bytes Memory usage in bytes',
    '# TYPE api_gateway_memory_usage_bytes gauge',
    `api_gateway_memory_usage_bytes{type="rss"} ${memUsage.rss}`,
    `api_gateway_memory_usage_bytes{type="heapTotal"} ${memUsage.heapTotal}`,
    `api_gateway_memory_usage_bytes{type="heapUsed"} ${memUsage.heapUsed}`,
    `api_gateway_memory_usage_bytes{type="external"} ${memUsage.external}`,
    '',
    '# HELP api_gateway_cpu_usage_percent CPU usage percentage',
    '# TYPE api_gateway_cpu_usage_percent gauge',
    `api_gateway_cpu_usage_percent ${os.loadavg()[0]}`,
    '',
    '# HELP api_gateway_version_info Version information',
    '# TYPE api_gateway_version_info gauge',
    `api_gateway_version_info{version="${process.env.npm_package_version || '1.0.0'}",environment="${process.env.NODE_ENV || 'development'}"} 1`,
    ''
  ].join('\n');

  res.set('Content-Type', 'text/plain; charset=utf-8');
  res.status(200).send(metrics);
});

module.exports = router;
