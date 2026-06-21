import { getRedis } from '../config/redis';
import { config } from '../config/env';

const PREFIX = 'rt:auth:verify:';
const memoryAttempts = new Map<string, { count: number; expiresAt: number }>();

export class AuthRateLimitService {
  /** Increment only on failed verify; returns false when over limit. */
  static async recordFailedVerifyEmail(
    email: string,
    maxAttempts = 5,
    windowSec = 15 * 60,
  ): Promise<boolean> {
    const key = `${PREFIX}${email.toLowerCase().trim()}`;
    const count = await this.increment(key, windowSec);
    return count <= maxAttempts;
  }

  private static async increment(key: string, ttlSec: number): Promise<number> {
    if (!config.redisUrl) {
      const now = Date.now();
      const entry = memoryAttempts.get(key);
      const count = (entry && entry.expiresAt > now ? entry.count : 0) + 1;
      memoryAttempts.set(key, { count, expiresAt: now + ttlSec * 1000 });
      return count;
    }
    const count = await getRedis().incr(key);
    if (count === 1) {
      await getRedis().expire(key, ttlSec);
    }
    return count;
  }
}
