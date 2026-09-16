const { Queue } = require('bullmq');
const IORedis = require('ioredis');
const { config } = require('../config');
const { logger } = require('../config/logger');

let connection;
let queue;

function getRedisConnection() {
  if (!connection) {
    connection = new IORedis(config.redisUrl, {
      maxRetriesPerRequest: null,
    });
  }
  return connection;
}

function getQueue() {
  if (!queue) {
    queue = new Queue(config.queueName, { connection: getRedisConnection() });
  }
  return queue;
}

async function enqueueDocumentProcessing(documentId) {
  try {
    await getQueue().add(
      'process-document',
      { documentId },
      {
        jobId: documentId,
        attempts: config.maxProcessingAttempts,
        backoff: {
          type: 'exponential',
          delay: config.retryBackoffMs,
        },
        removeOnComplete: 100,
        removeOnFail: 100,
      }
    );
  } catch (error) {
    if (String(error.message || '').toLowerCase().includes('already exists')) {
      logger.info('Processing job already exists', { documentId, status: 'UPLOADED' });
      return;
    }
    throw error;
  }
  logger.info('Enqueued document processing job', { documentId, status: 'UPLOADED' });
}

async function closeQueue() {
  if (queue) {
    await queue.close();
    queue = null;
  }
  if (connection) {
    await connection.quit();
    connection = null;
  }
}

module.exports = {
  getRedisConnection,
  getQueue,
  enqueueDocumentProcessing,
  closeQueue,
};
