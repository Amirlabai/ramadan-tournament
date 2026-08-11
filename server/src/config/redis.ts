import Redis from 'ioredis';
import { config } from './env';

let redis: Redis | null = null;
let redisDisabled = false;

export function isRedisEnabled(): boolean {
  return Boolean(config.redisUrl) && !redisDisabled;
}

export function disableRedis(reason?: unknown): void {
  if (redisDisabled) return;
  redisDisabled = true;
  const detail =
    reason instanceof Error ? reason.message : reason != null ? String(reason) : 'unavailable';
  console.warn(`Redis disabled — using in-memory cache (${detail})`);
  if (redis) {
    redis.removeAllListeners();
    redis.disconnect();
    redis = null;
  }
}

function createRedisClient(): Redis {
  const client = new Redis(config.redisUrl, {
    maxRetriesPerRequest: 1,
    lazyConnect: true,
    enableOfflineQueue: false,
    connectTimeout: 5000,
    retryStrategy: () => null,
  });
  client.on('error', (err) => disableRedis(err));
  return client;
}

export function getRedis(): Redis {
  if (!isRedisEnabled()) {
    throw new Error('Redis is not available');
  }
  if (!redis) {
    redis = createRedisClient();
  }
  return redis;
}

export async function connectRedis(): Promise<void> {
  if (!config.redisUrl) return;
  try {
    const client = getRedis();
    if (client.status === 'ready') return;
    await client.connect();
    await client.ping();
  } catch (err) {
    disableRedis(err);
  }
}

export async function pingRedis(): Promise<boolean> {
  if (!isRedisEnabled()) return false;
  try {
    const pong = await getRedis().ping();
    return pong === 'PONG';
  } catch (err) {
    disableRedis(err);
    return false;
  }
}

export async function disconnectRedis(): Promise<void> {
  if (redis) {
    await redis.quit().catch(() => redis?.disconnect());
    redis = null;
  }
}

/**
 * Atomic INCR; EXPIRE only when the new count is 1 (fixed window, no orphan keys).
 * Lua: local c = redis.call('INCR', KEYS[1]); if c == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end; return c
 */
const INCR_EXPIRE_ON_CREATE_LUA = `
local c = redis.call('INCR', KEYS[1])
if c == 1 then
  redis.call('EXPIRE', KEYS[1], tonumber(ARGV[1]))
end
return c
`;

export async function incrWithExpireOnCreate(key: string, ttlSec: number): Promise<number> {
  const result = await getRedis().eval(INCR_EXPIRE_ON_CREATE_LUA, 1, key, String(ttlSec));
  return typeof result === 'number' ? result : parseInt(String(result), 10);
}

