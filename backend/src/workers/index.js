const { Worker } = require('bullmq');
const { config } = require('../config');
const { logger } = require('../config/logger');
const { migrate } = require('../db/migrate');
const { closePool } = require('../db/pool');
const { getRedisConnection, closeQueue } = require('../services/queueService');
const { processDocumentJob } = require('./documentWorker');

async function startWorker() {
  await migrate();

  const worker = new Worker(
    config.queueName,
    async (job) => processDocumentJob(job),
    {
      connection: getRedisConnection(),
      concurrency: 2,
    }
  );

  worker.on('failed', (job, error) => {
    logger.error('Worker job failed', {
      documentId: job?.data?.documentId,
      attempt: (job?.attemptsMade || 0),
      status: 'FAILED',
      failureReason: error.message,
    });
  });

  worker.on('completed', (job) => {
    logger.info('Worker job completed', {
      documentId: job?.data?.documentId,
      status: 'PROCESSED',
    });
  });

  const shutdown = async () => {
    logger.info('Worker shutting down');
    await worker.close();
    await closeQueue();
    await closePool();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  logger.info('Document worker started', { queueName: config.queueName });
}

startWorker().catch((error) => {
  logger.error('Worker failed to start', { failureReason: error.message });
  process.exit(1);
});
