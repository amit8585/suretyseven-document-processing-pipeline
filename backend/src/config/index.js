const path = require('path');
require('dotenv').config({
  path: path.resolve(__dirname, '../../../.env'),
});
require('dotenv').config({
  path: path.resolve(__dirname, '../../.env'),
});

function integer(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined || raw === '') {
    return fallback;
  }
  const value = Number.parseInt(raw, 10);
  return Number.isNaN(value) ? fallback : value;
}

const config = {
  env: process.env.NODE_ENV || 'development',
  port: integer('PORT', 3000),
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  databaseUrl:
    process.env.DATABASE_URL ||
    'postgres://surety:surety@localhost:5432/suretyseven',
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  uploadDir: path.resolve(
    process.env.UPLOAD_DIR || path.join(__dirname, '../../uploads')
  ),
  maxFileSizeBytes: integer('MAX_FILE_SIZE_MB', 10) * 1024 * 1024,
  processorScenario: (process.env.PROCESSOR_SCENARIO || 'SUCCESS').toUpperCase(),
  processorDelayMs: integer('PROCESSOR_DELAY_MS', 400),
  maxProcessingAttempts: integer('MAX_PROCESSING_ATTEMPTS', 3),
  retryBackoffMs: integer('RETRY_BACKOFF_MS', 1000),
  queueName: 'document-processing',
};

module.exports = { config };
