import { config } from '../config/env';

const FD_BASE = 'https://api.football-data.org/v4';

/** Free tier ≈10 req/min — serialize calls to stay under limit. */
const FD_MIN_INTERVAL_MS = 6500;
const FD_MAX_ATTEMPTS = 3;

let lastRequestAt = 0;
let queue: Promise<void> = Promise.resolve();
const inFlight = new Map<string, Promise<unknown>>();

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseRetrySeconds(body: string): number {
  const match = body.match(/Wait (\d+) seconds?/i);
  return match ? Number.parseInt(match[1], 10) : 30;
}

function enqueue<T>(task: () => Promise<T>): Promise<T> {
  const run = queue.then(task, task);
  queue = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

async function fetchFdOnce<T>(endpoint: string, attempt: number): Promise<T> {
  const apiKey = config.footballDataApiKey;
  if (!apiKey) {
    throw new Error('FOOTBALL_DATA_API_KEY not set');
  }

  const now = Date.now();
  const spacing = Math.max(0, FD_MIN_INTERVAL_MS - (now - lastRequestAt));
  if (spacing > 0) {
    await sleep(spacing);
  }
  lastRequestAt = Date.now();

  const res = await fetch(`${FD_BASE}${endpoint}`, {
    headers: { 'X-Auth-Token': apiKey },
  });

  if (res.status === 429 && attempt < FD_MAX_ATTEMPTS) {
    const body = await res.text().catch(() => '');
    const waitSec = parseRetrySeconds(body);
    await sleep((waitSec + 1) * 1000);
    return fetchFdOnce<T>(endpoint, attempt + 1);
  }

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`football-data.org ${res.status}: ${body.slice(0, 200)}`);
  }

  return res.json() as Promise<T>;
}

export async function fetchFootballData<T>(endpoint: string): Promise<T> {
  const existing = inFlight.get(endpoint);
  if (existing) {
    return existing as Promise<T>;
  }

  const promise = enqueue(() => fetchFdOnce<T>(endpoint, 0)).finally(() => {
    inFlight.delete(endpoint);
  });

  inFlight.set(endpoint, promise);
  return promise;
}
