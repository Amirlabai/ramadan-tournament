import type { Prisma } from '@prisma/client';

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
