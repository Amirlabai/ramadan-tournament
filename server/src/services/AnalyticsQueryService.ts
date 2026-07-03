import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { sanitizeAnalyticsProperties } from './AnalyticsService';

export const DEFAULT_IDLE_CAP_MS = 30 * 60 * 1000;

export type AnalyticsEventRow = {
  id: string;
  createdAt: Date;
  eventName: string;
  category: string;
  source: string;
  sessionId: string | null;
  path: string | null;
  properties: Record<string, unknown> | null;
};

export type TraceStep = {
  label: string;
  createdAt: Date;
  eventName: string;
  category: string;
  source: string;
  path: string | null;
};

export type Trace = {
  sessionId: string;
  steps: TraceStep[];
};

export type DwellStats = {
  median: number;
  mean: number;
  p75: number;
  min: number;
  max: number;
  sampleCount: number;
  idleCount: number;
};

export type ProcessMapNode = {
  id: string;
  label: string;
  sessionCount: number;
  eventCount: number;
  dwellMs: DwellStats;
};

export type ProcessMapEdge = {
  from: string;
  to: string;
  sessionCount: number;
  transitionCount: number;
  dwellMs: DwellStats;
};

export type ProcessMap = {
  nodes: ProcessMapNode[];
  edges: ProcessMapEdge[];
};

export type VariantRow = {
  sequence: string[];
  sessionCount: number;
  medianDurationMs: number;
};

export type PerformanceEdgeRow = {
  from: string;
  to: string;
  dwellMs: DwellStats;
  sessionCount: number;
  transitionCount: number;
};

export type PerformanceNodeRow = {
  label: string;
  dwellMs: DwellStats;
  sessionCount: number;
};

export type FunnelStepTiming = {
  from: string;
  to: string;
  dwellMs: DwellStats;
  sampleCount: number;
};

export type FunnelTiming = {
  name: string;
  steps: string[];
  transitions: FunnelStepTiming[];
};

export type PerformanceSummary = {
  slowestEdges: PerformanceEdgeRow[];
  slowestNodes: PerformanceNodeRow[];
  funnels: FunnelTiming[];
};

export type EventLogRow = {
  id: string;
  createdAt: string;
  eventName: string;
  category: string;
  source: string;
  sessionId: string | null;
  path: string | null;
  properties: Record<string, unknown> | null;
  activityLabel: string;
};

export type SummaryResult = {
  totalEvents: number;
  uniqueSessions: number;
  eventsByCategory: { category: string; count: number }[];
  eventsByName: { eventName: string; count: number }[];
  eventsByDay: { day: string; count: number }[];
};

export type DateRangeQuery = {
  from: Date;
  to: Date;
  categories?: string[];
  eventNames?: string[];
};

export type ProcessMapQuery = DateRangeQuery & {
  minEdgeSessions?: number;
  idleCapMs?: number;
};

const FUNNEL_PRESETS: { name: string; steps: string[] }[] = [
  {
    name: 'Registration',
    steps: ['identity_form_open', 'identity_submit_click', 'identity_submitted'],
  },
  {
    name: 'Auth',
    steps: ['login_submit', 'login_success'],
  },
  {
    name: 'Player zone login',
    steps: ['player_zone_login_submit', 'player_zone_login_success'],
  },
];

function asProperties(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function activityId(label: string): string {
  return label;
}

function isAdminPath(path: string): boolean {
  return path === '/admin' || path.startsWith('/admin/');
}

export function isAdminAnalyticsEvent(
  row: Pick<AnalyticsEventRow, 'eventName' | 'path' | 'properties'>
): boolean {
  const path = row.path ?? '';
  if (isAdminPath(path)) return true;

  const props = row.properties ?? {};
  const navTo = typeof props.navTo === 'string' ? props.navTo : '';
  if (navTo && isAdminPath(navTo)) return true;

  if (props.surface === 'admin') return true;

  return false;
}

export function excludeAdminTaintedSessions(rows: AnalyticsEventRow[]): AnalyticsEventRow[] {
  const tainted = new Set<string>();
  for (const row of rows) {
    if (row.sessionId && isAdminAnalyticsEvent(row)) {
      tainted.add(row.sessionId);
    }
  }
  return rows.filter((row) => !row.sessionId || !tainted.has(row.sessionId));
}

export function buildActivityLabel(row: Pick<AnalyticsEventRow, 'eventName' | 'path' | 'properties'>): string {
  const props = row.properties ?? {};

  if (row.eventName === 'page_view') {
    return `page: ${row.path || '/'}`;
  }

  if (row.eventName === 'nav_click') {
    const navTo = typeof props.navTo === 'string' ? props.navTo : row.path || '/';
    return `nav: ${navTo}`;
  }

  if (row.eventName === 'team_expand') {
    const teamId = props.teamId;
    if (typeof teamId === 'number' || typeof teamId === 'string') {
      return `team_expand (${teamId})`;
    }
    return 'team_expand';
  }

  return row.eventName;
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  if (p === 50) {
    const mid = Math.floor(sorted.length / 2);
    if (sorted.length % 2 === 0) {
      return Math.round((sorted[mid - 1] + sorted[mid]) / 2);
    }
    return sorted[mid];
  }
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(sorted.length - 1, idx))];
}

export function aggregateDwellStats(
  samples: number[],
  idleCapMs: number = DEFAULT_IDLE_CAP_MS
): DwellStats {
  const active = samples.filter((ms) => ms > 0 && ms <= idleCapMs);
  const idleCount = samples.filter((ms) => ms > idleCapMs).length;

  if (active.length === 0) {
    return {
      median: 0,
      mean: 0,
      p75: 0,
      min: 0,
      max: 0,
      sampleCount: 0,
      idleCount,
    };
  }

  const sorted = [...active].sort((a, b) => a - b);
  const sum = sorted.reduce((acc, n) => acc + n, 0);

  return {
    median: percentile(sorted, 50),
    mean: Math.round(sum / sorted.length),
    p75: percentile(sorted, 75),
    min: sorted[0],
    max: sorted[sorted.length - 1],
    sampleCount: sorted.length,
    idleCount,
  };
}

export function buildTracesFromRows(rows: AnalyticsEventRow[]): Trace[] {
  const bySession = new Map<string, AnalyticsEventRow[]>();

  for (const row of rows) {
    if (!row.sessionId) continue;
    const list = bySession.get(row.sessionId) ?? [];
    list.push(row);
    bySession.set(row.sessionId, list);
  }

  const traces: Trace[] = [];

  for (const [sessionId, sessionRows] of bySession) {
    sessionRows.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    traces.push({
      sessionId,
      steps: sessionRows.map((row) => ({
        label: buildActivityLabel(row),
        createdAt: row.createdAt,
        eventName: row.eventName,
        category: row.category,
        source: row.source,
        path: row.path,
      })),
    });
  }

  return traces;
}

export function buildProcessMap(
  traces: Trace[],
  options?: { minEdgeSessions?: number; idleCapMs?: number }
): ProcessMap {
  const minEdgeSessions = options?.minEdgeSessions ?? 1;
  const idleCapMs = options?.idleCapMs ?? DEFAULT_IDLE_CAP_MS;

  const nodeSessions = new Map<string, Set<string>>();
  const nodeEventCounts = new Map<string, number>();
  const edgeTransitions = new Map<string, number>();
  const edgeSessions = new Map<string, Set<string>>();
  const edgeDwellSamples = new Map<string, number[]>();
  const nodeDwellSamples = new Map<string, number[]>();

  for (const trace of traces) {
    const seenNodes = new Set<string>();

    for (let i = 0; i < trace.steps.length; i += 1) {
      const step = trace.steps[i];
      const nodeId = activityId(step.label);

      nodeEventCounts.set(nodeId, (nodeEventCounts.get(nodeId) ?? 0) + 1);
      if (!seenNodes.has(nodeId)) {
        const sessions = nodeSessions.get(nodeId) ?? new Set<string>();
        sessions.add(trace.sessionId);
        nodeSessions.set(nodeId, sessions);
        seenNodes.add(nodeId);
      }

      if (i < trace.steps.length - 1) {
        const next = trace.steps[i + 1];
        const fromId = activityId(step.label);
        const toId = activityId(next.label);
        const edgeKey = `${fromId}\0${toId}`;
        const dwell = next.createdAt.getTime() - step.createdAt.getTime();

        edgeTransitions.set(edgeKey, (edgeTransitions.get(edgeKey) ?? 0) + 1);

        const sessions = edgeSessions.get(edgeKey) ?? new Set<string>();
        sessions.add(trace.sessionId);
        edgeSessions.set(edgeKey, sessions);

        if (dwell > 0) {
          const edgeSamples = edgeDwellSamples.get(edgeKey) ?? [];
          edgeSamples.push(dwell);
          edgeDwellSamples.set(edgeKey, edgeSamples);

          const nodeSamples = nodeDwellSamples.get(fromId) ?? [];
          nodeSamples.push(dwell);
          nodeDwellSamples.set(fromId, nodeSamples);
        }
      }
    }
  }

  const nodes: ProcessMapNode[] = [...nodeEventCounts.entries()]
    .map(([id, eventCount]) => ({
      id,
      label: id,
      sessionCount: nodeSessions.get(id)?.size ?? 0,
      eventCount,
      dwellMs: aggregateDwellStats(nodeDwellSamples.get(id) ?? [], idleCapMs),
    }))
    .sort((a, b) => b.sessionCount - a.sessionCount);

  const edges: ProcessMapEdge[] = [...edgeTransitions.entries()]
    .map(([key, transitionCount]) => {
      const [from, to] = key.split('\0');
      const sessionCount = edgeSessions.get(key)?.size ?? 0;
      return {
        from,
        to,
        sessionCount,
        transitionCount,
        dwellMs: aggregateDwellStats(edgeDwellSamples.get(key) ?? [], idleCapMs),
      };
    })
    .filter((edge) => edge.sessionCount >= minEdgeSessions)
    .sort((a, b) => b.transitionCount - a.transitionCount);

  return { nodes, edges };
}

export function buildVariants(traces: Trace[], limit = 20): VariantRow[] {
  const variantMap = new Map<string, { sessions: Set<string>; durations: number[] }>();

  for (const trace of traces) {
    if (trace.steps.length === 0) continue;
    const sequence = trace.steps.map((s) => s.label);
    const key = sequence.join('\0');
    const entry = variantMap.get(key) ?? { sessions: new Set<string>(), durations: [] };
    entry.sessions.add(trace.sessionId);

    const duration =
      trace.steps[trace.steps.length - 1].createdAt.getTime() -
      trace.steps[0].createdAt.getTime();
    if (duration >= 0) {
      entry.durations.push(duration);
    }

    variantMap.set(key, entry);
  }

  return [...variantMap.entries()]
    .map(([key, entry]) => ({
      sequence: key.split('\0'),
      sessionCount: entry.sessions.size,
      medianDurationMs: aggregateDwellStats(entry.durations).median,
    }))
    .sort((a, b) => b.sessionCount - a.sessionCount)
    .slice(0, limit);
}

export function buildPerformanceSummary(
  traces: Trace[],
  idleCapMs: number = DEFAULT_IDLE_CAP_MS
): PerformanceSummary {
  const processMap = buildProcessMap(traces, { idleCapMs });

  const slowestEdges: PerformanceEdgeRow[] = processMap.edges
    .filter((e) => e.dwellMs.sampleCount > 0)
    .map((e) => ({
      from: e.from,
      to: e.to,
      dwellMs: e.dwellMs,
      sessionCount: e.sessionCount,
      transitionCount: e.transitionCount,
    }))
    .sort((a, b) => b.dwellMs.median - a.dwellMs.median)
    .slice(0, 20);

  const slowestNodes: PerformanceNodeRow[] = processMap.nodes
    .filter((n) => n.dwellMs.sampleCount > 0)
    .map((n) => ({
      label: n.label,
      dwellMs: n.dwellMs,
      sessionCount: n.sessionCount,
    }))
    .sort((a, b) => b.dwellMs.median - a.dwellMs.median)
    .slice(0, 20);

  const funnels: FunnelTiming[] = FUNNEL_PRESETS.map((preset) => {
    const transitionSamples = new Map<string, number[]>();

    for (let s = 0; s < preset.steps.length - 1; s += 1) {
      transitionSamples.set(`${preset.steps[s]}\0${preset.steps[s + 1]}`, []);
    }

    for (const trace of traces) {
      let stepIdx = 0;
      for (let i = 0; i < trace.steps.length && stepIdx < preset.steps.length - 1; i += 1) {
        const current = preset.steps[stepIdx];
        const step = trace.steps[i];
        if (step.label !== current && step.eventName !== current) continue;

        const nextTarget = preset.steps[stepIdx + 1];
        for (let j = i + 1; j < trace.steps.length; j += 1) {
          const next = trace.steps[j];
          if (next.label === nextTarget || next.eventName === nextTarget) {
            const key = `${current}\0${nextTarget}`;
            const dwell = next.createdAt.getTime() - step.createdAt.getTime();
            if (dwell > 0) {
              transitionSamples.get(key)?.push(dwell);
            }
            stepIdx += 1;
            i = j - 1;
            break;
          }
        }
      }
    }

    const transitions: FunnelStepTiming[] = [];
    for (let s = 0; s < preset.steps.length - 1; s += 1) {
      const from = preset.steps[s];
      const to = preset.steps[s + 1];
      const key = `${from}\0${to}`;
      const samples = transitionSamples.get(key) ?? [];
      const dwellMs = aggregateDwellStats(samples, idleCapMs);
      transitions.push({
        from,
        to,
        dwellMs,
        sampleCount: dwellMs.sampleCount,
      });
    }

    return { name: preset.name, steps: preset.steps, transitions };
  });

  return { slowestEdges, slowestNodes, funnels };
}

function buildWhereClause(query: DateRangeQuery): Prisma.AnalyticsEventWhereInput {
  const where: Prisma.AnalyticsEventWhereInput = {
    createdAt: { gte: query.from, lte: query.to },
  };

  if (query.categories?.length) {
    where.category = { in: query.categories as Prisma.EnumAnalyticsEventCategoryFilter['in'] };
  }

  if (query.eventNames?.length) {
    where.eventName = { in: query.eventNames };
  }

  return where;
}

function toEventLogRow(row: {
  id: string;
  createdAt: Date;
  eventName: string;
  category: string;
  source: string;
  sessionId: string | null;
  path: string | null;
  properties: unknown;
}): EventLogRow {
  const props = asProperties(row.properties);
  const sanitized = sanitizeAnalyticsProperties(props ?? undefined);
  const safeProps =
    sanitized && typeof sanitized === 'object' && !Array.isArray(sanitized)
      ? (sanitized as Record<string, unknown>)
      : null;

  return {
    id: row.id,
    createdAt: row.createdAt.toISOString(),
    eventName: row.eventName,
    category: row.category,
    source: row.source,
    sessionId: row.sessionId,
    path: row.path,
    properties: safeProps,
    activityLabel: buildActivityLabel({
      eventName: row.eventName,
      path: row.path,
      properties: safeProps,
    }),
  };
}

export class AnalyticsQueryService {
  static async fetchEventRows(query: DateRangeQuery): Promise<AnalyticsEventRow[]> {
    const rows = await prisma.analyticsEvent.findMany({
      where: buildWhereClause(query),
      orderBy: [{ sessionId: 'asc' }, { createdAt: 'asc' }],
      select: {
        id: true,
        createdAt: true,
        eventName: true,
        category: true,
        source: true,
        sessionId: true,
        path: true,
        properties: true,
      },
    });

    const mapped = rows.map((row) => ({
      ...row,
      category: String(row.category),
      source: String(row.source),
      properties: asProperties(row.properties),
    }));

    return excludeAdminTaintedSessions(mapped);
  }

  static async fetchTraces(query: DateRangeQuery): Promise<Trace[]> {
    const rows = await this.fetchEventRows(query);
    return buildTracesFromRows(rows);
  }

  static async getProcessMap(query: ProcessMapQuery): Promise<ProcessMap> {
    const traces = await this.fetchTraces(query);
    return buildProcessMap(traces, {
      minEdgeSessions: query.minEdgeSessions,
      idleCapMs: query.idleCapMs,
    });
  }

  static async getVariants(query: DateRangeQuery, limit = 20): Promise<VariantRow[]> {
    const traces = await this.fetchTraces(query);
    return buildVariants(traces, limit);
  }

  static async getPerformanceSummary(
    query: DateRangeQuery & { idleCapMs?: number }
  ): Promise<PerformanceSummary> {
    const traces = await this.fetchTraces(query);
    return buildPerformanceSummary(traces, query.idleCapMs);
  }

  static async queryEventLog(
    query: DateRangeQuery & {
      page?: number;
      pageSize?: number;
      eventName?: string;
      pathPrefix?: string;
      sessionId?: string;
      activityLabel?: string;
    }
  ): Promise<{ rows: EventLogRow[]; total: number; page: number; pageSize: number }> {
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(200, Math.max(1, query.pageSize ?? 50));

    let candidates = await this.fetchEventRows(query);

    if (query.eventName) {
      const needle = query.eventName.toLowerCase();
      candidates = candidates.filter((row) => row.eventName.toLowerCase().includes(needle));
    }

    if (query.pathPrefix) {
      candidates = candidates.filter((row) => (row.path ?? '').startsWith(query.pathPrefix!));
    }

    if (query.sessionId) {
      candidates = candidates.filter((row) => row.sessionId === query.sessionId);
    }

    let eventRows = candidates.map((row) =>
      toEventLogRow({
        ...row,
        properties: row.properties,
      })
    );

    if (query.activityLabel) {
      const needle = query.activityLabel.toLowerCase();
      eventRows = eventRows.filter((r) => r.activityLabel.toLowerCase().includes(needle));
    }

    eventRows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    const total = eventRows.length;
    const start = (page - 1) * pageSize;
    const rows = eventRows.slice(start, start + pageSize);

    return { rows, total, page, pageSize };
  }

  static async getSessionTrace(
    sessionId: string,
    query: DateRangeQuery & { idleCapMs?: number }
  ): Promise<{
    sessionId: string;
    steps: (EventLogRow & { dwellToNextMs: number | null; idleGap: boolean })[];
    totalSpanMs: number | null;
  } | null> {
    const idleCapMs = query.idleCapMs ?? DEFAULT_IDLE_CAP_MS;
    const sessionRows = (await this.fetchEventRows(query)).filter(
      (row) => row.sessionId === sessionId
    );

    if (sessionRows.length === 0) return null;

    const steps = sessionRows.map((row, i) => {
      const logRow = toEventLogRow({
        ...row,
        properties: row.properties,
      });
      let dwellToNextMs: number | null = null;
      let idleGap = false;

      if (i < sessionRows.length - 1) {
        const dwell = sessionRows[i + 1].createdAt.getTime() - row.createdAt.getTime();
        if (dwell > 0) {
          dwellToNextMs = dwell;
          idleGap = dwell > idleCapMs;
        }
      }

      return { ...logRow, dwellToNextMs, idleGap };
    });

    const totalSpanMs =
      sessionRows.length > 1
        ? sessionRows[sessionRows.length - 1].createdAt.getTime() -
          sessionRows[0].createdAt.getTime()
        : 0;

    return { sessionId, steps, totalSpanMs };
  }

  static async buildSummary(query: DateRangeQuery): Promise<SummaryResult> {
    const rows = await this.fetchEventRows(query);

    const sessionIds = new Set<string>();
    const categoryCounts = new Map<string, number>();
    const nameCounts = new Map<string, number>();
    const dayCounts = new Map<string, number>();

    for (const row of rows) {
      if (row.sessionId) sessionIds.add(row.sessionId);
      categoryCounts.set(row.category, (categoryCounts.get(row.category) ?? 0) + 1);
      nameCounts.set(row.eventName, (nameCounts.get(row.eventName) ?? 0) + 1);
      const day = row.createdAt.toISOString().slice(0, 10);
      dayCounts.set(day, (dayCounts.get(day) ?? 0) + 1);
    }

    return {
      totalEvents: rows.length,
      uniqueSessions: sessionIds.size,
      eventsByCategory: [...categoryCounts.entries()]
        .map(([category, count]) => ({ category, count }))
        .sort((a, b) => b.count - a.count),
      eventsByName: [...nameCounts.entries()]
        .map(([eventName, count]) => ({ eventName, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 20),
      eventsByDay: [...dayCounts.entries()]
        .map(([day, count]) => ({ day, count }))
        .sort((a, b) => a.day.localeCompare(b.day)),
    };
  }

  static async exportCsv(query: DateRangeQuery): Promise<string> {
    const rows = await this.fetchEventRows(query);

    const header =
      'id,created_at,event_name,category,source,session_id,path,activity_label,properties';
    const lines = rows.map((row) => {
      const logRow = toEventLogRow({
        ...row,
        properties: row.properties,
      });
      const props = logRow.properties ? JSON.stringify(logRow.properties) : '';
      const escaped = (v: string) => `"${v.replace(/"/g, '""')}"`;
      return [
        logRow.id,
        logRow.createdAt,
        logRow.eventName,
        logRow.category,
        logRow.source,
        logRow.sessionId ?? '',
        logRow.path ?? '',
        logRow.activityLabel,
        props,
      ]
        .map((v) => escaped(String(v)))
        .join(',');
    });

    return [header, ...lines].join('\n');
  }
}
