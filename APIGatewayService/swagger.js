/**
 * Exports a base spec object; dynamic servers and full paths are provided by src/docs/openapi.
 * Kept for backward compatibility with generate_openapi.js.
 */
const { withServers } = require('./src/docs/openapi');

module.exports = {
  openapi: '3.0.3',
  info: {
    title: 'API Gateway REST Interface',
    version: '1.0.0',
    description: 'Unified gateway for authentication, routing, policy enforcement, and monitoring.',
  },
  servers: [{ url: 'http://localhost:3000' }],
  paths: {}, // actual paths are served dynamically via withServers in app
  withServers,
};
