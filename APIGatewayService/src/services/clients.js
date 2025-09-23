'use strict';
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

const BL_SERVICE_URL = process.env.BL_SERVICE_URL || 'http://localhost:4001';
const DATA_SERVICE_URL = process.env.DATA_SERVICE_URL || 'http://localhost:4002';
const NOTIFY_SERVICE_URL = process.env.NOTIFY_SERVICE_URL || 'http://localhost:4003';

async function forward(method, baseUrl, path, body, headers = {}) {
  const url = `${baseUrl}${path}`;
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json', ...headers },
  };
  if (body) opts.body = JSON.stringify(body);
  const resp = await fetch(url, opts);
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
}

// PUBLIC_INTERFACE
async function listInventory(token) {
  /** Proxies to Business Logic or Data Service to list inventory. */
  return forward('GET', BL_SERVICE_URL, '/inventory', null, authHeader(token));
}

// PUBLIC_INTERFACE
async function createOrder(token, payload) {
  /** Proxies order creation to Business Logic Service. */
  return forward('POST', BL_SERVICE_URL, '/sales', payload, authHeader(token));
}

// PUBLIC_INTERFACE
async function sendNotification(token, payload) {
  /** Proxies to Notification Service. */
  return forward('POST', NOTIFY_SERVICE_URL, '/notifications/send', payload, authHeader(token));
}

function authHeader(token) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

module.exports = {
  listInventory,
  createOrder,
  sendNotification,
};
