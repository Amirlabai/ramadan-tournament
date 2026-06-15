import { disableRedis, getRedis, isRedisEnabled } from '../config/redis';

const PREFIX = 'rt:';

type MemoryEntry = { value: string; expiresAt: number };
const memoryCache = new Map<string, MemoryEntry>();

function useMemory(): boolean {
  return !isRedisEnabled();
}

function memoryGet<T>(key: string): T | null {
  const entry = memoryCache.get(key);
  if (!entry || entry.expiresAt < Date.now()) {
    memoryCache.delete(key);
    return null;
  }
  return JSON.parse(entry.value) as T;
}

function memorySet(key: string, value: unknown, ttlSeconds?: number): void {
  memoryCache.set(key, {
    value: JSON.stringify(value),
    expiresAt: ttlSeconds ? Date.now() + ttlSeconds * 1000 : Number.MAX_SAFE_INTEGER,
  });
}

export class CacheService {
  static key(...parts: string[]): string {
    return `${PREFIX}${parts.join(':')}`;
  }

  static async get<T>(key: string): Promise<T | null> {
    try {
      if (useMemory()) {
        return memoryGet<T>(key);
      }
      const raw = await getRedis().get(key);
      if (!raw) return null;
      return JSON.parse(raw) as T;
    } catch (err) {
      disableRedis(err);
      return memoryGet<T>(key);
    }
  }

  static async set(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
    try {
      if (useMemory()) {
        memorySet(key, value, ttlSeconds);
        return;
      }
      const payload = JSON.stringify(value);
      if (ttlSeconds) {
        await getRedis().setex(key, ttlSeconds, payload);
      } else {
        await getRedis().set(key, payload);
      }
    } catch (err) {
      disableRedis(err);
      memorySet(key, value, ttlSeconds);
    }
  }

  static async del(...keys: string[]): Promise<void> {
    if (!keys.length) return;
    try {
      if (useMemory()) {
        keys.forEach((k) => memoryCache.delete(k));
        return;
      }
      await getRedis().del(...keys);
    } catch (err) {
      disableRedis(err);
      keys.forEach((k) => memoryCache.delete(k));
    }
  }

  static async invalidatePattern(pattern: string): Promise<void> {
    try {
      if (useMemory()) {
        const prefix = pattern.replace('*', '');
        for (const k of memoryCache.keys()) {
          if (k.startsWith(prefix)) memoryCache.delete(k);
        }
        return;
      }
      const keys = await getRedis().keys(pattern);
      if (keys.length) await getRedis().del(...keys);
    } catch (err) {
      disableRedis(err);
    }
  }

  static async getOrSet<T>(
    key: string,
    ttlSeconds: number | undefined,
    builder: () => Promise<T>
  ): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) return cached;
    const fresh = await builder();
    await this.set(key, fresh, ttlSeconds);
    return fresh;
  }
}
