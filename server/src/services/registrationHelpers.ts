import { Division } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { CacheService } from './CacheService';
import { SeasonService } from './SeasonService';

export async function getNextMemberId(): Promise<number> {
  const max = await prisma.player.aggregate({ _max: { memberId: true } });
  return (max._max.memberId ?? 0) + 1;
}

export async function getNextTeamId(seasonId: string): Promise<number> {
  const max = await prisma.team.aggregate({
    where: { seasonId },
    _max: { id: true },
  });
  return (max._max.id ?? 0) + 1;
}

export async function invalidateDivisionCaches(division: Division): Promise<void> {
  const season = await SeasonService.getActiveSeasonForDivision(division).catch(() => null);
  if (season) {
    await CacheService.del(CacheService.key('doc', division, 'teams', 'all', season.id));
  }
  await CacheService.invalidatePattern(`rt:doc:${division}:*`);
}

export async function lockActiveDivision(userId: string, division: Division): Promise<void> {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  if (user.activeDivision && user.activeDivision !== division) {
    throw new Error('כבר נרשמת לטורניר השני השנה. לא ניתן להצטרף לשני הטורנירים.');
  }
  if (!user.activeDivision) {
    await prisma.user.update({
      where: { id: userId },
      data: { activeDivision: division },
    });
  }
}

export async function assertDivisionAccess(userId: string, division: Division): Promise<void> {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  if (user.activeDivision && user.activeDivision !== division) {
    throw new Error('אין גישה לטורניר זה — נרשמת לצד השני.');
  }
}
