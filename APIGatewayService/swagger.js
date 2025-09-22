const swaggerJSDoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.3',
    info: {
      title: 'API Gateway REST Interface',
      version: '1.1.0',
      description: 'RESTful API for authentication, RBAC, secure proxying, and system health.'
    },
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT bearer token obtained from /auth/login'
        }
      }
    },
    security: [{ bearerAuth: [] }],
    tags: [
      { name: 'Auth', description: 'Authentication endpoints' },
      { name: 'Gateway', description: 'Gateway proxy endpoints' },
      { name: 'User', description: 'User-related endpoints' },
      { name: 'Health', description: 'Service healthcheck' }
    ]
  },
  apis: ['./src/routes/*.js'],
};

const swaggerSpec = swaggerJSDoc(options);
module.exports = swaggerSpec;
