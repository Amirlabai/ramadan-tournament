import { CacheService } from './CacheService';

const SALT_TTL_SECONDS = 60 * 60 * 24 * 60; // ~60 days

export const MATCH_STATS_SALT_PERSIST_FAILED = 'match_stats_salt_persist_failed';

function saltKey(matchId: number): string {
  return CacheService.key('match-stats', 'salt', String(matchId));
}

export async function getRegenSalt(matchId: number): Promise<number> {
  const stored = await CacheService.get<number>(saltKey(matchId));
  return typeof stored === 'number' && Number.isFinite(stored) ? stored : 0;
}

export async function setRegenSalt(matchId: number, salt: number): Promise<void> {
  await CacheService.set(saltKey(matchId), salt, SALT_TTL_SECONDS);
  const verified = await CacheService.get<number>(saltKey(matchId));
  if (verified !== salt) {
    throw new Error(MATCH_STATS_SALT_PERSIST_FAILED);
  }
}
