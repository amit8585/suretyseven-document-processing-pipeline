function mapDocument(row) {
  if (!row) {
    return null;
  }
  return {
    id: row.id,
    documentId: row.document_id,
    filename: row.filename,
    originalFilename: row.original_filename,
    storedPath: row.stored_path,
    mimeType: row.mime_type,
    fileSize: row.file_size,
    fileHash: row.file_hash,
    documentType: row.document_type,
    metadata: row.metadata || {},
    status: row.status,
    result: row.result,
    error: row.error,
    attemptCount: row.attempt_count,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapHistory(row) {
  return {
    status: row.status,
    timestamp: row.created_at,
    attempt: row.attempt,
    reason: row.reason,
    details: row.details,
  };
}

module.exports = { mapDocument, mapHistory };
