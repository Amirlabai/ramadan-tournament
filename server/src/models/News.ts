import { prisma } from '../lib/prisma';
import { SeasonService } from '../services/SeasonService';
import { CacheService } from '../services/CacheService';

export interface INews {
  id: number;
  title: string;
  message: string;
  date: Date;
  priority: 'normal' | 'high';
  save(): Promise<INews>;
}

function mapNews(row: any): INews {
  return {
    id: row.id,
    title: row.title,
    message: row.message,
    date: row.date,
    priority: row.priority,
    async save() {
      const season = await SeasonService.getActiveFootballSeason();
      await prisma.news.update({
        where: { seasonId_id: { seasonId: season.id, id: row.id } },
        data: {
          title: row.title,
          message: row.message,
          date: row.date,
          priority: row.priority,
        },
      });
      await CacheService.invalidatePattern('rt:doc:boys:news:*');
      return mapNews(row);
    },
  };
}

export class News {
  id?: number;
  title?: string;
  message?: string;
  date?: Date;
  priority?: 'normal' | 'high';
  createdBy?: string;

  constructor(data: Partial<INews> & { createdBy?: string }) {
    Object.assign(this, data);
  }

  async save(): Promise<INews> {
    const season = await SeasonService.getActiveFootballSeason();
    const created = await prisma.news.create({
      data: {
        id: this.id!,
        seasonId: season.id,
        title: this.title!,
        message: this.message!,
        date: this.date!,
        priority: (this.priority as any) || 'normal',
        createdById: this.createdBy,
      },
    });
    await CacheService.invalidatePattern('rt:doc:boys:news:*');
    return mapNews(created);
  }

  static create(data: Partial<INews> & { createdBy?: string }) {
    return new News(data).save();
  }

  static find() {
    return {
      sort(_sort: { date: -1 }) {
        return {
          async then(resolve: (v: INews[]) => void, reject?: (e: unknown) => void) {
            try {
              const season = await SeasonService.getActiveFootballSeason();
              const rows = await prisma.news.findMany({
                where: { seasonId: season.id },
                orderBy: { date: 'desc' },
              });
              resolve(rows.map(mapNews));
            } catch (e) {
              reject?.(e);
            }
          },
        };
      },
    };
  }

  static findOne(filter: { id?: number } = {}) {
    return {
      sort(_sort: { id: -1 }) {
        return {
          async then(resolve: (v: INews | null) => void, reject?: (e: unknown) => void) {
            try {
              const season = await SeasonService.getActiveFootballSeason();
              if (filter.id !== undefined) {
                const row = await prisma.news.findFirst({
                  where: { seasonId: season.id, id: filter.id },
                });
                resolve(row ? mapNews(row) : null);
                return;
              }
              const row = await prisma.news.findFirst({
                where: { seasonId: season.id },
                orderBy: { id: 'desc' },
              });
              resolve(row ? mapNews(row) : null);
            } catch (e) {
              reject?.(e);
            }
          },
        };
      },
      async then(resolve: (v: INews | null) => void, reject?: (e: unknown) => void) {
        try {
          const season = await SeasonService.getActiveFootballSeason();
          const row = await prisma.news.findFirst({
            where: { seasonId: season.id, ...(filter.id !== undefined ? { id: filter.id } : {}) },
          });
          resolve(row ? mapNews(row) : null);
        } catch (e) {
          reject?.(e);
        }
      },
    };
  }

  static async findOneAndUpdate(
    filter: { id: number },
    body: Partial<INews>,
    _opts?: { new?: boolean }
  ): Promise<INews | null> {
    const season = await SeasonService.getActiveFootballSeason();
    try {
      const row = await prisma.news.update({
        where: { seasonId_id: { seasonId: season.id, id: filter.id } },
        data: body as any,
      });
      await CacheService.invalidatePattern('rt:doc:boys:news:*');
      return mapNews(row);
    } catch {
      return null;
    }
  }

  static async findOneAndDelete(filter: { id: number }): Promise<INews | null> {
    const season = await SeasonService.getActiveFootballSeason();
    try {
      const row = await prisma.news.delete({
        where: { seasonId_id: { seasonId: season.id, id: filter.id } },
      });
      await CacheService.invalidatePattern('rt:doc:boys:news:*');
      return mapNews(row);
    } catch {
      return null;
    }
  }

  static async deleteMany() {
    const season = await SeasonService.getActiveFootballSeason();
    await prisma.news.deleteMany({ where: { seasonId: season.id } });
  }

  static async insertMany(docs: Array<Partial<INews>>) {
    const season = await SeasonService.getActiveFootballSeason();
    for (const doc of docs) {
      await prisma.news.create({
        data: {
          id: doc.id!,
          seasonId: season.id,
          title: doc.title!,
          message: doc.message!,
          date: doc.date!,
          priority: (doc.priority as any) || 'normal',
        },
      });
    }
    await CacheService.invalidatePattern('rt:doc:boys:news:*');
  }
}
