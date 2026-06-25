import { prisma } from '../lib/prisma';
import { SeasonService } from '../services/SeasonService';

export class Vote {
  id?: string;
  userId?: string;
  playerMemberId?: number | null;
  teamId?: number | null;
  category?: string;
  createdAt?: Date;

  constructor(data: Partial<Vote> & { id?: string; createdAt?: Date }) {
    Object.assign(this, data);
  }

  async save() {
    const season = await SeasonService.getActiveFootballSeason();
    if (this.id) {
      const updated = await prisma.vote.update({
        where: { id: this.id },
        data: { playerMemberId: this.playerMemberId, teamId: this.teamId },
      });
      Object.assign(this, updated);
      return this;
    }
    const created = await prisma.vote.create({
      data: {
        userId: this.userId!,
        seasonId: season.id,
        category: this.category || 'mvp',
        playerMemberId: this.playerMemberId,
        teamId: this.teamId,
      },
    });
    Object.assign(this, created);
    this.createdAt = new Date();
    return this;
  }

  static async findOne(filter: { userId?: string; category?: string }) {
    const season = await SeasonService.getActiveFootballSeason();
    const row = await prisma.vote.findUnique({
      where: {
        userId_seasonId_category: {
          userId: filter.userId!,
          seasonId: season.id,
          category: filter.category || 'mvp',
        },
      },
    });
    if (!row) return null;
    return new Vote(row as unknown as Partial<Vote>);
  }

  static async find(filter: { category?: string } = {}) {
    const season = await SeasonService.getActiveFootballSeason();
    return prisma.vote.findMany({
      where: {
        seasonId: season.id,
        ...(filter.category ? { category: filter.category } : {}),
      },
    });
  }

  static async deleteOne(filter: { id?: string }) {
    if (filter.id) await prisma.vote.delete({ where: { id: filter.id } });
  }

  static async deleteMany(filter: { seasonId?: string } = {}) {
    if (filter.seasonId) {
      await prisma.vote.deleteMany({ where: { seasonId: filter.seasonId } });
    }
  }
}
