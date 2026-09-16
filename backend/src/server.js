const { createApp } = require('./app');
const { config } = require('./config');
const { logger } = require('./config/logger');
const { migrate } = require('./db/migrate');
const { closePool } = require('./db/pool');
const { closeQueue } = require('./services/queueService');

async function start() {
  await migrate();
  const app = createApp();
  const server = app.listen(config.port, () => {
    logger.info('API server started', { port: config.port, status: 'ok' });
  });

  const shutdown = async () => {
    logger.info('API server shutting down');
    server.close(async () => {
      await closeQueue();
      await closePool();
      process.exit(0);
    });
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

start().catch((error) => {
  logger.error('API failed to start', { failureReason: error.message });
  process.exit(1);
});
