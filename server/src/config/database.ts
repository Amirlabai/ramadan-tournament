import { prisma } from '../lib/prisma';
import { config } from './env';
import { connectRedis, disconnectRedis, isRedisEnabled } from './redis';

export async function connectDatabase(): Promise<void> {
  await prisma.$connect();
  console.log('PostgreSQL connected');

  if (config.redisUrl) {
    await connectRedis();
    if (isRedisEnabled()) {
      console.log('Redis connected');
    } else {
      console.warn('Redis unavailable — using in-memory cache');
    }
  } else {
    console.warn(
      'REDIS_URL not set — using in-memory cache and rate-limit counters (process-local)'
    );
  }
}

export async function disconnectDatabase(): Promise<void> {
  await disconnectRedis();
  await prisma.$disconnect();
  console.log('Database connections closed');
}

process.on('SIGINT', async () => {
  await disconnectDatabase();
  process.exit(0);
});
