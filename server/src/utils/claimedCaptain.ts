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

type JoinReviewerDb = Pick<Prisma.TransactionClient, 'player' | 'team'>;

/**
 * Team has a join reviewer when it has an ownerUserId or a claimed captain.
 * Those joins stay `pending` for owner/captain final approval (admin does not interfere).
 */
export async function teamHasJoinReviewer(
  db: JoinReviewerDb,
  seasonId: string,
  teamId: number
): Promise<boolean> {
  const team = await db.team.findFirst({
    where: { seasonId, id: teamId },
    select: { ownerUserId: true },
  });
  if (team?.ownerUserId) return true;
  return teamHasClaimedCaptain(db, seasonId, teamId);
}

/** Actor may review pending joins if they are the team owner or a claimed captain. */
export async function canActorReviewPendingJoin(
  db: JoinReviewerDb,
  actorId: string,
  seasonId: string,
  teamId: number
): Promise<boolean> {
  const team = await db.team.findFirst({
    where: { seasonId, id: teamId },
    select: { ownerUserId: true },
  });
  if (team?.ownerUserId === actorId) return true;
  return hasClaimedCaptainReviewer(db, actorId, seasonId, teamId);
}
