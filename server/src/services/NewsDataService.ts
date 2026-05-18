import { prisma } from '../lib/prisma';
import { CacheService } from './CacheService';
import { SeasonService } from './SeasonService';
import { Division } from '@prisma/client';

export class NewsDataService {
  static async getAllNews(division: Division = Division.boys) {
    const season = await SeasonService.getActiveSeason(division);
    const cacheKey = CacheService.key('doc', division, 'news', 'all', season.id);

    return CacheService.getOrSet(cacheKey, 120, async () => {
      return prisma.news.findMany({
        where: { seasonId: season.id },
        orderBy: { date: 'desc' },
      });
    });
  }
}
