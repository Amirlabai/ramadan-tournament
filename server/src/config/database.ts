import { prisma } from '../lib/prisma';
import { connectRedis, disconnectRedis, isRedisEnabled } from './redis';

export async function connectDatabase(): Promise<void> {
  await prisma.$connect();
  console.log('PostgreSQL connected');

  if (process.env.REDIS_URL) {
    await connectRedis();
    if (isRedisEnabled()) {
      console.log('Redis connected');
    } else {
      console.warn('Redis unavailable — using in-memory cache');
    }
  } else if (process.env.NODE_ENV === 'production') {
    throw new Error('REDIS_URL is required in production');
  } else {
    console.warn('REDIS_URL not set — cache disabled in development');
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
