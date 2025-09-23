'use strict';
const fetch = (...args) => import('node-fetch').then(({ default: f }) => f(...args));

const BL_SERVICE_URL = process.env.BL_SERVICE_URL || 'http://localhost:4001';
const DATA_SERVICE_URL = process.env.DATA_SERVICE_URL || 'http://localhost:4002';
const NOTIFY_SERVICE_URL = process.env.NOTIFY_SERVICE_URL || 'http://localhost:4003';

const DEFAULT_TIMEOUT_MS = 10000;

async function forward(method, baseUrl, path, body, headers = {}, meta = {}) {
  const url = `${baseUrl}${path}`;
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
  try {
    const resp = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json', ...headers },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
    const text = await resp.text();
    let json;
    try { json = text ? JSON.parse(text) : null; } catch { json = { raw: text }; }
    if (!resp.ok) {
      const err = new Error(`Upstream error ${resp.status}`);
      err.status = resp.status;
      err.details = json;
      throw err;
    }
    return json;
  } finally {
    clearTimeout(t);
  }
}

// PUBLIC_INTERFACE
async function listInventory(token, context = {}) {
  /** Proxies to Business Logic or Data Service to list inventory. */
  return forward('GET', BL_SERVICE_URL, '/inventory', null, authHeader(token, context), context);
}

// PUBLIC_INTERFACE
async function createOrder(token, payload, context = {}) {
  /** Proxies order creation to Business Logic Service. */
  return forward('POST', BL_SERVICE_URL, '/sales', payload, authHeader(token, context), context);
}

// PUBLIC_INTERFACE
async function sendNotification(token, payload, context = {}) {
  /** Proxies to Notification Service. */
  return forward('POST', NOTIFY_SERVICE_URL, '/notifications/send', payload, authHeader(token, context), context);
}

function authHeader(token, context = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (context.requestId) headers['x-request-id'] = context.requestId;
  if (context.actor) headers['x-actor'] = context.actor;
  return headers;
}

module.exports = {
  listInventory,
  createOrder,
  sendNotification,
};
