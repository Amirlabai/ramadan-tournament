import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

const parentEnv = path.join(process.cwd(), '..', '.env');
if (fs.existsSync(parentEnv)) {
  dotenv.config({ path: parentEnv });
}
dotenv.config();
if (process.env.npm_lifecycle_event === 'dev:mock') {
  const mockEnv = path.join(process.cwd(), 'env.mock');
  if (fs.existsSync(mockEnv)) {
    dotenv.config({ path: mockEnv, override: true });
  } else {
    process.env.MOCK_DEV_DATA = '1';
  }
}

const mockDevData =
  process.env.MOCK_DEV_DATA === '1' || process.env.MOCK_DEV_DATA === 'true';

if (mockDevData && !process.env.JWT_SECRET) {
  process.env.JWT_SECRET = 'mock-dev-jwt-secret-change-me';
}

export const config = {
  port: process.env.PORT || 5000,
  databaseUrl: process.env.DATABASE_URL || '',
  redisUrl: process.env.REDIS_URL || '',
  jwtSecret: process.env.JWT_SECRET || '',
  adminUsername: process.env.ADMIN_USERNAME || 'admin',
  adminPassword: process.env.ADMIN_PASSWORD || '',
  nodeEnv: process.env.NODE_ENV || 'development',
  mockDevData,
  worldCupEnabled:
    process.env.WORLD_CUP_ENABLED === '1' || process.env.WORLD_CUP_ENABLED === 'true',
  footballDataApiKey: process.env.FOOTBALL_DATA_API_KEY || '',
  footballDataCompetition: process.env.FOOTBALL_DATA_COMPETITION || 'WC',
  footballDataSeason: process.env.FOOTBALL_DATA_SEASON || '2026',
  email: {
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    admin: process.env.ADMIN_EMAIL || '',
  },
};

if (!config.mockDevData && !config.databaseUrl) {
  throw new Error('DATABASE_URL is required (or set MOCK_DEV_DATA=1 for local JSON mock)');
}

if (!config.jwtSecret && !config.mockDevData) {
  throw new Error('JWT_SECRET is required');
}

if (config.mockDevData && config.nodeEnv === 'production') {
  throw new Error('MOCK_DEV_DATA must not be enabled in production');
}

if (config.nodeEnv === 'production' && !config.redisUrl) {
  throw new Error('REDIS_URL is required in production');
}
