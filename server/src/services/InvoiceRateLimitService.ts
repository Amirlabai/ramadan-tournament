import { getRedis } from '../config/redis';
import { config } from '../config/env';

export const MAX_INVOICE_ATTEMPTS = 3;
const PREFIX = 'rt:invoice:attempts:';

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

const memoryAttempts = new Map<string, { count: number; expiresAt: number }>();

export class InvoiceRateLimitService {
  static key(userId: string, seasonId: string): string {
    return `${PREFIX}${userId}:${seasonId}`;
  }

  static async isLocked(userId: string, seasonId: string): Promise<boolean> {
    const count = await this.getAttemptCount(userId, seasonId);
    return count >= MAX_INVOICE_ATTEMPTS;
  }

  static async getAttemptCount(userId: string, seasonId: string): Promise<number> {
    const key = this.key(userId, seasonId);
    if (!config.redisUrl) {
      const entry = memoryAttempts.get(key);
      if (!entry || entry.expiresAt < Date.now()) return 0;
      return entry.count;
    }
    const raw = await getRedis().get(key);
    return raw ? parseInt(raw, 10) : 0;
  }

  static async recordFailedAttempt(userId: string, seasonId: string): Promise<number> {
    const key = this.key(userId, seasonId);
    const ttl = secondsUntilJerusalemMidnight();

    if (!config.redisUrl) {
      const entry = memoryAttempts.get(key);
      const count = (entry && entry.expiresAt > Date.now() ? entry.count : 0) + 1;
      memoryAttempts.set(key, { count, expiresAt: Date.now() + ttl * 1000 });
      return count;
    }

    const count = await getRedis().incr(key);
    if (count === 1) {
      await getRedis().expire(key, ttl);
    }
    return count;
  }

  static async clearAttempts(userId: string, seasonId: string): Promise<void> {
    const key = this.key(userId, seasonId);
    if (!config.redisUrl) {
      memoryAttempts.delete(key);
      return;
    }
    await getRedis().del(key);
  }

  /** Wipe all invoice attempt counters (e.g. after db:fresh). */
  static async clearAllAttempts(): Promise<void> {
    if (!config.redisUrl) {
      memoryAttempts.clear();
      return;
    }
    const redis = getRedis();
    let cursor = '0';
    do {
      const [next, keys] = await redis.scan(cursor, 'MATCH', `${PREFIX}*`, 'COUNT', 200);
      cursor = next;
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    } while (cursor !== '0');
  }
}
