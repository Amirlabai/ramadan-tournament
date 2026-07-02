import type {
  ExplorerFilters,
  PerformanceSummary,
  ProcessMap,
  SummaryResult,
  VariantRow,
} from './types';
import { toIsoEndOfDay, toIsoStartOfDay } from './utils/format';

function queryString(filters: ExplorerFilters, extra: Record<string, string | number> = {}): string {
  const params = new URLSearchParams({
    from: toIsoStartOfDay(filters.from),
    to: toIsoEndOfDay(filters.to),
    minEdgeSessions: String(filters.minEdgeSessions),
    ...Object.fromEntries(
      Object.entries(extra).map(([k, v]) => [k, String(v)])
    ),
  });
  if (filters.categories.length > 0) {
    params.set('categories', filters.categories.join(','));
  }
  return params.toString();
}

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(path);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(body || `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export function fetchSummary(filters: ExplorerFilters): Promise<SummaryResult> {
  return getJson(`/api/summary?${queryString(filters)}`);
}

export function fetchProcessMap(filters: ExplorerFilters): Promise<ProcessMap> {
  return getJson(`/api/process-map?${queryString(filters)}`);
}

export function fetchPerformance(filters: ExplorerFilters): Promise<PerformanceSummary> {
  return getJson(`/api/performance?${queryString(filters)}`);
}

export function fetchVariants(filters: ExplorerFilters, limit = 30): Promise<{ variants: VariantRow[] }> {
  return getJson(`/api/variants?${queryString(filters, { limit })}`);
}

export function fetchEvents(
  filters: ExplorerFilters,
  page: number,
  opts: { eventName?: string; sessionId?: string; activityLabel?: string } = {}
): Promise<{ rows: import('./types').EventLogRow[]; total: number; page: number; pageSize: number }> {
  const params = queryString(filters, { page, pageSize: 50 });
  const extra = new URLSearchParams(params);
  if (opts.eventName) extra.set('eventName', opts.eventName);
  if (opts.sessionId) extra.set('sessionId', opts.sessionId);
  if (opts.activityLabel) extra.set('activityLabel', opts.activityLabel);
  return getJson(`/api/events?${extra.toString()}`);
}

export function fetchSession(sessionId: string, filters: ExplorerFilters) {
  return getJson<{
    sessionId: string;
    steps: import('./types').SessionStep[];
    totalSpanMs: number | null;
  }>(`/api/sessions/${encodeURIComponent(sessionId)}?${queryString(filters)}`);
}

export function exportCsvUrl(filters: ExplorerFilters): string {
  return `/api/export.csv?${queryString(filters)}`;
}
