import { Division, NewsPriority } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { CacheService } from './CacheService';
import { SeasonService } from './SeasonService';

export type NewsInput = {
  id?: number;
  title: string;
  message: string;
  date?: Date | string;
  priority?: NewsPriority | 'normal' | 'high';
};

export class NewsDataService {
  static async invalidateNewsCache(division: Division): Promise<void> {
    await CacheService.invalidatePattern(`rt:doc:${division}:news:*`);
  }

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

  static async getNextNewsId(division: Division): Promise<number> {
    const season = await SeasonService.getActiveSeason(division);
    const max = await prisma.news.findFirst({
      where: { seasonId: season.id },
      orderBy: { id: 'desc' },
    });
    return (max?.id ?? 0) + 1;
  }

  static async createNews(
    division: Division,
    data: NewsInput,
    createdById?: string
  ) {
    const season = await SeasonService.getActiveSeason(division);
    const id = data.id ?? (await this.getNextNewsId(division));
    const row = await prisma.news.create({
      data: {
        id,
        seasonId: season.id,
        title: data.title,
        message: data.message,
        date: data.date ? new Date(data.date) : new Date(),
        priority: (data.priority as NewsPriority) || NewsPriority.normal,
        createdById: createdById ?? null,
      },
    });
    await this.invalidateNewsCache(division);
    return row;
  }

  static async updateNews(division: Division, id: number, data: Partial<NewsInput>) {
    const season = await SeasonService.getActiveSeason(division);
    const row = await prisma.news.update({
      where: { seasonId_id: { seasonId: season.id, id } },
      data: {
        ...(data.title !== undefined ? { title: data.title } : {}),
        ...(data.message !== undefined ? { message: data.message } : {}),
        ...(data.date !== undefined ? { date: new Date(data.date) } : {}),
        ...(data.priority !== undefined ? { priority: data.priority as NewsPriority } : {}),
      },
    });
    await this.invalidateNewsCache(division);
    return row;
  }

  static async deleteNews(division: Division, id: number) {
    const season = await SeasonService.getActiveSeason(division);
    const row = await prisma.news.delete({
      where: { seasonId_id: { seasonId: season.id, id } },
    });
    await this.invalidateNewsCache(division);
    return row;
  }
}
