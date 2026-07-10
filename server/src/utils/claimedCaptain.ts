import type { Prisma } from '@prisma/client';

/** True when the team has any active claimed captain (isCaptain + userId). */
export async function teamHasClaimedCaptain(
  db: Pick<Prisma.TransactionClient, 'player'>,
  seasonId: string,
  teamId: number
): Promise<boolean> {
  const captainRow = await db.player.findFirst({
    where: {
      seasonId,
      teamId,
      active: true,
      isCaptain: true,
      userId: { not: null },
    },
    select: { memberId: true },
  });
  return !!captainRow;
}

/** Claimed captain: active roster row with isCaptain and matching userId. */
export async function hasClaimedCaptainReviewer(
  db: Pick<Prisma.TransactionClient, 'player'>,
  actorId: string,
  seasonId: string,
  teamId: number
): Promise<boolean> {
  const captainRow = await db.player.findFirst({
    where: {
      seasonId,
      teamId,
      userId: actorId,
      active: true,
      isCaptain: true,
    },
    select: { memberId: true },
  });
  return !!captainRow;
}
