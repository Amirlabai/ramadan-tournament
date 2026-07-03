import { loadServerEnv } from './loadServerEnv';
import { parseCorsOrigins } from './corsOrigins';

loadServerEnv();

const mockDevData =
  process.env.MOCK_DEV_DATA === '1' || process.env.MOCK_DEV_DATA === 'true';

if (mockDevData && !process.env.JWT_SECRET) {
  process.env.JWT_SECRET = 'mock-dev-jwt-secret-change-me';
}

const worldCupOnlyFlag =
  process.env.WORLD_CUP_ONLY === '1' || process.env.WORLD_CUP_ONLY === 'true';

export { loadServerEnv } from './loadServerEnv';

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
    process.env.WORLD_CUP_ENABLED === '1' ||
    process.env.WORLD_CUP_ENABLED === 'true' ||
    worldCupOnlyFlag,
  worldCupOnly: worldCupOnlyFlag,
  footballDataApiKey: process.env.FOOTBALL_DATA_API_KEY || '',
  footballDataCompetition: process.env.FOOTBALL_DATA_COMPETITION || 'WC',
  footballDataSeason: process.env.FOOTBALL_DATA_SEASON || '2026',
  personalIdKey: process.env.PERSONAL_ID_KEY || '',
  corsOrigins: parseCorsOrigins(process.env.CORS_ORIGINS),
  analyticsRetentionDays: Math.max(
    0,
    parseInt(process.env.ANALYTICS_RETENTION_DAYS || '90', 10) || 0
  ),
  /** `lax` when API is proxied same-origin on Vercel; default `none` for cross-origin prod. */
  cookieSameSite: (() => {
    const raw = (process.env.COOKIE_SAME_SITE || '').toLowerCase();
    if (raw === 'lax' || raw === 'strict' || raw === 'none') return raw;
    return null as 'lax' | 'strict' | 'none' | null;
  })(),
  email: {
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    admin: process.env.ADMIN_EMAIL || '',
  },
};

/** WC-only when no Postgres URL — DATABASE_URL always wins over WORLD_CUP_ONLY. */
export const worldCupStandalone =
  !config.mockDevData &&
  !config.databaseUrl &&
  (config.worldCupOnly || config.worldCupEnabled);

if (!config.mockDevData && !worldCupStandalone && !config.databaseUrl) {
  throw new Error('DATABASE_URL is required (or set MOCK_DEV_DATA=1 for local JSON mock)');
}

if (!config.jwtSecret && !config.mockDevData && !worldCupStandalone) {
  throw new Error('JWT_SECRET is required');
}

if (config.mockDevData && config.nodeEnv === 'production') {
  throw new Error('MOCK_DEV_DATA must not be enabled in production');
}

if (config.nodeEnv === 'production' && !worldCupStandalone && !config.redisUrl && !config.worldCupEnabled) {
  throw new Error('REDIS_URL is required in production');
}
