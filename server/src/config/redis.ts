import Redis from 'ioredis';
import { config } from './env';

let redis: Redis | null = null;

export function getRedis(): Redis {
  if (!redis) {
    if (!config.redisUrl) {
      throw new Error('REDIS_URL is required');
    }
    redis = new Redis(config.redisUrl, {
      maxRetriesPerRequest: 3,
      lazyConnect: true,
    });
  }
  return redis;
}

export async function connectRedis(): Promise<void> {
  const client = getRedis();
  if (client.status === 'ready') return;
  await client.connect();
}

export async function pingRedis(): Promise<boolean> {
  try {
    const pong = await getRedis().ping();
    return pong === 'PONG';
  } catch {
    return false;
  }
}

export async function disconnectRedis(): Promise<void> {
  if (redis) {
    await redis.quit();
    redis = null;
  }
}
