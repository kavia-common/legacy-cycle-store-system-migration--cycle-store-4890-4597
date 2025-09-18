const app = require('./app');
const config = require('./config');

const server = app.listen(config.port, config.host, () => {
  // eslint-disable-next-line no-console
  console.log(`Server running at http://${config.host}:${config.port}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  // eslint-disable-next-line no-console
  console.log('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    // eslint-disable-next-line no-console
    console.log('HTTP server closed');
    process.exit(0);
  });
});

module.exports = server;
