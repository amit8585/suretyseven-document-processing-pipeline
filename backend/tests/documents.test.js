const request = require('supertest');
const { createApp } = require('../src/app');
const { migrate } = require('../src/db/migrate');
const { query, closePool } = require('../src/db/pool');
const { createPdfBuffer, fakeJob } = require('./helpers');
const { processDocumentJob } = require('../src/workers/documentWorker');
const { MockDocumentProcessor } = require('../src/services/processorService');
const documentRepository = require('../src/repositories/documentRepository');

jest.mock('../src/services/queueService', () => ({
  enqueueDocumentProcessing: jest.fn().mockResolvedValue(undefined),
  getRedisConnection: jest.fn(() => ({
    ping: jest.fn().mockResolvedValue('PONG'),
    quit: jest.fn(),
  })),
  closeQueue: jest.fn(),
  getQueue: jest.fn(),
}));

const { enqueueDocumentProcessing } = require('../src/services/queueService');

const app = createApp();

async function uploadPdf({
  filename = 'statement.pdf',
  documentType = 'FINANCIAL_STATEMENT',
  metadata,
  buffer,
} = {}) {
  const req = request(app)
    .post('/documents')
    .attach('file', buffer || createPdfBuffer(filename), filename);
  if (documentType !== undefined) {
    req.field('documentType', documentType);
  }
  if (metadata !== undefined) {
    req.field('metadata', typeof metadata === 'string' ? metadata : JSON.stringify(metadata));
  }
  return req;
}

beforeAll(async () => {
  await migrate();
});

beforeEach(async () => {
  await query('TRUNCATE processing_history, documents CASCADE');
  enqueueDocumentProcessing.mockReset();
  enqueueDocumentProcessing.mockResolvedValue(undefined);
});

afterAll(async () => {
  await closePool();
});

describe('POST /documents', () => {
  test('uploads a valid PDF and returns UPLOADED without waiting for processing', async () => {
    const response = await uploadPdf();

    expect(response.status).toBe(201);
    expect(response.body.documentId).toMatch(/^DOC-[A-F0-9]+$/);
    expect(response.body.status).toBe('UPLOADED');
    expect(enqueueDocumentProcessing).toHaveBeenCalledTimes(1);
    expect(enqueueDocumentProcessing).toHaveBeenCalledWith(response.body.documentId);

    const stored = await documentRepository.findByDocumentId(response.body.documentId);
    expect(stored.status).toBe('UPLOADED');
  });

  test('rejects upload without a file', async () => {
    const response = await request(app)
      .post('/documents')
      .field('documentType', 'FINANCIAL_STATEMENT');

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('FILE_REQUIRED');
  });

  test('rejects upload without documentType', async () => {
    const response = await request(app)
      .post('/documents')
      .attach('file', createPdfBuffer('no-type'), 'file.pdf');

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  test('rejects non-PDF files', async () => {
    const response = await request(app)
      .post('/documents')
      .attach('file', Buffer.from('hello'), 'notes.txt')
      .field('documentType', 'INVOICE');

    expect(response.status).toBe(415);
    expect(response.body.error.code).toBe('UNSUPPORTED_FILE_TYPE');
  });

  test('returns existing document information when the same file is uploaded twice', async () => {
    const buffer = createPdfBuffer('duplicate-check');
    const first = await uploadPdf({ buffer, filename: 'a.pdf' });
    const second = await uploadPdf({ buffer, filename: 'b.pdf' });

    expect(first.status).toBe(201);
    expect(second.status).toBe(200);
    expect(second.body.documentId).toBe(first.body.documentId);
    expect(second.body.duplicate).toBe(true);
    expect(enqueueDocumentProcessing).toHaveBeenCalledTimes(1);

    const count = await query('SELECT COUNT(*)::int AS total FROM documents');
    expect(count.rows[0].total).toBe(1);
  });

  test('marks the document FAILED if queueing fails after insert, and retries queue on the next upload', async () => {
    const buffer = createPdfBuffer('queue-failure');
    enqueueDocumentProcessing.mockRejectedValueOnce(new Error('redis down'));

    const failed = await uploadPdf({ buffer, filename: 'queued.pdf' });
    expect(failed.status).toBe(503);
    expect(failed.body.error.code).toBe('QUEUE_UNAVAILABLE');
    const documentId = failed.body.error.details.documentId;

    const stored = await documentRepository.findByDocumentId(documentId);
    expect(stored.status).toBe('FAILED');
    expect(stored.error.code).toBe('QUEUE_UNAVAILABLE');

    const history = await request(app).get(`/documents/${stored.documentId}/history`);
    expect(history.body.map((item) => item.status)).toEqual(['UPLOADED', 'FAILED']);
    expect(history.body[1].reason).toBe('QUEUE_UNAVAILABLE');

    enqueueDocumentProcessing.mockResolvedValueOnce(undefined);
    const retried = await uploadPdf({ buffer, filename: 'queued.pdf' });
    expect(retried.status).toBe(200);
    expect(retried.body.documentId).toBe(stored.documentId);
    expect(retried.body.status).toBe('UPLOADED');
    expect(retried.body.duplicate).toBe(true);
    expect(enqueueDocumentProcessing).toHaveBeenCalledTimes(2);

    const restored = await documentRepository.findByDocumentId(stored.documentId);
    expect(restored.status).toBe('UPLOADED');
    expect(restored.error).toBeNull();
  });
});

describe('GET /documents', () => {
  test('lists documents with pagination and combined filters', async () => {
    await uploadPdf({ filename: 'one.pdf', documentType: 'INVOICE', buffer: createPdfBuffer('one') });
    await uploadPdf({
      filename: 'two.pdf',
      documentType: 'FINANCIAL_STATEMENT',
      buffer: createPdfBuffer('two'),
    });

    const failedDoc = await uploadPdf({
      filename: 'three.pdf',
      documentType: 'INVOICE',
      buffer: createPdfBuffer('three'),
    });
    const stored = await documentRepository.findByDocumentId(failedDoc.body.documentId);
    await documentRepository.updateDocument(stored.id, { status: 'FAILED' });

    const response = await request(app).get('/documents').query({
      page: 1,
      limit: 10,
      status: 'FAILED',
      documentType: 'INVOICE',
    });

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0].documentId).toBe(failedDoc.body.documentId);
    expect(response.body.pagination).toEqual({
      page: 1,
      limit: 10,
      total: 1,
      totalPages: 1,
    });
  });
});

describe('GET /documents/:documentId', () => {
  test('returns document details', async () => {
    const created = await uploadPdf({ filename: 'details.pdf', buffer: createPdfBuffer('details') });
    const response = await request(app).get(`/documents/${created.body.documentId}`);

    expect(response.status).toBe(200);
    expect(response.body.documentId).toBe(created.body.documentId);
    expect(response.body.filename).toBe('details.pdf');
    expect(response.body.documentType).toBe('FINANCIAL_STATEMENT');
    expect(response.body.status).toBe('UPLOADED');
    expect(response.body.createdAt).toBeDefined();
    expect(response.body.updatedAt).toBeDefined();
  });

  test('returns DOCUMENT_NOT_FOUND for unknown ids', async () => {
    const response = await request(app).get('/documents/DOC-MISSING');
    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('DOCUMENT_NOT_FOUND');
    expect(response.body.error.message).toBe('Document not found');
  });
});

describe('GET /documents/:documentId/history', () => {
  test('returns lifecycle events', async () => {
    const created = await uploadPdf({ filename: 'history.pdf', buffer: createPdfBuffer('history') });
    const response = await request(app).get(`/documents/${created.body.documentId}/history`);

    expect(response.status).toBe(200);
    expect(response.body[0]).toMatchObject({
      status: 'UPLOADED',
    });
    expect(response.body[0].timestamp).toBeDefined();
  });
});

describe('GET /health', () => {
  test('returns ok when dependencies respond', async () => {
    const response = await request(app).get('/health');
    expect(response.status).toBe(200);
    expect(response.body.status).toBe('ok');
  });
});

describe('document processing', () => {
  async function createUploadedDocument() {
    const created = await uploadPdf({
      filename: 'process.pdf',
      buffer: createPdfBuffer(`process-${Date.now()}-${Math.random()}`),
    });
    return created.body.documentId;
  }

  test('successfully processes extracted data', async () => {
    const documentId = await createUploadedDocument();
    const processor = new MockDocumentProcessor({ scenario: 'SUCCESS', delayMs: 0 });

    const result = await processDocumentJob(fakeJob(documentId), processor);
    expect(result.status).toBe('PROCESSED');

    const details = await request(app).get(`/documents/${documentId}`);
    expect(details.body.status).toBe('PROCESSED');
    expect(details.body.result.companyName).toBe('ABC Construction Pvt Ltd');
    expect(details.body.result.annualRevenue).toBe(12500000);

    const history = await request(app).get(`/documents/${documentId}/history`);
    expect(history.body.map((item) => item.status)).toEqual([
      'UPLOADED',
      'PROCESSING',
      'PROCESSED',
    ]);
  });

  test('marks invalid extracted data as FAILED with structured validation errors', async () => {
    const documentId = await createUploadedDocument();
    const processor = {
      process: async () => ({
        companyName: '',
        registrationNumber: '',
        annualRevenue: -25,
        documentDate: 'not-a-date',
      }),
    };

    await expect(processDocumentJob(fakeJob(documentId), processor)).rejects.toThrow(
      'VALIDATION_FAILED'
    );

    const details = await request(app).get(`/documents/${documentId}`);
    expect(details.body.status).toBe('FAILED');
    expect(details.body.error.code).toBe('VALIDATION_FAILED');
    expect(details.body.error.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: 'annualRevenue' }),
        expect.objectContaining({ field: 'companyName' }),
        expect.objectContaining({ field: 'documentDate' }),
      ])
    );

    const history = await request(app).get(`/documents/${documentId}/history`);
    expect(history.body.map((item) => item.status)).toEqual([
      'UPLOADED',
      'PROCESSING',
      'FAILED',
    ]);
    expect(history.body[2].reason).toBe('VALIDATION_FAILED');
  });

  test('does not retry INVALID_RESULT processor failures', async () => {
    const documentId = await createUploadedDocument();
    const processor = new MockDocumentProcessor({
      scenario: 'INVALID_RESULT',
      delayMs: 0,
    });

    await expect(processDocumentJob(fakeJob(documentId), processor)).rejects.toThrow(
      'INVALID_RESULT'
    );

    const details = await request(app).get(`/documents/${documentId}`);
    expect(details.body.status).toBe('FAILED');
    expect(details.body.error.code).toBe('INVALID_RESULT');
    expect(details.body.error.attempt).toBe(1);
    expect(processor.callCount).toBe(1);
  });

  test('retries a transient processor failure and then succeeds', async () => {
    const documentId = await createUploadedDocument();
    const processor = new MockDocumentProcessor({
      sequence: ['TIMEOUT', 'SUCCESS'],
      delayMs: 0,
    });

    await expect(processDocumentJob(fakeJob(documentId, 0), processor)).rejects.toThrow(
      'Processor timed out'
    );

    let details = await request(app).get(`/documents/${documentId}`);
    expect(details.body.status).toBe('PROCESSING');
    expect(details.body.error.code).toBe('TIMEOUT');
    expect(details.body.error.attempt).toBe(1);

    const result = await processDocumentJob(fakeJob(documentId, 1), processor);
    expect(result.status).toBe('PROCESSED');

    details = await request(app).get(`/documents/${documentId}`);
    expect(details.body.status).toBe('PROCESSED');
    expect(details.body.result.registrationNumber).toBe('U12345DL2020PTC123456');

    const history = await request(app).get(`/documents/${documentId}/history`);
    expect(history.body.map((item) => item.status)).toEqual([
      'UPLOADED',
      'PROCESSING',
      'FAILED',
      'PROCESSING',
      'PROCESSED',
    ]);
    expect(history.body[2]).toMatchObject({ reason: 'TIMEOUT', attempt: 1 });
    expect(history.body[3].attempt).toBe(2);
  });

  test('marks the document FAILED after retry attempts are exhausted', async () => {
    const documentId = await createUploadedDocument();
    const processor = new MockDocumentProcessor({ scenario: 'ERROR', delayMs: 0 });

    await expect(processDocumentJob(fakeJob(documentId, 0, 3), processor)).rejects.toThrow(
      'unexpected error'
    );
    await expect(processDocumentJob(fakeJob(documentId, 1, 3), processor)).rejects.toThrow(
      'unexpected error'
    );
    await expect(processDocumentJob(fakeJob(documentId, 2, 3), processor)).rejects.toThrow(
      'PROCESSOR_ERROR'
    );

    const details = await request(app).get(`/documents/${documentId}`);
    expect(details.body.status).toBe('FAILED');
    expect(details.body.error.code).toBe('PROCESSOR_ERROR');
    expect(details.body.error.attempt).toBe(3);

    const history = await request(app).get(`/documents/${documentId}/history`);
    const failed = history.body.filter((item) => item.status === 'FAILED');
    expect(failed).toHaveLength(3);
    expect(failed[2].attempt).toBe(3);
  });
});
