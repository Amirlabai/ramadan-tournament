export type AnalyticsCategory =
  | 'auth'
  | 'registration'
  | 'browse'
  | 'player_zone'
  | 'interaction';

export type AnalyticsEventPayload = {
  eventName: string;
  category: AnalyticsCategory;
  path?: string;
  properties?: Record<string, string | number | boolean>;
};

const SESSION_KEY = 'rt-analytics-session';
const API_PATH = '/api/analytics/events';
const BATCH_SIZE = 25;
/** Beacon drain cap: 10 batches × 25 events = 250 events per pagehide; remainder uses fetch+keepalive. */
const MAX_BEACON_BATCHES = 10;

let enabled = false;
let queue: AnalyticsEventPayload[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;

function apiBase(): string {
  if (import.meta.env.DEV) return '';
  return import.meta.env.VITE_API_URL ?? '';
}

export function getSessionId(): string {
  let id = sessionStorage.getItem(SESSION_KEY);
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

export function setAnalyticsEnabled(next: boolean): void {
  if (!next) {
    enabled = false;
    queue = [];
    if (flushTimer) {
      clearTimeout(flushTimer);
      flushTimer = null;
    }
    return;
  }

  enabled = true;
  if (queue.length > 0) {
    scheduleFlush();
  }
}

function scheduleFlush(): void {
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    void flushAnalytics();
  }, 1000);
}

function buildBody(events: AnalyticsEventPayload[]) {
  return JSON.stringify({
    sessionId: getSessionId(),
    events,
  });
}

async function postEvents(events: AnalyticsEventPayload[]): Promise<void> {
  if (events.length === 0) return;
  const body = buildBody(events);
  const url = `${apiBase()}${API_PATH}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
    keepalive: true,
  });

  if (!res.ok) {
    throw new Error(String(res.status));
  }
}

function flushRemainderWithKeepalive(): void {
  const url = `${apiBase()}${API_PATH}`;
  while (queue.length > 0) {
    const batch = queue.splice(0, BATCH_SIZE);
    const body = buildBody(batch);
    void fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
    }).catch(() => {
      // best-effort on unload
    });
  }
}

function flushQueueWithBeacon(maxBatches = MAX_BEACON_BATCHES): void {
  if (!enabled || queue.length === 0) return;
  const url = `${apiBase()}${API_PATH}`;

  let batches = 0;
  while (queue.length > 0 && batches < maxBatches) {
    const batch = queue.splice(0, BATCH_SIZE);
    const body = buildBody(batch);

    if (!navigator.sendBeacon) {
      queue.unshift(...batch);
      break;
    }

    const ok = navigator.sendBeacon(url, new Blob([body], { type: 'application/json' }));
    if (!ok) {
      queue.unshift(...batch);
      break;
    }

    batches += 1;
  }

  flushRemainderWithKeepalive();
}

export async function flushAnalytics(): Promise<void> {
  if (!enabled || queue.length === 0) return;
  const batch = queue.splice(0, BATCH_SIZE);
  try {
    await postEvents(batch);
  } catch {
    queue.unshift(...batch);
  }
}

export function trackEvent(
  eventName: string,
  options: {
    category: AnalyticsCategory;
    path?: string;
    properties?: Record<string, string | number | boolean>;
  }
): void {
  if (!enabled) return;

  const payload: AnalyticsEventPayload = {
    eventName,
    category: options.category,
    path: options.path ?? window.location.pathname,
    properties: options.properties,
  };

  queue.push(payload);
  if (queue.length >= 10) {
    void flushAnalytics();
    return;
  }
  scheduleFlush();
}

if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', () => {
    flushQueueWithBeacon();
  });
}
