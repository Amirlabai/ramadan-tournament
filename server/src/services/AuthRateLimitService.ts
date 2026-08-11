import { disableRedis, incrWithExpireOnCreate } from '../config/redis';
import {
  createAttemptMemoryStore,
  isRedisDegraded,
  useMemoryCache,
} from './memoryCache';

const PREFIX = 'rt:auth:verify:';
const memory = createAttemptMemoryStore();

/** Fail closed when Redis is degraded and this process has no seed for the key. */
const FAIL_CLOSED_COUNT = Number.MAX_SAFE_INTEGER;

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
    if (useMemoryCache()) {
      if (isRedisDegraded()) {
        if (memory.hasEntry(key)) return memory.record(key, ttlSec);
        memory.setCount(key, FAIL_CLOSED_COUNT, ttlSec);
        return FAIL_CLOSED_COUNT;
      }
      return memory.record(key, ttlSec);
    }
    try {
      const count = await incrWithExpireOnCreate(key, ttlSec);
      memory.setCount(key, count, ttlSec);
      return count;
    } catch (err) {
      disableRedis(err);
      if (memory.hasEntry(key)) {
        return memory.record(key, ttlSec);
      }
      memory.setCount(key, FAIL_CLOSED_COUNT, ttlSec);
      return FAIL_CLOSED_COUNT;
    }
  }
}
