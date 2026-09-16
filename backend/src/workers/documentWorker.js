const { UnrecoverableError } = require('bullmq');
const { config } = require('../config');
const { logger } = require('../config/logger');
const { ProcessorError } = require('../utils/errors');
const documentRepository = require('../repositories/documentRepository');
const historyRepository = require('../repositories/historyRepository');
const { MockDocumentProcessor } = require('../services/processorService');
const { validateExtractedData } = require('../services/validationService');

function createDefaultProcessor() {
  return new MockDocumentProcessor({
    scenario: config.processorScenario,
    delayMs: config.processorDelayMs,
  });
}

async function markFailed(document, { code, message, attempt, errors, terminal = true }) {
  const errorPayload = {
    code,
    message,
    attempt,
    ...(errors ? { errors } : {}),
  };

  await documentRepository.updateDocument(document.id, {
    status: terminal ? 'FAILED' : 'PROCESSING',
    error: errorPayload,
  });

  await historyRepository.addHistory({
    documentUuid: document.id,
    status: 'FAILED',
    attempt,
    reason: code,
    details: errorPayload,
  });

  logger.warn('Document processing failed', {
    documentId: document.documentId,
    attempt,
    status: terminal ? 'FAILED' : 'PROCESSING',
    failureReason: code,
  });

  return errorPayload;
}

async function processDocumentJob(job, processor = createDefaultProcessor()) {
  const documentId = job.data.documentId;
  const attempt = (job.attemptsMade || 0) + 1;
  const maxAttempts = job.opts?.attempts || config.maxProcessingAttempts;

  const document = await documentRepository.findByDocumentId(documentId);
  if (!document) {
    throw new UnrecoverableError(`Document ${documentId} was not found`);
  }

  if (document.status === 'PROCESSED') {
    logger.info('Skipping already processed document', {
      documentId,
      attempt,
      status: 'PROCESSED',
    });
    return { status: 'PROCESSED' };
  }

  await documentRepository.updateDocument(document.id, {
    status: 'PROCESSING',
    attempt_count: attempt,
    error: null,
  });
  await historyRepository.addHistory({
    documentUuid: document.id,
    status: 'PROCESSING',
    attempt,
  });

  logger.info('Document processing started', {
    documentId,
    attempt,
    status: 'PROCESSING',
  });

  try {
    const extracted = await processor.process(document, { attempt });
    const validation = validateExtractedData(extracted);

    if (!validation.valid) {
      await markFailed(document, {
        code: 'VALIDATION_FAILED',
        message: 'Extracted data failed validation',
        attempt,
        errors: validation.errors,
      });
      throw new UnrecoverableError('VALIDATION_FAILED');
    }

    await documentRepository.updateDocument(document.id, {
      status: 'PROCESSED',
      result: validation.data,
      error: null,
      attempt_count: attempt,
    });
    await historyRepository.addHistory({
      documentUuid: document.id,
      status: 'PROCESSED',
      attempt,
    });

    logger.info('Document processed successfully', {
      documentId,
      attempt,
      status: 'PROCESSED',
    });
    return { status: 'PROCESSED' };
  } catch (error) {
    if (error instanceof UnrecoverableError) {
      throw error;
    }

    const code = error instanceof ProcessorError ? error.code : 'PROCESSOR_ERROR';
    const retryable = error instanceof ProcessorError ? error.retryable : false;

    if (code === 'INVALID_RESULT' || !retryable) {
      await markFailed(document, {
        code,
        message: error.message || 'Processor returned an invalid result',
        attempt,
      });
      throw new UnrecoverableError(code);
    }

    const failureCode = code === 'TIMEOUT' ? 'TIMEOUT' : 'PROCESSOR_ERROR';
    const terminal = attempt >= maxAttempts;
    await markFailed(document, {
      code: failureCode,
      message: error.message || 'Processor failed',
      attempt,
      terminal,
    });

    if (attempt >= maxAttempts) {
      logger.error('Document processing exhausted retries', {
        documentId,
        attempt,
        status: 'FAILED',
        failureReason: failureCode,
      });
      throw new UnrecoverableError(failureCode);
    }

    throw error;
  }
}

module.exports = {
  processDocumentJob,
  createDefaultProcessor,
  markFailed,
};
