import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, userFacingError } from '../services/api';
import { DOCUMENT_TYPES, STATUSES, formatDate, typeLabel } from '../utils/labels';
import { EmptyState, ErrorState, LoadingBlock, StatusBadge } from '../components/States.jsx';

const EMPTY_FILTERS = {
  status: '',
  documentType: '',
  search: '',
  from: '',
  to: '',
  page: 1,
  limit: 10,
};

export default function DocumentsPage() {
  const navigate = useNavigate();
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.listDocuments(filters);
      setResult(response);
      setError('');
    } catch (err) {
      setError(userFacingError(err));
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    load();
  }, [load]);

  function updateFilter(name, value) {
    setFilters((current) => ({ ...current, page: 1, [name]: value }));
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Documents</h1>
          <p>Filter by status, type, date, or search by ID and filename.</p>
        </div>
      </div>
      <div className="card">
        <div className="filters">
          <div>
            <label>Status</label>
            <select value={filters.status} onChange={(e) => updateFilter('status', e.target.value)}>
              <option value="">All</option>
              {STATUSES.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label>Document type</label>
            <select
              value={filters.documentType}
              onChange={(e) => updateFilter('documentType', e.target.value)}
            >
              <option value="">All</option>
              {DOCUMENT_TYPES.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label>Search</label>
            <input
              value={filters.search}
              placeholder="DOC-… or filename"
              onChange={(e) => updateFilter('search', e.target.value)}
            />
          </div>
          <div>
            <label>From</label>
            <input type="date" value={filters.from} onChange={(e) => updateFilter('from', e.target.value)} />
          </div>
          <div>
            <label>To</label>
            <input type="date" value={filters.to} onChange={(e) => updateFilter('to', e.target.value)} />
          </div>
        </div>
        {error ? <ErrorState message={error} /> : null}
        {loading ? (
          <LoadingBlock />
        ) : !result?.data?.length ? (
          <EmptyState title="No documents found" message="Try changing filters or upload a document." />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Document ID</th>
                  <th>Filename</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Uploaded</th>
                </tr>
              </thead>
              <tbody>
                {result.data.map((doc) => (
                  <tr
                    className="clickable"
                    key={doc.documentId}
                    onClick={() => navigate(`/documents/${doc.documentId}`)}
                  >
                    <td>{doc.documentId}</td>
                    <td>{doc.filename}</td>
                    <td>{typeLabel(doc.documentType)}</td>
                    <td>
                      <StatusBadge status={doc.status} />
                    </td>
                    <td>{formatDate(doc.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {result?.pagination ? (
          <div className="pagination">
            <span>
              Page {result.pagination.page} of {result.pagination.totalPages} · {result.pagination.total}{' '}
              total
            </span>
            <div>
              <button
                className="btn secondary"
                disabled={result.pagination.page <= 1}
                onClick={() => setFilters((current) => ({ ...current, page: current.page - 1 }))}
              >
                Previous
              </button>{' '}
              <button
                className="btn secondary"
                disabled={result.pagination.page >= result.pagination.totalPages}
                onClick={() => setFilters((current) => ({ ...current, page: current.page + 1 }))}
              >
                Next
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
