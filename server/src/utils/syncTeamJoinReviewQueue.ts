import { RequestStatus, type Prisma } from '@prisma/client';
import { teamHasClaimedCaptain } from './claimedCaptain';

type JoinQueueDb = Pick<Prisma.TransactionClient, 'player' | 'teamJoinRequest'>;

/**
 * Keep join request status aligned with claimed-captain coverage.
 *
 * - No claimed captain → promote `pending` → `owner_approved` (admin fallback).
 * - Claimed captain → reopen rows that were never captain-reviewed:
 *   `owner_approved` + `ownerReviewedAt IS NULL` + `adminReviewedAt IS NULL` → `pending`.
 *
 * Bounce-back is intentional: auto-skips and rows promoted after a captain left both have
 * null `ownerReviewedAt`, so the next claimed captain sees them. Captain-approved rows
 * waiting for admin (`ownerReviewedAt` set) stay on the admin queue.
 *
 * Primary callers are write paths (squad roles, leave/deactivate, admin approve, etc.).
 * `syncOpenJoinQueuesForSeason` is a repair fallback for admin list/count only.
 */
export async function syncTeamJoinReviewQueue(
  db: JoinQueueDb,
  seasonId: string,
  teamId: number
): Promise<void> {
  const hasCaptain = await teamHasClaimedCaptain(db, seasonId, teamId);
  if (hasCaptain) {
    await db.teamJoinRequest.updateMany({
      where: {
        seasonId,
        teamId,
        status: RequestStatus.owner_approved,
        adminReviewedAt: null,
        ownerReviewedAt: null,
      },
      data: { status: RequestStatus.pending },
    });
    return;
  }

  // Leave ownerReviewedAt null so a future claimed captain can reopen these (not admin-sticky).
  await db.teamJoinRequest.updateMany({
    where: {
      seasonId,
      teamId,
      status: RequestStatus.pending,
    },
    data: { status: RequestStatus.owner_approved },
  });
}

/**
 * Fallback repair for admin workflow list/count. Prefer write-path sync; this mutates on
 * read so stuck TeamJoinRequests (e.g. pre-fix pending with no captain) reach the admin queue.
 */
export async function syncOpenJoinQueuesForSeason(
  db: JoinQueueDb,
  seasonId: string
): Promise<void> {
  const open = await db.teamJoinRequest.findMany({
    where: {
      seasonId,
      status: { in: [RequestStatus.pending, RequestStatus.owner_approved] },
    },
    select: { teamId: true },
    distinct: ['teamId'],
  });
  for (const { teamId } of open) {
    await syncTeamJoinReviewQueue(db, seasonId, teamId);
  }
}
