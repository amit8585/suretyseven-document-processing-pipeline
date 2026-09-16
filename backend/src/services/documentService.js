const fs = require('fs/promises');
const path = require('path');
const { config } = require('../config');
const { logger } = require('../config/logger');
const { AppError } = require('../utils/errors');
const { createDocumentId, sanitizeFilename, isInsideDirectory } = require('../utils/id');
const { sha256Buffer } = require('../utils/hash');
const { withTransaction } = require('../db/pool');
const documentRepository = require('../repositories/documentRepository');
const historyRepository = require('../repositories/historyRepository');
const { enqueueDocumentProcessing } = require('./queueService');

async function ensureUploadDir() {
  await fs.mkdir(config.uploadDir, { recursive: true });
}

function toPublicDocument(document, extra = {}) {
  return {
    documentId: document.documentId,
    filename: document.filename,
    documentType: document.documentType,
    status: document.status,
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
    result: document.result,
    error: document.error,
    attemptCount: document.attemptCount,
    ...extra,
  };
}

async function uploadDocument({ file, documentType, metadata }) {
  if (!file) {
    throw new AppError('FILE_REQUIRED', 'A PDF file is required', 400);
  }

  const isPdfMime = file.mimetype === 'application/pdf';
  const isPdfName = (file.originalname || '').toLowerCase().endsWith('.pdf');
  const isPdfBytes =
    Buffer.isBuffer(file.buffer) && file.buffer.subarray(0, 5).toString() === '%PDF-';
  if ((!isPdfMime && !isPdfName) || !isPdfBytes) {
    throw new AppError('UNSUPPORTED_FILE_TYPE', 'Only PDF files are supported', 415);
  }

  const fileHash = sha256Buffer(file.buffer);
  const existing = await documentRepository.findByHash(fileHash);
  if (existing) {
    return handleExistingDocument(existing);
  }

  const documentId = createDocumentId();
  const filename = sanitizeFilename(file.originalname);
  await ensureUploadDir();
  const storedPath = path.join(config.uploadDir, `${documentId}.pdf`);
  await fs.writeFile(storedPath, file.buffer);

  try {
    const document = await withTransaction(async (client) => {
      const created = await documentRepository.insertDocument(
        {
          documentId,
          filename,
          originalFilename: file.originalname,
          storedPath,
          mimeType: file.mimetype || 'application/pdf',
          fileSize: file.size,
          fileHash,
          documentType,
          metadata,
          status: 'UPLOADED',
        },
        client
      );
      await historyRepository.addHistory(
        {
          documentUuid: created.id,
          status: 'UPLOADED',
        },
        client
      );
      return created;
    });

    await queueProcessingJob(document);

    logger.info('Document uploaded', {
      documentId: document.documentId,
      status: 'UPLOADED',
    });

    return {
      documentId: document.documentId,
      status: document.status,
    };
  } catch (error) {
    if (error instanceof AppError && error.code === 'QUEUE_UNAVAILABLE') {
      throw error;
    }
    if (error.code === '23505') {
      await fs.unlink(storedPath).catch(() => {});
      const duplicate = await documentRepository.findByHash(fileHash);
      if (duplicate) {
        return handleExistingDocument(duplicate);
      }
    }
    await fs.unlink(storedPath).catch(() => {});
    throw error;
  }
}

function isUnqueuedFailure(document) {
  return document.status === 'FAILED' && document.error?.code === 'QUEUE_UNAVAILABLE';
}

async function markQueueFailure(document) {
  await documentRepository.updateDocument(document.id, {
    status: 'FAILED',
    error: {
      code: 'QUEUE_UNAVAILABLE',
      message: 'Processing could not be queued',
    },
  });
  await historyRepository.addHistory({
    documentUuid: document.id,
    status: 'FAILED',
    reason: 'QUEUE_UNAVAILABLE',
  });
}

async function queueProcessingJob(document) {
  try {
    await enqueueDocumentProcessing(document.documentId);
  } catch (error) {
    logger.error('Failed to enqueue processing job', {
      documentId: document.documentId,
      status: 'FAILED',
      failureReason: error.message,
    });
    await markQueueFailure(document);
    throw new AppError(
      'QUEUE_UNAVAILABLE',
      'Document was saved but processing could not be queued',
      503,
      { documentId: document.documentId }
    );
  }
}

async function handleExistingDocument(existing) {
  if (!isUnqueuedFailure(existing)) {
    logger.info('Duplicate document upload ignored', {
      documentId: existing.documentId,
      status: existing.status,
      failureReason: 'DUPLICATE_FILE_HASH',
    });
    return toPublicDocument(existing, { duplicate: true });
  }

  const restored = await documentRepository.updateDocument(existing.id, {
    status: 'UPLOADED',
    error: null,
  });
  await historyRepository.addHistory({
    documentUuid: existing.id,
    status: 'UPLOADED',
    reason: 'QUEUE_RETRY',
  });
  await queueProcessingJob(restored);
  logger.info('Re-queued document after previous queue failure', {
    documentId: restored.documentId,
    status: 'UPLOADED',
  });
  return {
    documentId: restored.documentId,
    status: 'UPLOADED',
    duplicate: true,
  };
}

async function getDocument(documentId) {
  const document = await documentRepository.findByDocumentId(documentId);
  if (!document) {
    throw new AppError('DOCUMENT_NOT_FOUND', 'Document not found', 404);
  }
  return toPublicDocument(document);
}

async function getDocumentFile(documentId) {
  const document = await documentRepository.findByDocumentId(documentId);
  if (!document) {
    throw new AppError('DOCUMENT_NOT_FOUND', 'Document not found', 404);
  }
  if (!isInsideDirectory(config.uploadDir, document.storedPath)) {
    throw new AppError('FILE_NOT_FOUND', 'Stored file was not found', 404);
  }
  return document;
}

async function getHistory(documentId) {
  const document = await documentRepository.findByDocumentId(documentId);
  if (!document) {
    throw new AppError('DOCUMENT_NOT_FOUND', 'Document not found', 404);
  }
  const history = await historyRepository.listHistory(document.id);
  return history.map((item) => ({
    status: item.status,
    timestamp: item.timestamp,
    attempt: item.attempt,
    reason: item.reason,
  }));
}

async function listDocuments(filters) {
  const { data, total } = await documentRepository.listDocuments(filters);
  const totalPages = Math.max(1, Math.ceil(total / filters.limit));
  return {
    data: data.map((document) => toPublicDocument(document)),
    pagination: {
      page: filters.page,
      limit: filters.limit,
      total,
      totalPages,
    },
  };
}

async function getStats() {
  return documentRepository.getStats();
}

module.exports = {
  uploadDocument,
  getDocument,
  getDocumentFile,
  getHistory,
  listDocuments,
  getStats,
  toPublicDocument,
};
