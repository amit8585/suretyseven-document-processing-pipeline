export function StatusBadge({ status }) {
  return <span className={`badge ${status}`}>{status}</span>;
}

export function EmptyState({ title, message }) {
  return (
    <div className="alert empty">
      <strong>{title}</strong>
      <div>{message}</div>
    </div>
  );
}

export function ErrorState({ message }) {
  return <div className="alert error">{message}</div>;
}

export function SuccessState({ message }) {
  return <div className="alert success">{message}</div>;
}

export function LoadingBlock() {
  return (
    <div className="card">
      <div className="skeleton" />
      <div className="skeleton" style={{ marginTop: 12, width: '70%' }} />
      <div className="skeleton" style={{ marginTop: 12, width: '40%' }} />
    </div>
  );
}
