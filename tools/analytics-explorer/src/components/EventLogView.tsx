import { useEffect, useState } from 'react';
import { exportCsvUrl, fetchEvents } from '../api';
import type { EventLogRow, ExplorerFilters } from '../types';

type Props = {
  filters: ExplorerFilters;
  refreshKey: number;
  activityFilter?: string;
  onSelectSession?: (sessionId: string) => void;
};

export default function EventLogView({
  filters,
  refreshKey,
  activityFilter,
  onSelectSession,
}: Props) {
  const [rows, setRows] = useState<EventLogRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [eventName, setEventName] = useState('');
  const [sessionId, setSessionId] = useState('');

  useEffect(() => {
    let cancelled = false;
    setError(null);
    fetchEvents(filters, page, {
      eventName: eventName || undefined,
      sessionId: sessionId || undefined,
      activityLabel: activityFilter,
    })
      .then((res) => {
        if (!cancelled) {
          setRows(res.rows);
          setTotal(res.total);
        }
      })
      .catch((err) => {
        if (!cancelled) setError(String(err));
      });
    return () => {
      cancelled = true;
    };
  }, [filters, refreshKey, page, eventName, sessionId, activityFilter]);

  if (error) return <div className="error-banner">{error}</div>;

  const pageSize = 50;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div>
      <div className="filters-bar" style={{ marginBottom: '0.75rem', padding: '0.5rem 0' }}>
        <label>
          Event name
          <input
            value={eventName}
            onChange={(e) => {
              setPage(1);
              setEventName(e.target.value);
            }}
            placeholder="page_view"
          />
        </label>
        <label>
          Session ID
          <input
            value={sessionId}
            onChange={(e) => {
              setPage(1);
              setSessionId(e.target.value);
            }}
            placeholder="partial id"
          />
        </label>
        {activityFilter && (
          <span style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>
            Activity filter: <strong>{activityFilter}</strong>
          </span>
        )}
        <a className="btn btn-ghost" href={exportCsvUrl(filters)} download>
          Export CSV
        </a>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Time</th>
              <th>Activity</th>
              <th>Event</th>
              <th>Category</th>
              <th>Source</th>
              <th>Session</th>
              <th>Path</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td className="mono">{new Date(row.createdAt).toLocaleString()}</td>
                <td>{row.activityLabel}</td>
                <td className="mono">{row.eventName}</td>
                <td>{row.category}</td>
                <td>{row.source}</td>
                <td className="mono">
                  {row.sessionId ? (
                    <button
                      type="button"
                      className="btn-ghost"
                      style={{ padding: '0.1rem 0.3rem', fontSize: '0.72rem' }}
                      onClick={() => onSelectSession?.(row.sessionId!)}
                    >
                      {row.sessionId.slice(0, 8)}…
                    </button>
                  ) : (
                    '—'
                  )}
                </td>
                <td className="mono">{row.path ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="pager">
        <button
          type="button"
          className="btn btn-ghost"
          disabled={page <= 1}
          onClick={() => setPage((p) => p - 1)}
        >
          Prev
        </button>
        <span>
          Page {page} / {totalPages} ({total} rows)
        </span>
        <button
          type="button"
          className="btn btn-ghost"
          disabled={page >= totalPages}
          onClick={() => setPage((p) => p + 1)}
        >
          Next
        </button>
      </div>
    </div>
  );
}
