import { Division, ScoringMode, Season } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { CacheService } from './CacheService';

export type TournamentSlug = 'boys' | 'girls';

const SLUG_TO_DIVISION: Record<TournamentSlug, Division> = {
  boys: Division.boys,
  girls: Division.girls,
};

export class SeasonService {
  static async getActiveSeason(division: Division = Division.boys): Promise<Season> {
    const cacheKey = CacheService.key('season', 'active', division);
    const cached = await CacheService.get<Season>(cacheKey);
    if (cached) return cached;

    const season = await prisma.season.findFirst({
      where: { division, isActive: true },
      orderBy: { createdAt: 'desc' },
    });
    if (!season) {
      throw new Error(`No active season for division: ${division}`);
    }
    await CacheService.set(cacheKey, season, 300);
    return season;
  }

  static async getActiveBySlug(slug: TournamentSlug): Promise<Season> {
    return this.getActiveSeason(SLUG_TO_DIVISION[slug]);
  }

  static async getActiveFootballSeason(): Promise<Season> {
    const season = await this.getActiveSeason(Division.boys);
    if (season.scoringMode !== ScoringMode.football) {
      throw new Error('Active boys season is not football mode');
    }
    return season;
  }

  static async getActiveGirlsSeason(): Promise<Season | null> {
    return prisma.season.findFirst({
      where: { division: Division.girls, isActive: true, scoringMode: ScoringMode.points },
      orderBy: { createdAt: 'desc' },
    });
  }
}
