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

export type SessionStep = EventLogRow & {
  dwellToNextMs: number | null;
  idleGap: boolean;
};

export type SummaryResult = {
  totalEvents: number;
  uniqueSessions: number;
  eventsByCategory: { category: string; count: number }[];
  eventsByName: { eventName: string; count: number }[];
  eventsByDay: { day: string; count: number }[];
};

export type PerformanceSummary = {
  slowestEdges: {
    from: string;
    to: string;
    dwellMs: DwellStats;
    sessionCount: number;
    transitionCount: number;
  }[];
  slowestNodes: {
    label: string;
    dwellMs: DwellStats;
    sessionCount: number;
  }[];
  funnels: {
    name: string;
    steps: string[];
    transitions: {
      from: string;
      to: string;
      dwellMs: DwellStats;
      sampleCount: number;
    }[];
  }[];
};

export type DateRange = {
  from: string;
  to: string;
};

export type ExplorerFilters = DateRange & {
  categories: string[];
  minEdgeSessions: number;
};
