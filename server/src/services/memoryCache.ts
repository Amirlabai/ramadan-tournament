import { isRedisEnabled } from '../config/redis';
import { config } from '../config/env';

/** True when Redis URL is unset or Redis was disabled after an error. */
export function useMemoryCache(): boolean {
  return !isRedisEnabled();
}

/**
 * REDIS_URL was configured but the client is down/disabled.
 * Intentional off-season (`REDIS_URL` unset) is not degraded.
 */
export function isRedisDegraded(): boolean {
  return Boolean(config.redisUrl) && !isRedisEnabled();
}

type AttemptEntry = { count: number; expiresAt: number };

/** Process-local attempt counters with TTL (identity / auth rate limits). */
export function createAttemptMemoryStore() {
  const map = new Map<string, AttemptEntry>();

  function liveEntry(key: string): AttemptEntry | undefined {
    const entry = map.get(key);
    if (!entry || entry.expiresAt < Date.now()) {
      if (entry) map.delete(key);
      return undefined;
    }
    return entry;
  }

  return {
    /** True when this process has an explicit entry (including cleared count 0). */
    hasEntry(key: string): boolean {
      return liveEntry(key) != null;
    },

    getCount(key: string): number {
      const entry = liveEntry(key);
      if (!entry) return 0;
      return entry.count;
    },

    setCount(key: string, count: number, ttlSec: number): void {
      map.set(key, { count, expiresAt: Date.now() + ttlSec * 1000 });
    },

    /** Explicit clear (count 0); `hasEntry` stays true so degraded writes do not fail-close. */
    markCleared(key: string, ttlSec: number): void {
      this.setCount(key, 0, ttlSec);
    },

    record(key: string, ttlSec: number): number {
      const count = this.getCount(key) + 1;
      this.setCount(key, count, ttlSec);
      return count;
    },

    clearAll(): void {
      map.clear();
    },
  };
}
