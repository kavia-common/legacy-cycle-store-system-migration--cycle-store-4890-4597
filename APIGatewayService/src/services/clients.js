'use strict';
const fetch = (...args) => import('node-fetch').then(({ default: f }) => f(...args));
const { logger } = require('./logging');

// Service URLs from environment
const BL_SERVICE_URL = process.env.BL_SERVICE_URL || 'http://localhost:4001';
const DATA_SERVICE_URL = process.env.DATA_SERVICE_URL || 'http://localhost:4002';
const NOTIFY_SERVICE_URL = process.env.NOTIFY_SERVICE_URL || 'http://localhost:4003';

const DEFAULT_TIMEOUT_MS = Number(process.env.SERVICE_TIMEOUT_MS || 10000);
const MAX_RETRIES = Number(process.env.SERVICE_MAX_RETRIES || 3);
const RETRY_DELAY_MS = Number(process.env.SERVICE_RETRY_DELAY_MS || 1000);

// Circuit breaker state for each service
const circuitBreakers = {
  [BL_SERVICE_URL]: { failures: 0, lastFailure: 0, state: 'CLOSED' },
  [DATA_SERVICE_URL]: { failures: 0, lastFailure: 0, state: 'CLOSED' },
  [NOTIFY_SERVICE_URL]: { failures: 0, lastFailure: 0, state: 'CLOSED' }
};

const CIRCUIT_BREAKER_THRESHOLD = 5;
const CIRCUIT_BREAKER_TIMEOUT = 60000;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function isCircuitOpen(serviceUrl) {
  const cb = circuitBreakers[serviceUrl];
  if (!cb) return false;
  
  if (cb.state === 'OPEN') {
    const timeSinceLastFailure = Date.now() - cb.lastFailure;
    if (timeSinceLastFailure > CIRCUIT_BREAKER_TIMEOUT) {
      cb.state = 'HALF_OPEN';
      return false;
    }
    return true;
  }
  return false;
}

function recordFailure(serviceUrl) {
  const cb = circuitBreakers[serviceUrl];
  if (!cb) return;
  
  cb.failures++;
  cb.lastFailure = Date.now();
  
  if (cb.failures >= CIRCUIT_BREAKER_THRESHOLD) {
    cb.state = 'OPEN';
    logger('warn', 'circuit_breaker_open', { serviceUrl, failures: cb.failures });
  }
}

function recordSuccess(serviceUrl) {
  const cb = circuitBreakers[serviceUrl];
  if (!cb) return;
  
  cb.failures = 0;
  cb.state = 'CLOSED';
}

async function forward(method, baseUrl, path, body, headers = {}, context = {}, retries = MAX_RETRIES) {
  const url = `${baseUrl}${path}`;
  
  // Check circuit breaker
  if (isCircuitOpen(baseUrl)) {
    const err = new Error('Service temporarily unavailable - Circuit breaker open');
    err.status = 503;
    err.details = { serviceUrl: baseUrl, reason: 'circuit_breaker_open' };
    throw err;
  }
  
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
  
  try {
    logger('info', 'service_request', { 
      method, 
      url, 
      requestId: context.requestId,
      actor: context.actor
    });
    
    const resp = await fetch(url, {
      method,
      headers: { 
        'Content-Type': 'application/json',
        'User-Agent': 'APIGateway/1.0.0',
        ...headers 
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
    
    const text = await resp.text();
    let json;
    
    try { 
      json = text ? JSON.parse(text) : null; 
    } catch { 
      json = { raw: text }; 
    }
    
    if (!resp.ok) {
      const err = new Error(`Upstream service error: ${resp.status} ${resp.statusText}`);
      err.status = resp.status;
      err.details = {
        service: baseUrl,
        path,
        statusCode: resp.status,
        statusText: resp.statusText,
        response: json
      };
      
      // Record failure for circuit breaker (only for 5xx errors)
      if (resp.status >= 500) {
        recordFailure(baseUrl);
      }
      
      throw err;
    }
    
    // Record success for circuit breaker
    recordSuccess(baseUrl);
    
    logger('info', 'service_response', { 
      method, 
      url, 
      status: resp.status,
      requestId: context.requestId
    });
    
    return json;
    
  } catch (error) {
    if (error.name === 'AbortError') {
      error.message = 'Service request timeout';
      error.status = 504;
    }
    
    logger('error', 'service_request_failed', { 
      method, 
      url, 
      error: error.message,
      status: error.status,
      requestId: context.requestId,
      retries: MAX_RETRIES - retries
    });
    
    // Retry logic for specific errors
    if (retries > 0 && (error.status >= 500 || error.name === 'AbortError' || error.code === 'ECONNREFUSED')) {
      await sleep(RETRY_DELAY_MS * (MAX_RETRIES - retries + 1)); // Exponential backoff
      return forward(method, baseUrl, path, body, headers, context, retries - 1);
    }
    
    // Record failure for circuit breaker
    if (error.status >= 500 || error.name === 'AbortError') {
      recordFailure(baseUrl);
    }
    
    throw error;
    
  } finally {
    clearTimeout(timeout);
  }
}

function authHeader(token, context = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (context.requestId) headers['x-request-id'] = context.requestId;
  if (context.actor) headers['x-actor'] = context.actor;
  return headers;
}

// =============================================================================
// INVENTORY OPERATIONS
// =============================================================================

// PUBLIC_INTERFACE
async function listInventory(token, context = {}) {
  /** Proxies to Business Logic Service to list inventory. */
  const query = context.query ? `?${new URLSearchParams(context.query).toString()}` : '';
  return forward('GET', BL_SERVICE_URL, `/inventory${query}`, null, authHeader(token, context), context);
}

// =============================================================================
// ORDER OPERATIONS
// =============================================================================

// PUBLIC_INTERFACE
async function createOrder(token, payload, context = {}) {
  /** Proxies order creation to Business Logic Service. */
  return forward('POST', BL_SERVICE_URL, '/sales', payload, authHeader(token, context), context);
}

// =============================================================================
// NOTIFICATION OPERATIONS
// =============================================================================

// PUBLIC_INTERFACE
async function sendNotification(token, payload, context = {}) {
  /** Proxies to Notification Service. */
  return forward('POST', NOTIFY_SERVICE_URL, '/notifications/send', payload, authHeader(token, context), context);
}

// =============================================================================
// USER MANAGEMENT OPERATIONS
// =============================================================================

// PUBLIC_INTERFACE
async function getUsers(token, context = {}) {
  /** Proxies to Data Service to get users list. */
  const query = context.query ? `?${new URLSearchParams(context.query).toString()}` : '';
  return forward('GET', DATA_SERVICE_URL, `/api/v1/entities/users${query}`, null, authHeader(token, context), context);
}

// PUBLIC_INTERFACE
async function createUser(token, payload, context = {}) {
  /** Proxies user creation to Data Service. */
  return forward('POST', DATA_SERVICE_URL, '/api/v1/entities/users', payload, authHeader(token, context), context);
}

// PUBLIC_INTERFACE
async function getUserById(token, userId, context = {}) {
  /** Proxies to Data Service to get user by ID. */
  return forward('GET', DATA_SERVICE_URL, `/api/v1/entities/users/${userId}`, null, authHeader(token, context), context);
}

// PUBLIC_INTERFACE
async function updateUser(token, userId, payload, context = {}) {
  /** Proxies user update to Data Service. */
  return forward('PUT', DATA_SERVICE_URL, `/api/v1/entities/users/${userId}`, payload, authHeader(token, context), context);
}

// PUBLIC_INTERFACE
async function deleteUser(token, userId, context = {}) {
  /** Proxies user deletion to Data Service. */
  return forward('DELETE', DATA_SERVICE_URL, `/api/v1/entities/users/${userId}`, null, authHeader(token, context), context);
}

// =============================================================================
// CUSTOMER OPERATIONS
// =============================================================================

// PUBLIC_INTERFACE
async function getCustomers(token, context = {}) {
  /** Proxies to Data Service to get customers list. */
  const query = context.query ? `?${new URLSearchParams(context.query).toString()}` : '';
  return forward('GET', DATA_SERVICE_URL, `/api/v1/entities/customers${query}`, null, authHeader(token, context), context);
}

// PUBLIC_INTERFACE
async function createCustomer(token, payload, context = {}) {
  /** Proxies customer creation to Data Service. */
  return forward('POST', DATA_SERVICE_URL, '/api/v1/entities/customers', payload, authHeader(token, context), context);
}

// =============================================================================
// SUPPORT TICKET OPERATIONS
// =============================================================================

// PUBLIC_INTERFACE
async function getSupportTickets(token, context = {}) {
  /** Proxies to Data Service to get support tickets list. */
  const query = context.query ? `?${new URLSearchParams(context.query).toString()}` : '';
  return forward('GET', DATA_SERVICE_URL, `/api/v1/entities/support-tickets${query}`, null, authHeader(token, context), context);
}

// PUBLIC_INTERFACE
async function createSupportTicket(token, payload, context = {}) {
  /** Proxies support ticket creation to Data Service. */
  return forward('POST', DATA_SERVICE_URL, '/api/v1/entities/support-tickets', payload, authHeader(token, context), context);
}

// =============================================================================
// HEALTH CHECK OPERATIONS
// =============================================================================

// PUBLIC_INTERFACE
async function checkServiceHealth(serviceUrl) {
  /** Checks health of a backend service. */
  try {
    const response = await forward('GET', serviceUrl, '/health', null, {}, { requestId: 'health-check' });
    return { status: 'healthy', service: serviceUrl, details: response };
  } catch (error) {
    return { 
      status: 'unhealthy', 
      service: serviceUrl, 
      error: error.message,
      statusCode: error.status
    };
  }
}

// PUBLIC_INTERFACE
async function checkAllServices() {
  /** Checks health of all backend services. */
  const services = [BL_SERVICE_URL, DATA_SERVICE_URL, NOTIFY_SERVICE_URL];
  const results = await Promise.allSettled(
    services.map(url => checkServiceHealth(url))
  );
  
  return results.map((result, index) => ({
    service: services[index],
    ...result.value || { status: 'error', error: result.reason?.message }
  }));
}

module.exports = {
  listInventory,
  createOrder,
  sendNotification,
  getUsers,
  createUser,
  getUserById,
  updateUser,
  deleteUser,
  getCustomers,
  createCustomer,
  getSupportTickets,
  createSupportTicket,
  checkServiceHealth,
  checkAllServices
};
