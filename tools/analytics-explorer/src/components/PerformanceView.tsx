import { useEffect, useState } from 'react';
import { fetchPerformance } from '../api';
import type { ExplorerFilters, PerformanceSummary } from '../types';
import { formatDuration } from '../utils/format';

type Props = {
  filters: ExplorerFilters;
  refreshKey: number;
};

export default function PerformanceView({ filters, refreshKey }: Props) {
  const [data, setData] = useState<PerformanceSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    fetchPerformance(filters)
      .then((res) => {
        if (!cancelled) setData(res);
      })
      .catch((err) => {
        if (!cancelled) setError(String(err));
      });
    return () => {
      cancelled = true;
    };
  }, [filters, refreshKey]);

  if (error) return <div className="error-banner">{error}</div>;
  if (!data) return <div className="loading">Loading performance…</div>;

  return (
    <div>
      <h3 className="section-title">Slowest edges (by median dwell)</h3>
      <table className="data-table">
        <thead>
          <tr>
            <th>From</th>
            <th>To</th>
            <th>Median</th>
            <th>Mean</th>
            <th>P75</th>
            <th>Samples</th>
            <th>Sessions</th>
            <th>Transitions</th>
          </tr>
        </thead>
        <tbody>
          {data.slowestEdges.map((e) => (
            <tr key={`${e.from}-${e.to}`}>
              <td>{e.from}</td>
              <td>{e.to}</td>
              <td>{formatDuration(e.dwellMs.median)}</td>
              <td>{formatDuration(e.dwellMs.mean)}</td>
              <td>{formatDuration(e.dwellMs.p75)}</td>
              <td>{e.dwellMs.sampleCount}</td>
              <td>{e.sessionCount}</td>
              <td>{e.transitionCount}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h3 className="section-title">Slowest nodes (median wait before leaving)</h3>
      <table className="data-table">
        <thead>
          <tr>
            <th>Activity</th>
            <th>Median wait</th>
            <th>Mean</th>
            <th>Samples</th>
            <th>Sessions</th>
          </tr>
        </thead>
        <tbody>
          {data.slowestNodes.map((n) => (
            <tr key={n.label}>
              <td>{n.label}</td>
              <td>{formatDuration(n.dwellMs.median)}</td>
              <td>{formatDuration(n.dwellMs.mean)}</td>
              <td>{n.dwellMs.sampleCount}</td>
              <td>{n.sessionCount}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h3 className="section-title">Funnel timing</h3>
      {data.funnels.map((funnel) => (
        <div key={funnel.name} style={{ marginBottom: '1.25rem' }}>
          <h4 style={{ margin: '0 0 0.5rem', fontSize: '0.85rem' }}>{funnel.name}</h4>
          <table className="data-table">
            <thead>
              <tr>
                <th>Step</th>
                <th>Median</th>
                <th>Mean</th>
                <th>Samples</th>
                <th>Idle gaps</th>
              </tr>
            </thead>
            <tbody>
              {funnel.transitions.map((t) => (
                <tr key={`${t.from}-${t.to}`}>
                  <td>
                    {t.from} → {t.to}
                  </td>
                  <td>{t.dwellMs.sampleCount ? formatDuration(t.dwellMs.median) : '—'}</td>
                  <td>{t.dwellMs.sampleCount ? formatDuration(t.dwellMs.mean) : '—'}</td>
                  <td>{t.sampleCount}</td>
                  <td>{t.dwellMs.idleCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}
