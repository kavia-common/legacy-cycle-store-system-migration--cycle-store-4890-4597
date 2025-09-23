'use strict';

const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

// PUBLIC_INTERFACE
function securityHeaders() {
  /** Configures comprehensive security headers using helmet */
  return helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com"],
        scriptSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
      },
    },
    crossOriginEmbedderPolicy: false,
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true
    },
    noSniff: true,
    xssFilter: true,
    referrerPolicy: { policy: "same-origin" }
  });
}

// PUBLIC_INTERFACE
function advancedRateLimit(options = {}) {
  /** Creates an advanced rate limiter with customizable options */
  const defaultOptions = {
    windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS || 60000),
    max: Number(process.env.RATE_LIMIT_MAX || 100),
    message: { 
      status: 'error', 
      message: 'Too many requests, please try again later.',
      retryAfter: Math.ceil(Number(process.env.RATE_LIMIT_WINDOW_MS || 60000) / 1000)
    },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: false,
    skipFailedRequests: false,
    keyGenerator: (req) => {
      return req.ip || 'unknown';
    },
    skip: (req) => {
      // Skip rate limiting in test environment
      if (process.env.NODE_ENV === 'test') {
        return true;
      }
      // Skip health checks
      if (req.path === '/health' || req.path === '/ready' || req.path === '/live') {
        return true;
      }
      return false;
    },
    handler: (req, res) => {
      console.warn(`Rate limit exceeded for IP: ${req.ip}, Path: ${req.path}`);
      res.status(429).json({
        status: 'error',
        message: 'Too many requests, please try again later.',
        retryAfter: Math.ceil(Number(process.env.RATE_LIMIT_WINDOW_MS || 60000) / 1000)
      });
    }
  };

  return rateLimit({ ...defaultOptions, ...options });
}

// PUBLIC_INTERFACE
function circuitBreaker(options = {}) {
  /** Simple circuit breaker middleware for downstream service protection */
  const enabled = process.env.CIRCUIT_BREAKER_ENABLED !== 'false';
  
  if (!enabled) {
    return (req, res, next) => next();
  }

  const defaultOptions = {
    failureThreshold: 5,
    resetTimeout: 30000,
    monitorTimeout: 10000
  };

  const config = { ...defaultOptions, ...options };
  let failureCount = 0;
  let lastFailureTime = null;
  let state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN

  return (req, res, next) => {
    const now = Date.now();

    // Reset circuit breaker after timeout
    if (state === 'OPEN' && (now - lastFailureTime) > config.resetTimeout) {
      state = 'HALF_OPEN';
      failureCount = 0;
    }

    // Circuit is open, reject requests
    if (state === 'OPEN') {
      return res.status(503).json({
        status: 'error',
        message: 'Service temporarily unavailable - circuit breaker open',
        requestId: req.requestId
      });
    }

    // Monitor for failures
    const originalSend = res.send;
    res.send = function(data) {
      if (res.statusCode >= 500) {
        failureCount++;
        lastFailureTime = now;
        
        if (failureCount >= config.failureThreshold) {
          state = 'OPEN';
        }
      } else if (state === 'HALF_OPEN') {
        // Success in half-open state, close circuit
        state = 'CLOSED';
        failureCount = 0;
      }
      
      return originalSend.call(this, data);
    };

    next();
  };
}

// PUBLIC_INTERFACE
function rateLimitTiers() {
  /** Returns pre-configured rate limit tiers for different API usage patterns */
  const windowMs = Number(process.env.RATE_LIMIT_WINDOW_MS || 60000);
  
  return {
    // Strict rate limiting for authentication endpoints
    auth: advancedRateLimit({
      windowMs: windowMs,
      max: Number(process.env.AUTH_RATE_LIMIT_MAX || 10),
      message: {
        status: 'error',
        message: 'Too many authentication attempts, please try again later.',
        retryAfter: Math.ceil(windowMs / 1000)
      }
    }),
    
    // Standard rate limiting for API endpoints
    api: advancedRateLimit({
      windowMs: windowMs,
      max: Number(process.env.API_RATE_LIMIT_MAX || 100),
      message: {
        status: 'error',
        message: 'API rate limit exceeded, please try again later.',
        retryAfter: Math.ceil(windowMs / 1000)
      }
    }),
    
    // Relaxed rate limiting for read-only endpoints
    readonly: advancedRateLimit({
      windowMs: windowMs,
      max: Number(process.env.READONLY_RATE_LIMIT_MAX || 200),
      message: {
        status: 'error',
        message: 'Rate limit exceeded for read operations.',
        retryAfter: Math.ceil(windowMs / 1000)
      }
    })
  };
}

module.exports = {
  securityHeaders,
  advancedRateLimit,
  circuitBreaker,
  rateLimitTiers
};
