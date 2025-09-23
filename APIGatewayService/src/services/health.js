'use strict';

const { checkAllServices } = require('./clients');
const { logger } = require('./logging');

class HealthService {
  constructor() {
    this.startTime = Date.now();
    this.healthChecks = new Map();
    this.lastDependencyCheck = null;
    this.dependencyCheckInterval = Number(process.env.HEALTH_CHECK_INTERVAL || 30000);
    
    // Start periodic dependency checks if enabled
    if (process.env.HEALTH_CHECK_DEPENDENCIES === 'true') {
      this.startPeriodicChecks();
    }
  }

  // PUBLIC_INTERFACE
  getStatus() {
    /** Returns basic service health status */
    const uptime = Math.floor((Date.now() - this.startTime) / 1000);
    const memUsage = process.memoryUsage();
    
    return {
      status: 'ok',
      message: 'API Gateway Service is healthy',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      version: process.env.npm_package_version || '1.0.0',
      uptime: {
        seconds: uptime,
        human: this.formatUptime(uptime)
      },
      memory: {
        rss: Math.round(memUsage.rss / 1024 / 1024) + 'MB',
        heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024) + 'MB',
        heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024) + 'MB',
        external: Math.round(memUsage.external / 1024 / 1024) + 'MB'
      },
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch
    };
  }

  // PUBLIC_INTERFACE
  async getDetailedStatus() {
    /** Returns comprehensive health status including dependencies */
    const basicStatus = this.getStatus();
    
    try {
      const dependencies = await this.checkDependencies();
      const overallHealth = this.calculateOverallHealth(dependencies);
      
      return {
        ...basicStatus,
        status: overallHealth.status,
        message: overallHealth.message,
        dependencies,
        lastDependencyCheck: this.lastDependencyCheck,
        checks: Object.fromEntries(this.healthChecks)
      };
    } catch (error) {
      logger('error', 'health_check_failed', { error: error.message });
      
      return {
        ...basicStatus,
        status: 'degraded',
        message: 'Health check partially failed',
        error: error.message,
        dependencies: [],
        lastDependencyCheck: this.lastDependencyCheck
      };
    }
  }

  // PUBLIC_INTERFACE
  async checkDependencies() {
    /** Checks health of all backend dependencies */
    try {
      const serviceChecks = await checkAllServices();
      this.lastDependencyCheck = new Date().toISOString();
      
      return serviceChecks.map(check => ({
        name: this.getServiceName(check.service),
        url: check.service,
        status: check.status,
        responseTime: check.responseTime,
        lastCheck: this.lastDependencyCheck,
        error: check.error,
        details: check.details
      }));
    } catch (error) {
      logger('error', 'dependency_check_failed', { error: error.message });
      throw error;
    }
  }

  // PUBLIC_INTERFACE
  addHealthCheck(name, checkFunction) {
    /** Adds a custom health check */
    this.healthChecks.set(name, checkFunction);
  }

  // PUBLIC_INTERFACE
  removeHealthCheck(name) {
    /** Removes a custom health check */
    return this.healthChecks.delete(name);
  }

  // PUBLIC_INTERFACE
  async runCustomChecks() {
    /** Runs all custom health checks */
    const results = {};
    
    for (const [name, checkFunction] of this.healthChecks) {
      try {
        const startTime = Date.now();
        const result = await Promise.race([
          checkFunction(),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Health check timeout')), 5000)
          )
        ]);
        
        results[name] = {
          status: 'healthy',
          responseTime: Date.now() - startTime,
          result,
          lastCheck: new Date().toISOString()
        };
      } catch (error) {
        results[name] = {
          status: 'unhealthy',
          error: error.message,
          lastCheck: new Date().toISOString()
        };
      }
    }
    
    return results;
  }

  startPeriodicChecks() {
    /** Starts periodic dependency health checks */
    setInterval(async () => {
      try {
        await this.checkDependencies();
        logger('debug', 'periodic_health_check_completed');
      } catch (error) {
        logger('warn', 'periodic_health_check_failed', { error: error.message });
      }
    }, this.dependencyCheckInterval);
    
    logger('info', 'periodic_health_checks_started', { 
      interval: this.dependencyCheckInterval 
    });
  }

  calculateOverallHealth(dependencies) {
    /** Calculates overall health status based on dependencies */
    if (!dependencies || dependencies.length === 0) {
      return {
        status: 'ok',
        message: 'Service is healthy (no dependencies configured)'
      };
    }
    
    const healthyCount = dependencies.filter(dep => dep.status === 'healthy').length;
    const totalCount = dependencies.length;
    const healthyPercentage = (healthyCount / totalCount) * 100;
    
    if (healthyPercentage === 100) {
      return {
        status: 'ok',
        message: 'Service and all dependencies are healthy'
      };
    } else if (healthyPercentage >= 50) {
      return {
        status: 'degraded',
        message: `Service is degraded (${healthyCount}/${totalCount} dependencies healthy)`
      };
    } else {
      return {
        status: 'unhealthy',
        message: `Service is unhealthy (${healthyCount}/${totalCount} dependencies healthy)`
      };
    }
  }

  getServiceName(url) {
    /** Extracts service name from URL */
    try {
      const urlObj = new URL(url);
      const port = urlObj.port;
      
      // Map common ports to service names
      const serviceMap = {
        '4001': 'BusinessLogicService',
        '4002': 'DataService', 
        '4003': 'NotificationService',
        '4601': 'MonitoringService'
      };
      
      return serviceMap[port] || `Service-${port}` || urlObj.hostname;
    } catch {
      return url;
    }
  }

  formatUptime(seconds) {
    /** Formats uptime in human-readable format */
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;
    
    const parts = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    if (remainingSeconds > 0 || parts.length === 0) parts.push(`${remainingSeconds}s`);
    
    return parts.join(' ');
  }

  // PUBLIC_INTERFACE
  getMetrics() {
    /** Returns basic metrics for monitoring */
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    
    return {
      timestamp: new Date().toISOString(),
      uptime: Math.floor((Date.now() - this.startTime) / 1000),
      memory: {
        rss: memUsage.rss,
        heapTotal: memUsage.heapTotal,
        heapUsed: memUsage.heapUsed,
        external: memUsage.external,
        arrayBuffers: memUsage.arrayBuffers
      },
      cpu: {
        user: cpuUsage.user,
        system: cpuUsage.system
      },
      eventLoop: {
        lag: this.getEventLoopLag()
      }
    };
  }

  getEventLoopLag() {
    /** Measures event loop lag */
    const start = process.hrtime.bigint();
    return new Promise(resolve => {
      setImmediate(() => {
        const lag = Number(process.hrtime.bigint() - start) / 1000000; // Convert to milliseconds
        resolve(lag);
      });
    });
  }
}

module.exports = new HealthService();
