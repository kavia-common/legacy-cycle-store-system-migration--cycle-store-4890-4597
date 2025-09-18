const swaggerJSDoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.1',
    info: {
      title: 'API Gateway REST Interface',
      version: '1.0.0',
      description: 'RESTful API for authentication, business operations, notifications, and system health.',
    },
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
    tags: [
      { name: 'Auth', description: 'Authentication endpoints' },
      { name: 'Users', description: 'User administration endpoints' },
      { name: 'Orders', description: 'Order processing endpoints' },
      { name: 'Inventory', description: 'Inventory endpoints' },
      { name: 'Notifications', description: 'Notification endpoints' },
      { name: 'Health', description: 'Service health' },
    ],
  },
  apis: ['./src/routes/*.js'],
};

const swaggerSpec = swaggerJSDoc(options);
module.exports = swaggerSpec;
