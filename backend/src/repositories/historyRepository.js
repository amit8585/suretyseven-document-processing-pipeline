const { query } = require('../db/pool');
const { mapHistory } = require('./mappers');

async function addHistory({ documentUuid, status, attempt, reason, details }, client) {
  const executor = client || { query };
  const result = await executor.query(
    `INSERT INTO processing_history (document_uuid, status, attempt, reason, details)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING status, attempt, reason, details, created_at`,
    [documentUuid, status, attempt || null, reason || null, details || null]
  );
  return mapHistory(result.rows[0]);
}

async function listHistory(documentUuid) {
  const result = await query(
    `SELECT status, attempt, reason, details, created_at
     FROM processing_history
     WHERE document_uuid = $1
     ORDER BY created_at ASC`,
    [documentUuid]
  );
  return result.rows.map(mapHistory);
}

module.exports = { addHistory, listHistory };
