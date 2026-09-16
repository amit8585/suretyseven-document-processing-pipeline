import { formatDate } from '../utils/labels';

export default function Timeline({ history }) {
  if (!history?.length) {
    return <div className="alert empty">No processing history yet.</div>;
  }

  return (
    <div className="timeline">
      {history.map((item, index) => (
        <div className={`timeline-item ${item.status}`} key={`${item.status}-${index}`}>
          <strong>{item.status}</strong>
          {item.attempt ? <span> · attempt {item.attempt}</span> : null}
          <div>{formatDate(item.timestamp)}</div>
          {item.reason ? <div>Reason: {item.reason}</div> : null}
        </div>
      ))}
    </div>
  );
}
