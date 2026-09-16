import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, userFacingError } from '../services/api';
import { DOCUMENT_TYPES } from '../utils/labels';
import { ErrorState, SuccessState } from '../components/States.jsx';
import { useToast } from '../components/Toast.jsx';

export default function UploadPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const [file, setFile] = useState(null);
  const [documentType, setDocumentType] = useState('FINANCIAL_STATEMENT');
  const [metadata, setMetadata] = useState('');
  const [simulateOutcome, setSimulateOutcome] = useState('SUCCESS');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setSuccess('');

    if (!file) {
      setError('Please choose a PDF file before uploading.');
      return;
    }

    let parsedMetadata = {};
    if (metadata.trim()) {
      try {
        parsedMetadata = JSON.parse(metadata);
      } catch (err) {
        setError('Optional metadata must be valid JSON, for example {"source":"broker"}.');
        return;
      }
    }
    parsedMetadata.simulateOutcome = simulateOutcome;

    const formData = new FormData();
    formData.append('file', file);
    formData.append('documentType', documentType);
    formData.append('metadata', JSON.stringify(parsedMetadata));

    setLoading(true);
    try {
      const result = await api.uploadDocument(formData);
      if (result.duplicate) {
        setSuccess(`This file was uploaded before. Opening ${result.documentId}.`);
        toast.show('Duplicate file — existing document opened');
      } else {
        setSuccess(`Uploaded ${result.documentId}. Processing has started.`);
        toast.show('Document uploaded');
      }
      setTimeout(() => navigate(`/documents/${result.documentId}`), 700);
    } catch (err) {
      setError(userFacingError(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Upload document</h1>
          <p>Select a PDF and document type. Processing starts immediately after upload.</p>
        </div>
      </div>
      <form className="card" onSubmit={handleSubmit}>
        <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div>
            <label htmlFor="file">PDF file</label>
            <input
              id="file"
              type="file"
              accept="application/pdf,.pdf"
              onChange={(event) => setFile(event.target.files?.[0] || null)}
            />
          </div>
          <div>
            <label htmlFor="documentType">Document type</label>
            <select
              id="documentType"
              value={documentType}
              onChange={(event) => setDocumentType(event.target.value)}
            >
              {DOCUMENT_TYPES.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div style={{ marginTop: 16 }}>
          <label htmlFor="simulateOutcome">Processor simulation (for demo/testing)</label>
          <select
            id="simulateOutcome"
            value={simulateOutcome}
            onChange={(event) => setSimulateOutcome(event.target.value)}
          >
            <option value="SUCCESS">Success</option>
            <option value="RETRY_THEN_SUCCESS">Timeout then success (retry demo)</option>
            <option value="TIMEOUT">Timeout (retryable, then fail)</option>
            <option value="ERROR">Processor error (retryable, then fail)</option>
            <option value="INVALID_RESULT">Invalid result (not retried)</option>
            <option value="VALIDATION_FAILED">Invalid extracted data (not retried)</option>
          </select>
        </div>
        <div style={{ marginTop: 16 }}>
          <label htmlFor="metadata">Optional metadata JSON</label>
          <textarea
            id="metadata"
            placeholder='{"broker":"Acme"}'
            value={metadata}
            onChange={(event) => setMetadata(event.target.value)}
          />
        </div>
        {error ? <ErrorState message={error} /> : null}
        {success ? <SuccessState message={success} /> : null}
        <div style={{ marginTop: 16 }}>
          <button className="btn" type="submit" disabled={loading}>
            {loading ? 'Uploading…' : 'Upload'}
          </button>
        </div>
      </form>
    </div>
  );
}
