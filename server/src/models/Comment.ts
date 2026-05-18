import { prisma } from '../lib/prisma';
import { SeasonService } from '../services/SeasonService';

export interface IComment {
  id: string;
  matchId: number;
  author: string;
  content: string;
  createdAt: Date;
}

export class Comment {
  matchId?: number;
  author?: string;
  content?: string;

  constructor(data: { matchId: number; author: string; content: string }) {
    Object.assign(this, data);
  }

  async save() {
    const season = await SeasonService.getActiveFootballSeason();
    return prisma.comment.create({
      data: {
        matchId: this.matchId!,
        seasonId: season.id,
        author: this.author!,
        content: this.content!,
      },
    });
  }

  static find(filter: { matchId?: number }) {
    const run = async (limit?: number) => {
      const season = await SeasonService.getActiveFootballSeason();
      return prisma.comment.findMany({
        where: {
          seasonId: season.id,
          ...(filter.matchId !== undefined ? { matchId: filter.matchId } : {}),
        },
        orderBy: { createdAt: 'desc' },
        ...(limit ? { take: limit } : {}),
      });
    };
    return {
      sort: (_sort: { createdAt: -1 }) => ({
        limit: (n: number) => ({
          then: (resolve: (v: IComment[]) => void, reject?: (e: unknown) => void) =>
            run(n).then(resolve, reject),
        }),
        then: (resolve: (v: IComment[]) => void, reject?: (e: unknown) => void) =>
          run().then(resolve, reject),
      }),
    };
  }

  static async create(data: { matchId: number; author: string; content: string }) {
    return new Comment(data).save();
  }

  static async findByIdAndDelete(id: string) {
    return prisma.comment.delete({ where: { id } });
  }
}
