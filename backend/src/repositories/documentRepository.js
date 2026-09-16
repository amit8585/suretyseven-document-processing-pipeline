const { query } = require('../db/pool');
const { mapDocument } = require('./mappers');

const DOCUMENT_COLUMNS = `
  id, document_id, filename, original_filename, stored_path, mime_type,
  file_size, file_hash, document_type, metadata, status, result, error,
  attempt_count, created_at, updated_at
`;

async function insertDocument(record, client) {
  const executor = client || { query };
  const result = await executor.query(
    `INSERT INTO documents (
       document_id, filename, original_filename, stored_path, mime_type,
       file_size, file_hash, document_type, metadata, status
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     RETURNING ${DOCUMENT_COLUMNS}`,
    [
      record.documentId,
      record.filename,
      record.originalFilename,
      record.storedPath,
      record.mimeType,
      record.fileSize,
      record.fileHash,
      record.documentType,
      record.metadata || {},
      record.status,
    ]
  );
  return mapDocument(result.rows[0]);
}

async function findByDocumentId(documentId) {
  const result = await query(
    `SELECT ${DOCUMENT_COLUMNS} FROM documents WHERE document_id = $1`,
    [documentId]
  );
  return mapDocument(result.rows[0]);
}

async function findByHash(fileHash, client) {
  const executor = client || { query };
  const result = await executor.query(
    `SELECT ${DOCUMENT_COLUMNS} FROM documents WHERE file_hash = $1`,
    [fileHash]
  );
  return mapDocument(result.rows[0]);
}

async function updateDocument(id, fields) {
  const assignments = [];
  const values = [];
  let index = 1;

  for (const [column, value] of Object.entries(fields)) {
    assignments.push(`${column} = $${index}`);
    values.push(value);
    index += 1;
  }

  assignments.push(`updated_at = NOW()`);
  values.push(id);

  const result = await query(
    `UPDATE documents SET ${assignments.join(', ')} WHERE id = $${index}
     RETURNING ${DOCUMENT_COLUMNS}`,
    values
  );
  return mapDocument(result.rows[0]);
}

async function listDocuments({ status, documentType, search, from, to, page, limit }) {
  const where = [];
  const values = [];
  let index = 1;

  if (status) {
    where.push(`status = $${index++}`);
    values.push(status);
  }
  if (documentType) {
    where.push(`document_type = $${index++}`);
    values.push(documentType);
  }
  if (search) {
    where.push(
      `(document_id ILIKE $${index} OR filename ILIKE $${index} OR original_filename ILIKE $${index})`
    );
    values.push(`%${search}%`);
    index += 1;
  }
  if (from) {
    where.push(`created_at >= $${index++}`);
    values.push(from.length === 10 ? `${from}T00:00:00.000Z` : from);
  }
  if (to) {
    where.push(`created_at <= $${index++}`);
    values.push(to.length === 10 ? `${to}T23:59:59.999Z` : to);
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const offset = (page - 1) * limit;

  const countResult = await query(
    `SELECT COUNT(*)::int AS total FROM documents ${whereSql}`,
    values
  );
  const total = countResult.rows[0].total;

  const dataResult = await query(
    `SELECT ${DOCUMENT_COLUMNS}
     FROM documents
     ${whereSql}
     ORDER BY created_at DESC
     LIMIT $${index++} OFFSET $${index++}`,
    [...values, limit, offset]
  );

  return {
    data: dataResult.rows.map(mapDocument),
    total,
  };
}

async function getStats() {
  const result = await query(`
    SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE status = 'PROCESSING')::int AS processing,
      COUNT(*) FILTER (WHERE status = 'UPLOADED')::int AS uploaded,
      COUNT(*) FILTER (WHERE status = 'PROCESSED')::int AS processed,
      COUNT(*) FILTER (WHERE status = 'FAILED')::int AS failed
    FROM documents
  `);
  return result.rows[0];
}

module.exports = {
  insertDocument,
  findByDocumentId,
  findByHash,
  updateDocument,
  listDocuments,
  getStats,
};
