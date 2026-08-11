import { disableRedis, getRedis, incrWithExpireOnCreate } from '../config/redis';
import {
  createAttemptMemoryStore,
  isRedisDegraded,
  useMemoryCache,
} from './memoryCache';

export const MAX_IDENTITY_ATTEMPTS = 3;

/** @deprecated use MAX_IDENTITY_ATTEMPTS */
export const MAX_INVOICE_ATTEMPTS = MAX_IDENTITY_ATTEMPTS;

const PREFIX = 'rt:identity:attempts:';
const memory = createAttemptMemoryStore();

function secondsUntilJerusalemMidnight(): number {
  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Jerusalem',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hour12: false,
  }).formatToParts(now);
  const h = Number(parts.find((p) => p.type === 'hour')?.value ?? 0);
  const m = Number(parts.find((p) => p.type === 'minute')?.value ?? 0);
  const s = Number(parts.find((p) => p.type === 'second')?.value ?? 0);
  const elapsed = h * 3600 + m * 60 + s;
  return Math.max(60, 86400 - elapsed);
}

export class IdentityRateLimitService {
  static key(userId: string, seasonId: string): string {
    return `${PREFIX}${userId}:${seasonId}`;
  }

  static async isLocked(userId: string, seasonId: string): Promise<boolean> {
    const count = await this.getAttemptCount(userId, seasonId);
    return count >= MAX_IDENTITY_ATTEMPTS;
  }

  static async getAttemptCount(userId: string, seasonId: string): Promise<number> {
    const key = this.key(userId, seasonId);
    const ttl = secondsUntilJerusalemMidnight();

    // Reads never fail-closed: degraded + no seed → 0 (never-attempted stay unlocked).
    if (useMemoryCache()) {
      return memory.getCount(key);
    }
    try {
      const raw = await getRedis().get(key);
      const count = raw ? parseInt(raw, 10) : 0;
      if (count > 0) {
        memory.setCount(key, count, ttl);
      }
      return count;
    } catch (err) {
      disableRedis(err);
      return memory.getCount(key);
    }
  }

  static async recordFailedAttempt(userId: string, seasonId: string): Promise<number> {
    const key = this.key(userId, seasonId);
    const ttl = secondsUntilJerusalemMidnight();

    if (useMemoryCache()) {
      if (isRedisDegraded()) {
        // Cleared or already seeded: continue in memory. No seed: fail closed on write only.
        if (memory.hasEntry(key)) {
          return memory.record(key, ttl);
        }
        memory.setCount(key, MAX_IDENTITY_ATTEMPTS, ttl);
        return MAX_IDENTITY_ATTEMPTS;
      }
      return memory.record(key, ttl);
    }

    try {
      const count = await incrWithExpireOnCreate(key, ttl);
      memory.setCount(key, count, ttl);
      return count;
    } catch (err) {
      disableRedis(err);
      if (memory.hasEntry(key)) {
        return memory.record(key, ttl);
      }
      memory.setCount(key, MAX_IDENTITY_ATTEMPTS, ttl);
      return MAX_IDENTITY_ATTEMPTS;
    }
  }

  static async clearAttempts(userId: string, seasonId: string): Promise<void> {
    const key = this.key(userId, seasonId);
    const ttl = secondsUntilJerusalemMidnight();
    if (useMemoryCache()) {
      memory.markCleared(key, ttl);
      return;
    }
    try {
      await getRedis().del(key);
      memory.markCleared(key, ttl);
    } catch (err) {
      disableRedis(err);
      memory.markCleared(key, ttl);
    }
  }

  /** Wipe all identity attempt counters (e.g. after db:fresh). */
  static async clearAllAttempts(): Promise<void> {
    if (useMemoryCache()) {
      memory.clearAll();
      return;
    }
    try {
      const redis = getRedis();
      let cursor = '0';
      do {
        const [next, keys] = await redis.scan(cursor, 'MATCH', `${PREFIX}*`, 'COUNT', 200);
        cursor = next;
        if (keys.length > 0) {
          await redis.del(...keys);
        }
      } while (cursor !== '0');
      memory.clearAll();
    } catch (err) {
      disableRedis(err);
      memory.clearAll();
    }
  }
}
