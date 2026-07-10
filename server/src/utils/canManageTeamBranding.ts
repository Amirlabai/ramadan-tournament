import { prisma } from '../lib/prisma';
import { User } from '../models/User';
import { SeasonService } from '../services/SeasonService';
import { canActorReviewPendingJoin, hasClaimedCaptainReviewer } from './claimedCaptain';

type DivisionSlug = 'boys' | 'girls';

async function isPlatformAdminUser(userId: string): Promise<boolean> {
  const user = await User.findById(userId);
  return !!user && (user.role === 'Admin' || user.role === 'admin');
}

/**
 * Team owner (any season in division) or platform admin.
 * Used by legacy map-player review — does not include claimed captains.
 */
export async function isTeamOwnerOrPlatformAdmin(
  userId: string,
  teamId: number,
  division: DivisionSlug
): Promise<boolean> {
  if (await isPlatformAdminUser(userId)) return true;

  const owned = await prisma.team.findFirst({
    where: { id: teamId, ownerUserId: userId, season: { division } },
    select: { id: true },
  });
  return !!owned;
}

/**
 * Owner of the team in the active season, claimed squad captain, or platform admin
 * may edit team branding (metadata + logo).
 */
export async function canManageTeamBranding(
  userId: string,
  teamId: number,
  division: DivisionSlug
): Promise<boolean> {
  if (await isPlatformAdminUser(userId)) return true;

  const season = await SeasonService.getActiveSeasonForDivision(division).catch(() => null);
  if (!season) return false;

  const owned = await prisma.team.findFirst({
    where: { id: teamId, ownerUserId: userId, seasonId: season.id },
    select: { id: true },
  });
  if (owned) return true;

  return hasClaimedCaptainReviewer(prisma, userId, season.id, teamId);
}

/**
 * Owner, claimed captain, or platform admin may post-edit roster player fields/photos.
 * Linked players still self-edit via PlayerService.updateOwnProfile; last write wins.
 */
export async function canManageTeamRosterPlayers(
  userId: string,
  teamId: number,
  division: DivisionSlug
): Promise<boolean> {
  if (await isPlatformAdminUser(userId)) return true;

  const season = await SeasonService.getActiveSeasonForDivision(division).catch(() => null);
  if (!season) return false;

  return canActorReviewPendingJoin(prisma, userId, season.id, teamId);
}
