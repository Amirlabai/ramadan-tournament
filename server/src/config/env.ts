import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: process.env.PORT || 5000,
  databaseUrl: process.env.DATABASE_URL || '',
  redisUrl: process.env.REDIS_URL || '',
  jwtSecret: process.env.JWT_SECRET || '',
  adminUsername: process.env.ADMIN_USERNAME || 'admin',
  adminPassword: process.env.ADMIN_PASSWORD || '',
  nodeEnv: process.env.NODE_ENV || 'development',
  email: {
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    admin: process.env.ADMIN_EMAIL || '',
  },
};

if (!config.databaseUrl) {
  throw new Error('DATABASE_URL is required');
}

if (!config.jwtSecret) {
  throw new Error('JWT_SECRET is required');
}

if (config.nodeEnv === 'production' && !config.redisUrl) {
  throw new Error('REDIS_URL is required in production');
}
