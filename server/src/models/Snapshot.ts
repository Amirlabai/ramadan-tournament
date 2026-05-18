import { prisma } from '../lib/prisma';
import { SeasonService } from '../services/SeasonService';

export const Snapshot = {
  findOne() {
    return {
      sort(_sort: { savedAt: -1 }) {
        return {
          async exec() {
            const season = await SeasonService.getActiveFootballSeason();
            const row = await prisma.statsSnapshot.findFirst({
              where: { seasonId: season.id },
              orderBy: { savedAt: 'desc' },
            });
            if (!row) return null;
            return {
              standings: row.standings,
              topScorers: row.topScorers,
              savedAt: row.savedAt,
            };
          },
          then(resolve: (v: unknown) => void, reject?: (e: unknown) => void) {
            return this.exec().then(resolve, reject);
          },
        };
      },
    };
  },

  async create(data: { standings: unknown; topScorers: unknown; savedAt?: Date }) {
    const season = await SeasonService.getActiveFootballSeason();
    await prisma.statsSnapshot.create({
      data: {
        seasonId: season.id,
        standings: data.standings as object,
        topScorers: data.topScorers as object,
        savedAt: data.savedAt || new Date(),
      },
    });
  },
};
