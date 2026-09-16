import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, userFacingError } from '../services/api';
import { StatusBadge, ErrorState, LoadingBlock } from '../components/States.jsx';
import { formatDate } from '../utils/labels';

export default function DashboardPage() {
  const [stats, setStats] = useState(null);
  const [recent, setRecent] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [statsResponse, listResponse] = await Promise.all([
        api.getStats(),
        api.listDocuments({ page: 1, limit: 5 }),
      ]);
      setStats(statsResponse);
      setRecent(listResponse.data);
      setError('');
    } catch (err) {
      setError(userFacingError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return <LoadingBlock />;
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Dashboard</h1>
          <p>Monitor uploaded documents and processing outcomes.</p>
        </div>
        <Link className="btn" to="/upload">
          Upload document
        </Link>
      </div>
      {error ? <ErrorState message={error} /> : null}
      <div className="grid stats-grid">
        {[
          ['Total', stats?.total],
          ['Uploaded', stats?.uploaded],
          ['Processing', stats?.processing],
          ['Processed', stats?.processed],
          ['Failed', stats?.failed],
        ].map(([label, value]) => (
          <div className="card stat-card" key={label}>
            <div className="label">{label}</div>
            <div className="value">{value ?? 0}</div>
          </div>
        ))}
      </div>
      <div className="card" style={{ marginTop: 16 }}>
        <h2>Recent documents</h2>
        {recent.length === 0 ? (
          <div className="alert empty">No documents uploaded yet.</div>
        ) : (
          recent.map((doc) => (
            <div key={doc.documentId} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--line)' }}>
              <Link to={`/documents/${doc.documentId}`}>
                <strong>{doc.documentId}</strong>
                <div>{doc.filename}</div>
              </Link>
              <div>
                <StatusBadge status={doc.status} />
                <div>{formatDate(doc.createdAt)}</div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
