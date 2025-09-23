'use strict';

const { logger } = require('./logging');

class MetricsService {
  constructor() {
    this.metrics = new Map();
    this.startTime = Date.now();
    this.requestCount = 0;
    this.errorCount = 0;
    this.responseTimeSum = 0;
    this.responseTimeCount = 0;
    
    // Initialize basic counters
    this.initializeMetrics();
  }

  initializeMetrics() {
    /** Initialize default metrics */
    this.metrics.set('api_gateway_requests_total', {
      type: 'counter',
      help: 'Total number of HTTP requests',
      value: 0,
      labels: {}
    });

    this.metrics.set('api_gateway_request_duration_seconds', {
      type: 'histogram',
      help: 'HTTP request duration in seconds',
      buckets: [0.1, 0.5, 1, 2, 5, 10],
      values: new Map()
    });

    this.metrics.set('api_gateway_errors_total', {
      type: 'counter',
      help: 'Total number of HTTP errors',
      value: 0,
      labels: {}
    });

    this.metrics.set('api_gateway_backend_requests_total', {
      type: 'counter',
      help: 'Total backend service requests',
      value: 0,
      labels: {}
    });

    this.metrics.set('api_gateway_circuit_breaker_state', {
      type: 'gauge',
      help: 'Circuit breaker state (0=closed, 1=open, 2=half-open)',
      value: 0,
      labels: {}
    });
  }

  // PUBLIC_INTERFACE
  incrementCounter(name, labels = {}, value = 1) {
    /** Increment a counter metric */
    const key = this.buildKey(name, labels);
    const current = this.metrics.get(key) || { value: 0 };
    current.value += value;
    this.metrics.set(key, current);
  }

  // PUBLIC_INTERFACE
  setGauge(name, value, labels = {}) {
    /** Set a gauge metric value */
    const key = this.buildKey(name, labels);
    this.metrics.set(key, { value, labels, type: 'gauge' });
  }

  // PUBLIC_INTERFACE
  observeHistogram(name, value, labels = {}) {
    /** Add an observation to a histogram */
    const key = this.buildKey(name, labels);
    const metric = this.metrics.get(key) || { 
      values: new Map(), 
      buckets: [0.1, 0.5, 1, 2, 5, 10],
      type: 'histogram'
    };
    
    if (!metric.values) metric.values = new Map();
    
    // Find appropriate bucket
    let bucket = '+Inf';
    for (const b of metric.buckets) {
      if (value <= b) {
        bucket = b.toString();
        break;
      }
    }
    
    const currentCount = metric.values.get(bucket) || 0;
    metric.values.set(bucket, currentCount + 1);
    this.metrics.set(key, metric);
  }

  // PUBLIC_INTERFACE
  recordRequest(method, path, statusCode, duration) {
    /** Record an HTTP request with metrics */
    this.requestCount++;
    
    // Increment request counter
    this.incrementCounter('api_gateway_requests_total', {
      method,
      path: this.sanitizePath(path),
      status: statusCode.toString()
    });

    // Record response time
    this.observeHistogram('api_gateway_request_duration_seconds', duration / 1000, {
      method,
      path: this.sanitizePath(path)
    });

    // Track response time for average calculation
    this.responseTimeSum += duration;
    this.responseTimeCount++;

    // Increment error counter for 4xx/5xx responses
    if (statusCode >= 400) {
      this.errorCount++;
      this.incrementCounter('api_gateway_errors_total', {
        method,
        path: this.sanitizePath(path),
        status: statusCode.toString()
      });
    }

    // Log metrics periodically
    if (this.requestCount % 100 === 0) {
      this.logMetricsSummary();
    }
  }

  // PUBLIC_INTERFACE
  recordBackendRequest(service, method, statusCode, duration) {
    /** Record a backend service request */
    this.incrementCounter('api_gateway_backend_requests_total', {
      service: this.getServiceName(service),
      method,
      status: statusCode.toString()
    });

    this.observeHistogram('api_gateway_backend_duration_seconds', duration / 1000, {
      service: this.getServiceName(service),
      method
    });
  }

  // PUBLIC_INTERFACE
  updateCircuitBreakerState(service, state) {
    /** Update circuit breaker state metric */
    const stateValue = { 'CLOSED': 0, 'OPEN': 1, 'HALF_OPEN': 2 }[state] || 0;
    this.setGauge('api_gateway_circuit_breaker_state', stateValue, {
      service: this.getServiceName(service)
    });
  }

  // PUBLIC_INTERFACE
  getPrometheusMetrics() {
    /** Generate Prometheus-formatted metrics */
    const lines = [];
    const uptime = Math.floor((Date.now() - this.startTime) / 1000);
    const avgResponseTime = this.responseTimeCount > 0 ? 
      this.responseTimeSum / this.responseTimeCount : 0;

    // Add standard metrics
    lines.push('# HELP api_gateway_uptime_seconds Time the API Gateway has been running');
    lines.push('# TYPE api_gateway_uptime_seconds gauge');
    lines.push(`api_gateway_uptime_seconds ${uptime}`);
    lines.push('');

    lines.push('# HELP api_gateway_avg_response_time_ms Average response time in milliseconds');
    lines.push('# TYPE api_gateway_avg_response_time_ms gauge');
    lines.push(`api_gateway_avg_response_time_ms ${avgResponseTime.toFixed(2)}`);
    lines.push('');

    // Memory metrics
    const memUsage = process.memoryUsage();
    lines.push('# HELP api_gateway_memory_usage_bytes Memory usage in bytes');
    lines.push('# TYPE api_gateway_memory_usage_bytes gauge');
    lines.push(`api_gateway_memory_usage_bytes{type="rss"} ${memUsage.rss}`);
    lines.push(`api_gateway_memory_usage_bytes{type="heapTotal"} ${memUsage.heapTotal}`);
    lines.push(`api_gateway_memory_usage_bytes{type="heapUsed"} ${memUsage.heapUsed}`);
    lines.push(`api_gateway_memory_usage_bytes{type="external"} ${memUsage.external}`);
    lines.push('');

    // Process custom metrics
    for (const [key, metric] of this.metrics) {
      if (metric.type === 'counter' || metric.type === 'gauge') {
        const metricName = key.split('|')[0];
        const labels = this.parseLabels(key);
        const labelStr = this.formatLabels(labels);
        
        if (!lines.find(line => line.includes(`# HELP ${metricName}`))) {
          lines.push(`# HELP ${metricName} ${metric.help || 'Custom metric'}`);
          lines.push(`# TYPE ${metricName} ${metric.type}`);
        }
        
        lines.push(`${metricName}${labelStr} ${metric.value || 0}`);
      } else if (metric.type === 'histogram' && metric.values) {
        const metricName = key.split('|')[0];
        const labels = this.parseLabels(key);
        
        if (!lines.find(line => line.includes(`# HELP ${metricName}`))) {
          lines.push(`# HELP ${metricName} ${metric.help || 'Histogram metric'}`);
          lines.push(`# TYPE ${metricName} histogram`);
        }
        
        for (const [bucket, count] of metric.values) {
          const bucketLabels = { ...labels, le: bucket };
          const labelStr = this.formatLabels(bucketLabels);
          lines.push(`${metricName}_bucket${labelStr} ${count}`);
        }
      }
    }

    lines.push('');
    return lines.join('\n');
  }

  // PUBLIC_INTERFACE
  getMetricsSummary() {
    /** Get a summary of key metrics */
    const uptime = Math.floor((Date.now() - this.startTime) / 1000);
    const avgResponseTime = this.responseTimeCount > 0 ? 
      this.responseTimeSum / this.responseTimeCount : 0;
    const errorRate = this.requestCount > 0 ? 
      (this.errorCount / this.requestCount) * 100 : 0;

    return {
      uptime,
      totalRequests: this.requestCount,
      totalErrors: this.errorCount,
      errorRate: parseFloat(errorRate.toFixed(2)),
      averageResponseTime: parseFloat(avgResponseTime.toFixed(2)),
      requestsPerSecond: uptime > 0 ? parseFloat((this.requestCount / uptime).toFixed(2)) : 0,
      memoryUsage: process.memoryUsage(),
      timestamp: new Date().toISOString()
    };
  }

  // PUBLIC_INTERFACE
  reset() {
    /** Reset all metrics */
    this.metrics.clear();
    this.requestCount = 0;
    this.errorCount = 0;
    this.responseTimeSum = 0;
    this.responseTimeCount = 0;
    this.startTime = Date.now();
    this.initializeMetrics();
  }

  buildKey(name, labels) {
    /** Build a unique key for the metric */
    const sortedLabels = Object.keys(labels).sort().map(key => `${key}=${labels[key]}`);
    return sortedLabels.length > 0 ? `${name}|${sortedLabels.join(',')}` : name;
  }

  parseLabels(key) {
    /** Parse labels from metric key */
    const parts = key.split('|');
    if (parts.length < 2) return {};
    
    const labels = {};
    parts[1].split(',').forEach(label => {
      const [key, value] = label.split('=');
      if (key && value) labels[key] = value;
    });
    return labels;
  }

  formatLabels(labels) {
    /** Format labels for Prometheus output */
    const labelPairs = Object.keys(labels).map(key => `${key}="${labels[key]}"`);
    return labelPairs.length > 0 ? `{${labelPairs.join(',')}}` : '';
  }

  sanitizePath(path) {
    /** Sanitize path for metrics (remove IDs and sensitive data) */
    return path
      .replace(/\/\d+/g, '/:id')
      .replace(/\/[a-f0-9-]{36}/g, '/:uuid')
      .replace(/\?.*$/, '');
  }

  getServiceName(url) {
    /** Extract service name from URL */
    try {
      const urlObj = new URL(url);
      const port = urlObj.port;
      const serviceMap = {
        '4001': 'business-logic',
        '4002': 'data-service',
        '4003': 'notification-service',
        '4601': 'monitoring-service'
      };
      return serviceMap[port] || urlObj.hostname || 'unknown';
    } catch {
      return 'unknown';
    }
  }

  logMetricsSummary() {
    /** Log a summary of metrics */
    const summary = this.getMetricsSummary();
    logger('info', 'metrics_summary', summary);
  }
}

module.exports = new MetricsService();
