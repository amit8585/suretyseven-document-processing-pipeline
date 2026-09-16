import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api, userFacingError } from '../services/api';
import { formatDate, typeLabel } from '../utils/labels';
import { ErrorState, LoadingBlock, StatusBadge } from '../components/States.jsx';
import Timeline from '../components/Timeline.jsx';
import { usePolling } from '../hooks/usePolling';

export default function DocumentDetailsPage() {
  const { documentId } = useParams();
  const [document, setDocument] = useState(null);
  const [history, setHistory] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [doc, events] = await Promise.all([
        api.getDocument(documentId),
        api.getHistory(documentId),
      ]);
      setDocument(doc);
      setHistory(events);
      setError('');
    } catch (err) {
      setError(userFacingError(err));
    } finally {
      setLoading(false);
    }
  }, [documentId]);

  useEffect(() => {
    load();
  }, [load]);

  const shouldPoll = document?.status === 'PROCESSING' || document?.status === 'UPLOADED';
  usePolling(shouldPoll, load, 2500);

  if (loading && !document) {
    return <LoadingBlock />;
  }

  if (error && !document) {
    return <ErrorState message={error} />;
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>{document.documentId}</h1>
          <p>{document.filename}</p>
        </div>
        <StatusBadge status={document.status} />
      </div>
      {shouldPoll ? <div className="alert success">Processing in progress. Status refreshes automatically.</div> : null}
      <div className="details-grid">
        <div className="card">
          <h2>Document information</h2>
          <p>Type: {typeLabel(document.documentType)}</p>
          <p>Uploaded: {formatDate(document.createdAt)}</p>
          <p>Updated: {formatDate(document.updatedAt)}</p>
          <h3>Extracted information</h3>
          {document.result ? (
            <div>
              {Object.entries(document.result).map(([key, value]) => (
                <p key={key}>
                  <strong>{key}:</strong> {String(value)}
                </p>
              ))}
            </div>
          ) : (
            <p>No extracted data yet.</p>
          )}
          {document.error?.code === 'VALIDATION_FAILED' ? (
            <div>
              <h3>Validation errors</h3>
              {(document.error.errors || []).map((item) => (
                <p key={item.field}>
                  {item.field}: {item.message}
                </p>
              ))}
            </div>
          ) : null}
          {document.error && document.error.code !== 'VALIDATION_FAILED' ? (
            <div>
              <h3>Processor failure</h3>
              <p>
                {document.error.code}
                {document.error.attempt ? ` · attempt ${document.error.attempt}` : ''}
              </p>
              <p>The document could not be processed. You can upload a corrected file if needed.</p>
            </div>
          ) : null}
        </div>
        <div className="card">
          <h2>Processing history</h2>
          <Timeline history={history} />
        </div>
      </div>
      <div className="card" style={{ marginTop: 16 }}>
        <h2>PDF preview</h2>
        <iframe
          className="pdf-frame"
          title="PDF preview"
          src={api.fileUrl(documentId)}
        />
      </div>
    </div>
  );
}
