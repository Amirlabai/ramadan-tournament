import { useCallback, useState } from 'react';
import FilterBar from './components/FilterBar';
import SummaryView from './components/SummaryView';
import ProcessMapView from './components/ProcessMapView';
import EventLogView from './components/EventLogView';
import VariantsView from './components/VariantsView';
import SessionInspector from './components/SessionInspector';
import PerformanceView from './components/PerformanceView';
import type { ExplorerFilters } from './types';
import { defaultDateRange } from './utils/format';

type Tab =
  | 'summary'
  | 'process-map'
  | 'variants'
  | 'event-log'
  | 'session'
  | 'performance';

const TABS: { id: Tab; label: string }[] = [
  { id: 'process-map', label: 'Process Map' },
  { id: 'summary', label: 'Summary' },
  { id: 'variants', label: 'Variants' },
  { id: 'event-log', label: 'Event Log' },
  { id: 'session', label: 'Session' },
  { id: 'performance', label: 'Performance' },
];

export default function App() {
  const [tab, setTab] = useState<Tab>('process-map');
  const [refreshKey, setRefreshKey] = useState(0);
  const [activityFilter, setActivityFilter] = useState<string | undefined>();
  const [selectedSession, setSelectedSession] = useState<string | undefined>();
  const [filters, setFilters] = useState<ExplorerFilters>(() => {
    const range = defaultDateRange();
    return {
      ...range,
      categories: [],
      minEdgeSessions: 1,
    };
  });

  const onRefresh = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  const onNodeClick = useCallback((label: string) => {
    setActivityFilter(label);
    setTab('event-log');
  }, []);

  const onSelectSession = useCallback((sessionId: string) => {
    setSelectedSession(sessionId);
    setTab('session');
  }, []);

  return (
    <>
      <header className="app-header">
        <h1>Analytics Explorer</h1>
        <span style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>
          Local process-mining dev tool · analytics_events
        </span>
      </header>

      <FilterBar filters={filters} onChange={setFilters} onRefresh={onRefresh} />

      <nav className="tabs" aria-label="Views">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`tab ${tab === t.id ? 'active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <main className="panel">
        {tab === 'summary' && <SummaryView filters={filters} refreshKey={refreshKey} />}
        {tab === 'process-map' && (
          <ProcessMapView
            filters={filters}
            refreshKey={refreshKey}
            onNodeClick={onNodeClick}
          />
        )}
        {tab === 'variants' && <VariantsView filters={filters} refreshKey={refreshKey} />}
        {tab === 'event-log' && (
          <EventLogView
            filters={filters}
            refreshKey={refreshKey}
            activityFilter={activityFilter}
            onSelectSession={onSelectSession}
          />
        )}
        {tab === 'session' && (
          <SessionInspector
            filters={filters}
            refreshKey={refreshKey}
            sessionId={selectedSession}
          />
        )}
        {tab === 'performance' && (
          <PerformanceView filters={filters} refreshKey={refreshKey} />
        )}
      </main>
    </>
  );
}
