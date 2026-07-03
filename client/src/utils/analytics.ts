import { apiBaseUrl } from './apiBase';

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

/** Auth diagnostics run before cookie consent — needed for iOS login debugging. */
const CONSENT_EXEMPT_EVENTS = new Set([
  'google_login_click',
  'google_login_failed',
  'auth_session_probe',
  'auth_session_lost',
]);

let enabled = false;
let queue: AnalyticsEventPayload[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;

function apiBase(): string {
  return apiBaseUrl();
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
    queue = queue.filter((e) => CONSENT_EXEMPT_EVENTS.has(e.eventName));
    if (flushTimer) {
      clearTimeout(flushTimer);
      flushTimer = null;
    }
    if (queue.length > 0) {
      scheduleFlush();
    }
    return;
  }

  enabled = true;
  if (queue.length > 0) {
    scheduleFlush();
  }
}

function canFlush(): boolean {
  if (enabled) return true;
  return queue.some((e) => CONSENT_EXEMPT_EVENTS.has(e.eventName));
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

function dequeueFlushableBatch(maxSize: number): AnalyticsEventPayload[] {
  const batch: AnalyticsEventPayload[] = [];
  while (batch.length < maxSize && queue.length > 0) {
    const next = queue[0];
    if (!enabled && !CONSENT_EXEMPT_EVENTS.has(next.eventName)) {
      break;
    }
    batch.push(queue.shift()!);
  }
  return batch;
}

function flushRemainderWithKeepalive(): void {
  if (!canFlush()) return;
  const url = `${apiBase()}${API_PATH}`;
  while (queue.length > 0) {
    const batch = dequeueFlushableBatch(BATCH_SIZE);
    if (batch.length === 0) break;
    const body = buildBody(batch);
    void fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
    }).catch(() => {
      queue.unshift(...batch);
    });
  }
}

function flushQueueWithBeacon(maxBatches = MAX_BEACON_BATCHES): void {
  if (!canFlush() || queue.length === 0) return;
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
  if (!canFlush() || queue.length === 0) return;
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
  const exempt = CONSENT_EXEMPT_EVENTS.has(eventName);
  if (!enabled && !exempt) return;

  const payload: AnalyticsEventPayload = {
    eventName,
    category: options.category,
    path: options.path ?? (typeof window !== 'undefined' ? window.location.pathname : undefined),
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
