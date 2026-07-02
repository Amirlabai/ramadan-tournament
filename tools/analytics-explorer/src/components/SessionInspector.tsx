import { useEffect, useState } from 'react';
import { fetchSession } from '../api';
import type { ExplorerFilters, SessionStep } from '../types';
import { formatDuration } from '../utils/format';

type Props = {
  filters: ExplorerFilters;
  refreshKey: number;
  sessionId?: string;
};

export default function SessionInspector({ filters, refreshKey, sessionId: externalId }: Props) {
  const [inputId, setInputId] = useState(externalId ?? '');
  const [steps, setSteps] = useState<SessionStep[]>([]);
  const [totalSpanMs, setTotalSpanMs] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadedId, setLoadedId] = useState('');

  useEffect(() => {
    if (externalId) setInputId(externalId);
  }, [externalId]);

  useEffect(() => {
    if (!inputId.trim()) return;
    let cancelled = false;
    setError(null);
    fetchSession(inputId.trim(), filters)
      .then((res) => {
        if (!cancelled) {
          setSteps(res.steps);
          setTotalSpanMs(res.totalSpanMs);
          setLoadedId(res.sessionId);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(String(err));
          setSteps([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [inputId, filters, refreshKey]);

  return (
    <div>
      <div className="filters-bar" style={{ padding: '0.5rem 0', marginBottom: '0.75rem' }}>
        <label style={{ flex: 1, maxWidth: '28rem' }}>
          Session ID
          <input
            value={inputId}
            onChange={(e) => setInputId(e.target.value)}
            placeholder="Paste session UUID"
          />
        </label>
        <button type="button" className="btn" onClick={() => setInputId(inputId.trim())}>
          Load
        </button>
      </div>

      {error && <div className="error-banner">{error}</div>}

      {loadedId && steps.length > 0 && (
        <>
          <p style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>
            Session <span className="mono">{loadedId}</span>
            {totalSpanMs != null && totalSpanMs > 0 && (
              <> · total span {formatDuration(totalSpanMs)}</>
            )}
          </p>
          <ul className="timeline">
            {steps.map((step, i) => (
              <li key={step.id}>
                <div>
                  <strong>{step.activityLabel}</strong>
                  <span className="mono" style={{ marginLeft: '0.5rem', color: 'var(--muted)' }}>
                    {new Date(step.createdAt).toLocaleString()}
                  </span>
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>
                  {step.eventName} · {step.category} · {step.source}
                </div>
                {step.dwellToNextMs != null && (
                  <div className={step.idleGap ? 'idle' : ''} style={{ fontSize: '0.8rem' }}>
                    → next in {formatDuration(step.dwellToNextMs)}
                    {step.idleGap ? ' (idle gap)' : ''}
                  </div>
                )}
                {i === steps.length - 1 && <div style={{ fontSize: '0.75rem' }}>end of trace</div>}
              </li>
            ))}
          </ul>
        </>
      )}

      {!error && loadedId && steps.length === 0 && (
        <div className="loading">No events for this session in range.</div>
      )}
    </div>
  );
}
