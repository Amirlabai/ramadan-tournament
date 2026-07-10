import { Division, RequestStatus, SeasonRegistrationStatus, TeamStatus } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { SeasonService } from './SeasonService';
import { sanitizeSearchQuery } from '../utils/sanitizeSearchQuery';
import {
  getIdentityMatchState,
  hasAdminIdentityOnReg,
} from './RegistrationIdentityService';

export type WorkflowDivision = Division;

export interface RegistrationSummary {
  seasonId: string;
  division: Division;
  status: SeasonRegistrationStatus;
  activeDivision: Division | null;
  invoiceAlert: string | null;
  awaitingAdminIdentity: boolean;
  pendingJoin: { id: string; teamId: number; status: RequestStatus } | null;
  pendingCreation: { id: string; teamName: string; status: RequestStatus } | null;
  pendingTransfer: { id: string; fromTeamId: number; toTeamId: number; status: RequestStatus } | null;
  onRoster: { teamId: number; memberId: number; isCaptain: boolean } | null;
  ownedTeamId: number | null;
  /**
   * Pending join count for the caller's claimed-captain team (API field name kept for
   * `/auth/me` compat). Zero when the user is not a claimed captain.
   */
  ownerPendingJoinCount: number;
}

export class RegistrationQueryService {
  static async getSummary(userId: string, division: Division): Promise<RegistrationSummary> {
    const season = await SeasonService.getActiveSeasonForDivision(division);
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });

    const [reg, join, creation, transfer, player, ownedTeam, matchState] = await Promise.all([
      prisma.seasonRegistration.findUnique({
        where: { userId_seasonId: { userId, seasonId: season.id } },
      }),
      prisma.teamJoinRequest.findFirst({
        where: {
          userId,
          seasonId: season.id,
          status: { in: [RequestStatus.pending, RequestStatus.owner_approved] },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.teamCreationRequest.findFirst({
        where: {
          userId,
          seasonId: season.id,
          status: RequestStatus.pending,
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.teamTransferRequest.findFirst({
        where: { userId, seasonId: season.id, status: RequestStatus.pending },
      }),
      prisma.player.findFirst({
        where: { userId, seasonId: season.id, active: true },
      }),
      prisma.team.findFirst({
        where: { seasonId: season.id, ownerUserId: userId },
        select: { id: true },
      }),
      getIdentityMatchState(userId, season.id),
    ]);

    const ownerPendingJoinCount =
      player?.isCaptain === true
        ? await prisma.teamJoinRequest.count({
            where: {
              seasonId: season.id,
              teamId: player.teamId,
              status: RequestStatus.pending,
            },
          })
        : 0;

    return {
      seasonId: season.id,
      division,
      status: reg?.status ?? SeasonRegistrationStatus.none,
      activeDivision: user.activeDivision,
      invoiceAlert: reg?.invoiceAlert ?? null,
      awaitingAdminIdentity:
        matchState.hasUserSubmission &&
        !matchState.identityMatched &&
        !matchState.hasAdminAssignment,
      pendingJoin: join
        ? { id: join.id, teamId: join.teamId, status: join.status }
        : null,
      pendingCreation: creation
        ? { id: creation.id, teamName: creation.teamName, status: creation.status }
        : null,
      pendingTransfer: transfer
        ? {
            id: transfer.id,
            fromTeamId: transfer.fromTeamId,
            toTeamId: transfer.toTeamId,
            status: transfer.status,
          }
        : null,
      onRoster: player
        ? { teamId: player.teamId, memberId: player.memberId, isCaptain: player.isCaptain }
        : null,
      ownedTeamId: ownedTeam?.id ?? null,
      ownerPendingJoinCount,
    };
  }

  static async listAvailableTeams(division: Division) {
    const season = await SeasonService.getActiveSeasonForDivision(division).catch(() => null);
    if (!season) return [];
    return prisma.team.findMany({
      where: { seasonId: season.id, status: TeamStatus.active },
      select: { id: true, name: true, logoUrl: true },
      orderBy: { name: 'asc' },
    });
  }

  static async searchUsersForIdentity(seasonId: string, query: string, limit = 20) {
    const q = sanitizeSearchQuery(query);
    if (q.length < 2) {
      return [];
    }

    const cappedLimit = Math.min(Math.max(1, limit), 50);

    await prisma.season.findUniqueOrThrow({ where: { id: seasonId } });

    const users = await prisma.user.findMany({
      where: {
        OR: [
          { email: { contains: q, mode: 'insensitive' } },
          { displayName: { contains: q, mode: 'insensitive' } },
        ],
      },
      take: cappedLimit,
      orderBy: { displayName: 'asc' },
      select: { id: true, displayName: true, email: true, activeDivision: true },
    });

    if (!users.length) {
      return [];
    }

    const userIds = users.map((u) => u.id);
    const regs = await prisma.seasonRegistration.findMany({
      where: { seasonId, userId: { in: userIds } },
      select: {
        userId: true,
        status: true,
        userPersonalIdMasked: true,
        userBirthYear: true,
        adminBirthYear: true,
        adminPersonalIdEnc: true,
      },
    });

    const regByUser = new Map(regs.map((r) => [r.userId, r]));

    return users.map((u) => {
      const reg = regByUser.get(u.id);
      const hasAdminAssignment = hasAdminIdentityOnReg(reg ?? null);
      return {
        id: u.id,
        displayName: u.displayName,
        email: u.email,
        activeDivision: u.activeDivision,
        registrationStatus: reg?.status ?? SeasonRegistrationStatus.none,
        hasAdminAssignment,
        submittedIdentityMasked: reg?.userPersonalIdMasked ?? null,
        submittedBirthYear: reg?.userBirthYear ?? null,
        assignedBirthYear: reg?.adminBirthYear ?? null,
      };
    });
  }
}
