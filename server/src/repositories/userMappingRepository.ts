import { Division, Prisma, RequestStatus } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { IMappedPlayerInfo, IUser, prismaUserToIUser } from '../db/userMapper';
import { toInputJson } from '../lib/json';
import { parseRequestedMemberId } from '../utils/requestedMemberId';
import { SeasonService } from '../services/SeasonService';
import { CacheService } from '../services/CacheService';

function readMapping(row: { mappedPlayerInfo: unknown }): IMappedPlayerInfo | null {
  return (row.mappedPlayerInfo as IMappedPlayerInfo | null) ?? null;
}

export async function findUsersWithMapping(): Promise<IUser[]> {
  const rows = await prisma.user.findMany({
    where: { mappedPlayerInfo: { not: Prisma.DbNull } },
    orderBy: { createdAt: 'desc' },
  });
  return rows.map(prismaUserToIUser);
}

export async function findPendingTeamCreationRequests(): Promise<IUser[]> {
  const rows = await prisma.user.findMany({ orderBy: { createdAt: 'desc' } });
  return rows
    .filter((row) => {
      const pending = row.pendingTeamRequest as { status?: string } | null;
      return pending?.status === 'pending';
    })
    .map(prismaUserToIUser);
}

export async function findPendingMappingsForTeam(teamId: number): Promise<IUser[]> {
  const rows = await prisma.user.findMany({ orderBy: { createdAt: 'desc' } });
  return rows
    .filter((row) => {
      const mapping = readMapping(row);
      return mapping?.teamId === teamId && mapping.status === 'pending';
    })
    .map(prismaUserToIUser);
}

export async function findApprovedClaimedMemberIds(
  teamId: number,
  seasonId?: string
): Promise<number[]> {
  const claimed = new Set<number>();

  const rosterRows = await prisma.player.findMany({
    where: {
      teamId,
      active: true,
      userId: { not: null },
      ...(seasonId ? { seasonId } : {}),
    },
    select: { memberId: true },
  });
  for (const row of rosterRows) {
    claimed.add(row.memberId);
  }

  if (!seasonId) {
    const rows = await prisma.user.findMany({
      where: { mappedPlayerInfo: { not: Prisma.DbNull } },
    });
    for (const row of rows) {
      const mapping = readMapping(row);
      if (mapping?.teamId === teamId && mapping.status === 'approved' && mapping.memberId > 0) {
        claimed.add(mapping.memberId);
      }
    }
  }

  return [...claimed];
}

export async function findPendingJoinClaimedMemberIds(
  teamId: number,
  seasonId: string
): Promise<number[]> {
  const reserved = new Set<number>();
  const pendingJoins = await prisma.teamJoinRequest.findMany({
    where: {
      teamId,
      seasonId,
      status: { in: [RequestStatus.pending, RequestStatus.owner_approved] },
    },
    include: { user: { select: { playerProfile: true } } },
  });
  for (const row of pendingJoins) {
    const memberId = parseRequestedMemberId(
      (row.user.playerProfile as Record<string, unknown> | null)?.requestedMemberId
    );
    if (memberId) reserved.add(memberId);
  }
  return [...reserved];
}

export async function findReservedMemberIds(
  teamId: number,
  seasonId: string
): Promise<number[]> {
  const [approved, pending] = await Promise.all([
    findApprovedClaimedMemberIds(teamId, seasonId),
    findPendingJoinClaimedMemberIds(teamId, seasonId),
  ]);
  return [...new Set([...approved, ...pending])];
}

/** True when the active season has roster slots a newcomer can still claim. */
export async function hasClaimableRosterPlayers(division: Division): Promise<boolean> {
  const cacheKey = CacheService.key('claimable-players', division);
  return CacheService.getOrSet(cacheKey, 120, async () => {
    let season;
    try {
      season = await SeasonService.getActiveSeasonForDivision(division);
    } catch {
      return false;
    }

    const unlinked = await prisma.player.findMany({
      where: { seasonId: season.id, active: true, userId: null },
      select: { memberId: true, teamId: true },
    });
    if (unlinked.length === 0) return false;

    const byTeam = new Map<number, number[]>();
    for (const player of unlinked) {
      const memberIds = byTeam.get(player.teamId) ?? [];
      memberIds.push(player.memberId);
      byTeam.set(player.teamId, memberIds);
    }

    for (const [teamId, memberIds] of byTeam) {
      const reserved = new Set(await findReservedMemberIds(teamId, season.id));
      if (memberIds.some((memberId) => !reserved.has(memberId))) {
        return true;
      }
    }
    return false;
  });
}

export async function rejectOtherPendingMappings(
  excludeUserId: string,
  teamId: number,
  memberId: number,
): Promise<number> {
  const rows = await prisma.user.findMany({ where: { id: { not: excludeUserId } } });
  let modified = 0;
  for (const row of rows) {
    const mapping = readMapping(row);
    if (!mapping || mapping.teamId !== teamId || mapping.memberId !== memberId || mapping.status !== 'pending') {
      continue;
    }
    mapping.status = 'rejected';
    await prisma.user.update({
      where: { id: row.id },
      data: { mappedPlayerInfo: toInputJson(mapping) },
    });
    modified++;
  }
  return modified;
}

export async function clearPlayerProfile(userId: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { playerProfile: Prisma.JsonNull },
  });
}

export async function clearMappingsForDeletedPlayer(
  teamId: number,
  memberId: number,
  tx: Prisma.TransactionClient = prisma
): Promise<void> {
  const rows = await tx.user.findMany({
    where: { mappedPlayerInfo: { not: Prisma.DbNull } },
  });
  for (const row of rows) {
    const mapping = readMapping(row);
    if (!mapping || mapping.teamId !== teamId || mapping.memberId !== memberId) continue;
    await tx.user.update({
      where: { id: row.id },
      data: {
        role: 'user',
        mappedPlayerInfo: Prisma.JsonNull,
        playerProfile: Prisma.JsonNull,
      },
    });
  }
}

export async function moveApprovedMappingTeam(
  sourceTeamId: number,
  memberId: number,
  targetTeamId: number,
): Promise<void> {
  const rows = await prisma.user.findMany();
  for (const row of rows) {
    const mapping = readMapping(row);
    if (!mapping || mapping.teamId !== sourceTeamId || mapping.memberId !== memberId) continue;
    mapping.teamId = targetTeamId;
    await prisma.user.update({
      where: { id: row.id },
      data: { mappedPlayerInfo: toInputJson(mapping) },
    });
  }
}
