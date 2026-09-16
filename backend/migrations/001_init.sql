CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id VARCHAR(32) NOT NULL UNIQUE,
  filename VARCHAR(255) NOT NULL,
  original_filename VARCHAR(255) NOT NULL,
  stored_path TEXT NOT NULL,
  mime_type VARCHAR(100) NOT NULL,
  file_size INTEGER NOT NULL,
  file_hash VARCHAR(64) NOT NULL UNIQUE,
  document_type VARCHAR(64) NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  status VARCHAR(20) NOT NULL,
  result JSONB,
  error JSONB,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT documents_status_check CHECK (
    status IN ('UPLOADED', 'PROCESSING', 'PROCESSED', 'FAILED')
  )
);

CREATE TABLE IF NOT EXISTS processing_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_uuid UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  status VARCHAR(20) NOT NULL,
  attempt INTEGER,
  reason TEXT,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_documents_status ON documents (status);
CREATE INDEX IF NOT EXISTS idx_documents_document_type ON documents (document_type);
CREATE INDEX IF NOT EXISTS idx_documents_file_hash ON documents (file_hash);
CREATE INDEX IF NOT EXISTS idx_documents_created_at ON documents (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_documents_filename ON documents (filename);
CREATE INDEX IF NOT EXISTS idx_processing_history_document_uuid
  ON processing_history (document_uuid, created_at ASC);
