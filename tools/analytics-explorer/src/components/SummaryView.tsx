import { useEffect, useState } from 'react';
import { fetchSummary } from '../api';
import type { ExplorerFilters, SummaryResult } from '../types';

type Props = {
  filters: ExplorerFilters;
  refreshKey: number;
};

export default function SummaryView({ filters, refreshKey }: Props) {
  const [data, setData] = useState<SummaryResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    fetchSummary(filters)
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
  if (!data) return <div className="loading">Loading summary…</div>;

  const maxDay = Math.max(...data.eventsByDay.map((d) => d.count), 1);
  const maxName = Math.max(...data.eventsByName.map((d) => d.count), 1);

  return (
    <div>
      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="value">{data.totalEvents.toLocaleString()}</div>
          <div className="label">Total events</div>
        </div>
        <div className="kpi-card">
          <div className="value">{data.uniqueSessions.toLocaleString()}</div>
          <div className="label">Unique sessions</div>
        </div>
        <div className="kpi-card">
          <div className="value">{data.eventsByCategory.length}</div>
          <div className="label">Categories</div>
        </div>
      </div>

      <div className="split-panels">
        <div>
          <h3 className="section-title">Events per day</h3>
          <div className="bar-chart">
            {data.eventsByDay.map((d) => (
              <div key={d.day} className="bar-row">
                <span>{d.day}</span>
                <div className="bar-track">
                  <div
                    className="bar-fill"
                    style={{ width: `${(d.count / maxDay) * 100}%` }}
                  />
                </div>
                <span>{d.count}</span>
              </div>
            ))}
          </div>
        </div>
        <div>
          <h3 className="section-title">Top events</h3>
          <div className="bar-chart">
            {data.eventsByName.map((d) => (
              <div key={d.eventName} className="bar-row">
                <span title={d.eventName}>{d.eventName}</span>
                <div className="bar-track">
                  <div
                    className="bar-fill"
                    style={{ width: `${(d.count / maxName) * 100}%` }}
                  />
                </div>
                <span>{d.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
