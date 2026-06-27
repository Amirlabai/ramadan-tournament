import {
  Division,
  RequestStatus,
  ScoringMode,
  SeasonRegistrationStatus,
  SquadRole,
  TeamStatus,
} from '@prisma/client';
import { prisma } from '../lib/prisma';
import { toInputJson } from '../lib/json';
import { CacheService } from './CacheService';
import { InvoiceRateLimitService, MAX_INVOICE_ATTEMPTS } from './InvoiceRateLimitService';
import { SeasonService } from './SeasonService';
import { sanitizeSearchQuery } from '../utils/sanitizeSearchQuery';
import { sanitizeTeamCreationFields } from '../utils/inputValidation';
import {
  assignAdminIdentity as assignAdminIdentityImpl,
  assertMatchedIdentityForApproval,
  getIdentityMatchState as getIdentityMatchStateImpl,
  hasAdminIdentityOnReg,
  needsIdentityWorkflowAction,
  submitUserIdentity as submitUserIdentityImpl,
} from './RegistrationIdentityService';
import { parseRequestedMemberId } from '../utils/requestedMemberId';

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
}

export interface JoinRequestOptions {
  memberId?: number;
  playerProfile?: {
    firstName?: string;
    lastName?: string;
    nickname?: string;
    number?: number;
    position?: string;
    bio?: string;
  };
}

export class RegistrationService {
  static async getNextMemberId(): Promise<number> {
    const max = await prisma.player.aggregate({ _max: { memberId: true } });
    return (max._max.memberId ?? 0) + 1;
  }

  static async getNextTeamId(seasonId: string): Promise<number> {
    const max = await prisma.team.aggregate({
      where: { seasonId },
      _max: { id: true },
    });
    return (max._max.id ?? 0) + 1;
  }

  static async invalidateDivisionCaches(division: Division): Promise<void> {
    const season = await SeasonService.getActiveSeasonForDivision(division).catch(() => null);
    if (season) {
      await CacheService.del(CacheService.key('doc', division, 'teams', 'all', season.id));
    }
    await CacheService.invalidatePattern(`rt:doc:${division}:*`);
  }

  static async lockActiveDivision(userId: string, division: Division): Promise<void> {
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

  static async assertDivisionAccess(userId: string, division: Division): Promise<void> {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (user.activeDivision && user.activeDivision !== division) {
      throw new Error('אין גישה לטורניר זה — נרשמת לצד השני.');
    }
  }

  static async upsertSeasonRegistration(
    userId: string,
    seasonId: string,
    division: Division,
    status: SeasonRegistrationStatus
  ) {
    return prisma.seasonRegistration.upsert({
      where: { userId_seasonId: { userId, seasonId } },
      create: { userId, seasonId, division, status },
      update: { status, division },
    });
  }

  /** After cancel/reject of join or creation, restore season registration unless already active. */
  private static async restoreRegistrationStatusAfterCancel(
    userId: string,
    seasonId: string,
    division: Division
  ): Promise<void> {
    const reg = await prisma.seasonRegistration.findUnique({
      where: { userId_seasonId: { userId, seasonId } },
    });
    if (reg?.status === SeasonRegistrationStatus.active) {
      return;
    }

    const hasAdminIdentity = hasAdminIdentityOnReg(reg);
    const nextStatus = hasAdminIdentity
      ? SeasonRegistrationStatus.invoice_assigned
      : SeasonRegistrationStatus.none;
    await this.upsertSeasonRegistration(userId, seasonId, division, nextStatus);
  }

  static async cancelPendingRegistrationRequest(userId: string, division: Division) {
    const season = await SeasonService.getActiveSeasonForDivision(division);
    await this.assertDivisionAccess(userId, division);

    const [join, creation, transfer] = await Promise.all([
      prisma.teamJoinRequest.findFirst({
        where: {
          userId,
          seasonId: season.id,
          status: { in: [RequestStatus.pending, RequestStatus.owner_approved] },
        },
      }),
      prisma.teamCreationRequest.findFirst({
        where: { userId, seasonId: season.id, status: RequestStatus.pending },
      }),
      prisma.teamTransferRequest.findFirst({
        where: { userId, seasonId: season.id, status: RequestStatus.pending },
      }),
    ]);

    if (!join && !creation && !transfer) {
      throw new Error('אין בקשה פעילה לביטול');
    }

    await prisma.$transaction(async (tx) => {
      if (join) {
        await tx.teamJoinRequest.update({
          where: { id: join.id },
          data: { status: RequestStatus.invalidated },
        });
      }
      if (creation) {
        await tx.teamCreationRequest.update({
          where: { id: creation.id },
          data: { status: RequestStatus.invalidated },
        });
      }
      if (transfer) {
        await tx.teamTransferRequest.update({
          where: { id: transfer.id },
          data: { status: RequestStatus.invalidated },
        });
      }

      const reg = await tx.seasonRegistration.findUnique({
        where: { userId_seasonId: { userId, seasonId: season.id } },
      });
      // Legacy pre-receipt-first rows used join_pending; receipt-first keeps active.
      if (reg?.status === SeasonRegistrationStatus.join_pending) {
        const hasAdminIdentity = hasAdminIdentityOnReg(reg);
        const nextStatus = hasAdminIdentity
          ? SeasonRegistrationStatus.invoice_assigned
          : SeasonRegistrationStatus.none;
        await tx.seasonRegistration.upsert({
          where: { userId_seasonId: { userId, seasonId: season.id } },
          create: { userId, seasonId: season.id, division, status: nextStatus },
          update: { status: nextStatus, division },
        });
      }
    });

    return this.getSummary(userId, division);
  }

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
      getIdentityMatchStateImpl(userId, season.id),
    ]);

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
    };
  }

  /** Persist legacy mapping JSON so profile/auth reflect roster without CSV import. */
  private static async linkUserToRoster(
    userId: string,
    teamId: number,
    memberId: number,
    playerFields?: {
      firstName: string;
      lastName: string;
      nickname: string;
      number: number;
      position?: string;
    }
  ) {
    await prisma.user.update({
      where: { id: userId },
      data: {
        mappedPlayerInfo: toInputJson({
          teamId,
          memberId,
          status: 'approved',
        }),
        ...(playerFields
          ? {
              playerProfile: toInputJson({
                firstName: playerFields.firstName,
                lastName: playerFields.lastName,
                nickname: playerFields.nickname,
                number: playerFields.number,
                position: playerFields.position ?? '',
              }),
            }
          : {}),
      },
    });
  }


  static async getIdentityMatchState(userId: string, seasonId: string) {
    return getIdentityMatchStateImpl(userId, seasonId);
  }

  static async assertMatchedIdentityForApproval(userId: string, seasonId: string) {
    return assertMatchedIdentityForApproval(userId, seasonId);
  }

  static async assignAdminIdentity(
    adminId: string,
    userId: string,
    seasonId: string,
    personalId: string,
    birthYear: string | number
  ) {
    return assignAdminIdentityImpl(
      adminId,
      userId,
      seasonId,
      personalId,
      birthYear,
      (uid, div) => this.lockActiveDivision(uid, div)
    );
  }

  static async submitUserIdentity(
    userId: string,
    personalId: string,
    birthYear: string | number,
    division: Division
  ) {
    return submitUserIdentityImpl(userId, personalId, birthYear, division, {
      assertDivisionAccess: (uid, div) => this.assertDivisionAccess(uid, div),
      lockActiveDivision: (uid, div) => this.lockActiveDivision(uid, div),
    });
  }

  /** @deprecated use submitUserIdentity */
  static async redeemInvoice(userId: string, code: string, division: Division) {
    throw new Error('מספר חשבונית אינו בשימוש — הזן תעודת זהות ושנת לידה');
  }

  /** @deprecated use assignAdminIdentity */
  static async assignInvoice(
    adminId: string,
    userId: string,
    seasonId: string,
    _invoiceNumber: string
  ) {
    void adminId;
    void userId;
    void seasonId;
    throw new Error('הקצאת חשבונית אינה בשימוש — השתמש בתעודת זהות ושנת לידה');
  }

  /** @deprecated use searchUsersForIdentity */
  static async searchUsersForInvoice(seasonId: string, query: string, limit = 20) {
    return this.searchUsersForIdentity(seasonId, query, limit);
  }

  static async assertRegistrationActiveForRequest(
    userId: string,
    seasonId: string
  ): Promise<void> {
    const reg = await prisma.seasonRegistration.findUnique({
      where: { userId_seasonId: { userId, seasonId } },
    });
    if (reg?.status !== SeasonRegistrationStatus.active) {
      throw new Error('הזן תעודת זהות ושנת לידה בפרופיל לפני שליחת בקשה');
    }
    await assertMatchedIdentityForApproval(userId, seasonId);
  }

  static async submitTeamCreation(
    userId: string,
    division: Division,
    teamName: string,
    description = ''
  ) {
    const { teamName: safeName, description: safeDesc } = sanitizeTeamCreationFields(
      teamName,
      description
    );
    const season = await SeasonService.getActiveSeasonForDivision(division);
    await this.assertDivisionAccess(userId, division);
    await this.assertRegistrationActiveForRequest(userId, season.id);
    await this.lockActiveDivision(userId, division);

    const pending = await prisma.teamCreationRequest.findFirst({
      where: { userId, seasonId: season.id, status: RequestStatus.pending },
    });
    if (pending) {
      throw new Error('יש לך כבר בקשת הקמת קבוצה ממתינה. בטל אותה לפני שליחת בקשה חדשה.');
    }

    const pendingJoin = await prisma.teamJoinRequest.findFirst({
      where: {
        userId,
        seasonId: season.id,
        status: { in: [RequestStatus.pending, RequestStatus.owner_approved] },
      },
    });
    if (pendingJoin) {
      throw new Error('יש לך בקשת הצטרפות ממתינה. בטל אותה לפני בקשת הקמת קבוצה.');
    }

    const onRoster = await prisma.player.findFirst({
      where: { userId, seasonId: season.id, active: true },
    });
    if (onRoster) {
      throw new Error('אתה כבר בסגל. השתמש בבקשת העברה לשינוי קבוצה.');
    }

    return prisma.$transaction(async (tx) => {
      await tx.teamJoinRequest.updateMany({
        where: {
          userId,
          seasonId: season.id,
          status: { in: [RequestStatus.pending, RequestStatus.owner_approved] },
        },
        data: { status: RequestStatus.invalidated },
      });

      const req = await tx.teamCreationRequest.create({
        data: {
          userId,
          seasonId: season.id,
          teamName: safeName,
          description: safeDesc,
          status: RequestStatus.pending,
        },
      });

      await tx.seasonRegistration.upsert({
        where: { userId_seasonId: { userId, seasonId: season.id } },
        create: {
          userId,
          seasonId: season.id,
          division,
          status: SeasonRegistrationStatus.active,
        },
        update: { division },
      });

      return req;
    });
  }

  static async approveTeamCreation(requestId: string, approve: boolean) {
    const req = await prisma.teamCreationRequest.findUniqueOrThrow({
      where: { id: requestId },
      include: { season: true, user: true },
    });

    if (req.status !== RequestStatus.pending) {
      throw new Error('הבקשה כבר טופלה');
    }

    if (!approve) {
      await prisma.teamCreationRequest.update({
        where: { id: requestId },
        data: { status: RequestStatus.rejected },
      });
      await this.restoreRegistrationStatusAfterCancel(
        req.userId,
        req.seasonId,
        req.season.division
      );
      return null;
    }

    const reg = await prisma.seasonRegistration.findUnique({
      where: { userId_seasonId: { userId: req.userId, seasonId: req.seasonId } },
    });
    if (reg?.status !== SeasonRegistrationStatus.active) {
      throw new Error('לא ניתן לאשר הקמת קבוצה לפני פדיון קוד תשלום (סטטוס רישום לא פעיל)');
    }
    await assertMatchedIdentityForApproval(req.userId, req.seasonId);

    const teamId = await this.getNextTeamId(req.seasonId);
    const memberId = await this.getNextMemberId();

    const team = await prisma.$transaction(async (tx) => {
      const created = await tx.team.create({
        data: {
          id: teamId,
          seasonId: req.seasonId,
          name: req.teamName,
          description: req.description || '',
          status: TeamStatus.active,
          ownerUserId: req.userId,
        },
      });

      await tx.player.create({
        data: {
          memberId,
          teamId,
          seasonId: req.seasonId,
          userId: req.userId,
          firstName: req.user.displayName.split(' ')[0] || 'בעלים',
          lastName: req.user.displayName.split(' ').slice(1).join(' ') || '',
          nickname: req.user.displayName,
          number: 1,
          squadRole: SquadRole.captain,
          isCaptain: true,
        },
      });

      await tx.user.update({
        where: { id: req.userId },
        data: {
          mappedPlayerInfo: toInputJson({
            teamId,
            memberId,
            status: 'approved',
          }),
          playerProfile: toInputJson({
            firstName: req.user.displayName.split(' ')[0] || 'בעלים',
            lastName: req.user.displayName.split(' ').slice(1).join(' ') || '',
            nickname: req.user.displayName,
            number: 1,
            position: '',
          }),
        },
      });

      await tx.teamCreationRequest.update({
        where: { id: requestId },
        data: { status: RequestStatus.approved },
      });

      return created;
    });

    await this.invalidateDivisionCaches(req.season.division);
    return team;
  }

  static async submitJoinRequest(
    userId: string,
    division: Division,
    teamId: number,
    options?: JoinRequestOptions
  ) {
    const season = await SeasonService.getActiveSeasonForDivision(division);
    await this.assertDivisionAccess(userId, division);
    await this.assertRegistrationActiveForRequest(userId, season.id);
    await this.lockActiveDivision(userId, division);

    const onRoster = await prisma.player.findFirst({
      where: { userId, seasonId: season.id, active: true },
    });
    if (onRoster) {
      throw new Error('אתה כבר בסגל. השתמש בבקשת העברה.');
    }

    const team = await prisma.team.findFirst({
      where: { seasonId: season.id, id: teamId, status: TeamStatus.active },
    });
    if (!team) {
      throw new Error('הקבוצה לא נמצאה או אינה פעילה');
    }

    if (options?.memberId != null) {
      const slot = await prisma.player.findFirst({
        where: {
          memberId: options.memberId,
          teamId,
          seasonId: season.id,
          active: true,
        },
      });
      if (!slot) {
        throw new Error('שחקן לא נמצא בקבוצה');
      }
      if (slot.userId && slot.userId !== userId) {
        throw new Error('שחקן זה כבר משויך למשתמש אחר');
      }

      const othersPending = await prisma.teamJoinRequest.findMany({
        where: {
          seasonId: season.id,
          teamId,
          userId: { not: userId },
          status: { in: [RequestStatus.pending, RequestStatus.owner_approved] },
        },
        include: { user: { select: { playerProfile: true } } },
      });
      for (const pj of othersPending) {
        const prof = pj.user.playerProfile as Record<string, unknown> | null;
        if (parseRequestedMemberId(prof?.requestedMemberId) === options.memberId) {
          throw new Error('שחקן זה כבר מבוקש בבקשת הצטרפות אחרת');
        }
      }
    }

    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentReject = await prisma.teamJoinRequest.findFirst({
      where: {
        userId,
        seasonId: season.id,
        teamId,
        status: RequestStatus.rejected,
        createdAt: { gt: dayAgo },
      },
    });
    if (recentReject) {
      throw new Error('ניתן לבקש שוב את אותה קבוצה רק לאחר יום מהדחייה האחרונה');
    }

    const pendingCreation = await prisma.teamCreationRequest.findFirst({
      where: { userId, seasonId: season.id, status: RequestStatus.pending },
    });
    if (pendingCreation) {
      throw new Error('יש לך בקשת הקמת קבוצה ממתינה. בטל אותה לפני בקשת הצטרפות.');
    }

    return prisma.$transaction(async (tx) => {
      await tx.teamJoinRequest.updateMany({
        where: {
          userId,
          seasonId: season.id,
          status: { in: [RequestStatus.pending, RequestStatus.owner_approved] },
        },
        data: { status: RequestStatus.invalidated },
      });

      await tx.teamCreationRequest.updateMany({
        where: {
          userId,
          seasonId: season.id,
          status: RequestStatus.pending,
        },
        data: { status: RequestStatus.invalidated },
      });

      const req = await tx.teamJoinRequest.create({
        data: {
          userId,
          seasonId: season.id,
          teamId,
          status: RequestStatus.pending,
        },
      });

      if (options?.memberId != null) {
        const othersPending = await tx.teamJoinRequest.findMany({
          where: {
            seasonId: season.id,
            teamId,
            userId: { not: userId },
            status: { in: [RequestStatus.pending, RequestStatus.owner_approved] },
            NOT: { id: req.id },
          },
          include: { user: { select: { playerProfile: true } } },
        });
        for (const pj of othersPending) {
          const prof = pj.user.playerProfile as Record<string, unknown> | null;
          if (parseRequestedMemberId(prof?.requestedMemberId) === options.memberId) {
            throw new Error('שחקן זה כבר מבוקש בבקשת הצטרפות אחרת');
          }
        }
      }

      await tx.seasonRegistration.upsert({
        where: { userId_seasonId: { userId, seasonId: season.id } },
        create: {
          userId,
          seasonId: season.id,
          division,
          status: SeasonRegistrationStatus.active,
        },
        update: { division },
      });

      const profilePayload: Record<string, unknown> = {};
      if (options?.memberId != null) {
        profilePayload.requestedMemberId = options.memberId;
      } else {
        profilePayload.requestedMemberId = null;
      }
      if (options?.playerProfile) {
        Object.assign(profilePayload, options.playerProfile);
      }

      const existing = await tx.user.findUnique({
        where: { id: userId },
        select: { playerProfile: true },
      });
      const existingProfile =
        (existing?.playerProfile as Record<string, unknown> | null) ?? {};
      const merged = { ...existingProfile, ...profilePayload };
      if (merged.requestedMemberId == null) {
        delete merged.requestedMemberId;
      }
      await tx.user.update({
        where: { id: userId },
        data: { playerProfile: toInputJson(merged) },
      });

      return req;
    });
  }

  static async ownerReviewJoin(
    ownerId: string,
    requestId: string,
    approve: boolean
  ) {
    const req = await prisma.teamJoinRequest.findUniqueOrThrow({
      where: { id: requestId },
      include: { season: true, team: true },
    });

    const team = await prisma.team.findFirstOrThrow({
      where: { seasonId: req.seasonId, id: req.teamId },
    });

    if (team.ownerUserId !== ownerId) {
      throw new Error('רק בעלים הקבוצה יכול לאשר בקשה זו');
    }

    if (req.status !== RequestStatus.pending) {
      throw new Error('הבקשה אינה ממתינה לאישור בעלים');
    }

    await prisma.teamJoinRequest.update({
      where: { id: requestId },
      data: {
        status: approve ? RequestStatus.owner_approved : RequestStatus.rejected,
        ownerReviewedAt: new Date(),
        ownerReviewedBy: ownerId,
      },
    });

    if (!approve) {
      await this.restoreRegistrationStatusAfterCancel(
        req.userId,
        req.seasonId,
        req.season.division
      );
    }
  }

  static async adminReviewJoin(requestId: string, adminId: string, approve: boolean) {
    const req = await prisma.teamJoinRequest.findUniqueOrThrow({
      where: { id: requestId },
      include: {
        season: true,
        user: { select: { id: true, displayName: true, playerProfile: true } },
      },
    });

    if (req.status !== RequestStatus.owner_approved) {
      throw new Error('הבקשה חייבת לעבור אישור בעלים לפני אישור מנהל');
    }

    if (!approve) {
      await prisma.teamJoinRequest.update({
        where: { id: requestId },
        data: {
          status: RequestStatus.rejected,
          adminReviewedAt: new Date(),
          adminReviewedBy: adminId,
        },
      });
      await this.restoreRegistrationStatusAfterCancel(
        req.userId,
        req.seasonId,
        req.season.division
      );
      return;
    }

    const reg = await prisma.seasonRegistration.findUnique({
      where: { userId_seasonId: { userId: req.userId, seasonId: req.seasonId } },
    });
    if (reg?.status !== SeasonRegistrationStatus.active) {
      throw new Error('לא ניתן להוסיף לסגל לפני פדיון קוד תשלום (סטטוס רישום לא פעיל)');
    }
    await assertMatchedIdentityForApproval(req.userId, req.seasonId);

    const profile = (req.user.playerProfile as Record<string, unknown> | null) ?? {};
    const requestedMemberId = parseRequestedMemberId(profile.requestedMemberId);

    const firstName = String(profile.firstName ?? req.user.displayName).slice(0, 50);
    const lastName = String(profile.lastName ?? '').slice(0, 50);
    const nickname = String(profile.nickname ?? req.user.displayName).slice(0, 50);
    const number = Number(profile.number) || 99;
    const position = String(profile.position ?? '').slice(0, 30);

    let linkFirstName = firstName;
    let linkLastName = lastName;
    let linkNickname = nickname;
    let linkNumber = number;
    let linkPosition = position;

    await prisma.$transaction(async (tx) => {
      let memberId: number;

      if (requestedMemberId != null) {
        const slot = await tx.player.findFirst({
          where: {
            memberId: requestedMemberId,
            teamId: req.teamId,
            seasonId: req.seasonId,
            active: true,
          },
        });
        if (!slot) {
          throw new Error('שחקן מבוקש לא נמצא בקבוצה');
        }
        if (slot.userId && slot.userId !== req.userId) {
          throw new Error('שחקן זה כבר משויך למשתמש אחר');
        }
        await tx.player.update({
          where: { memberId: requestedMemberId },
          data: { userId: req.userId },
        });
        memberId = requestedMemberId;
        linkFirstName = slot.firstName;
        linkLastName = slot.lastName;
        linkNickname = slot.nickname;
        linkNumber = slot.number;
        linkPosition = slot.position;
      } else {
        memberId = await this.getNextMemberId();
        await tx.player.create({
          data: {
            memberId,
            teamId: req.teamId,
            seasonId: req.seasonId,
            userId: req.userId,
            firstName,
            lastName,
            nickname,
            number,
            position,
          },
        });
      }

      await tx.user.update({
        where: { id: req.userId },
        data: {
          mappedPlayerInfo: toInputJson({
            teamId: req.teamId,
            memberId,
            status: 'approved',
          }),
          playerProfile: toInputJson({
            firstName: linkFirstName,
            lastName: linkLastName,
            nickname: linkNickname,
            number: linkNumber,
            position: linkPosition,
          }),
        },
      });

      await tx.teamJoinRequest.update({
        where: { id: requestId },
        data: {
          status: RequestStatus.approved,
          adminReviewedAt: new Date(),
          adminReviewedBy: adminId,
        },
      });
    });

    await this.invalidateDivisionCaches(req.season.division);
  }

  static async submitTransfer(
    userId: string,
    division: Division,
    toTeamId: number
  ) {
    const season = await SeasonService.getActiveSeasonForDivision(division);
    await this.assertDivisionAccess(userId, division);

    const player = await prisma.player.findFirst({
      where: { userId, seasonId: season.id, active: true },
    });
    if (!player) {
      throw new Error('רק שחקנים בסגל יכולים לבקש העברה');
    }

    const target = await prisma.team.findFirst({
      where: { seasonId: season.id, id: toTeamId, status: TeamStatus.active },
    });
    if (!target) {
      throw new Error('קבוצת היעד לא נמצאה');
    }
    if (target.id === player.teamId) {
      throw new Error('כבר נמצא בקבוצה זו');
    }

    const pending = await prisma.teamTransferRequest.findFirst({
      where: { userId, seasonId: season.id, status: RequestStatus.pending },
    });
    if (pending) {
      throw new Error('יש לך כבר בקשת העברה ממתינה');
    }

    return prisma.teamTransferRequest.create({
      data: {
        userId,
        seasonId: season.id,
        fromTeamId: player.teamId,
        toTeamId,
        status: RequestStatus.pending,
      },
    });
  }

  static async adminReviewTransfer(requestId: string, adminId: string, approve: boolean) {
    const req = await prisma.teamTransferRequest.findUniqueOrThrow({
      where: { id: requestId },
      include: { season: true },
    });

    if (req.status !== RequestStatus.pending) {
      throw new Error('הבקשה כבר טופלה');
    }

    if (!approve) {
      await prisma.teamTransferRequest.update({
        where: { id: requestId },
        data: { status: RequestStatus.rejected },
      });
      return;
    }

    const player = await prisma.player.findFirst({
      where: {
        userId: req.userId,
        seasonId: req.seasonId,
        teamId: req.fromTeamId,
        active: true,
      },
    });
    if (!player) {
      throw new Error('שחקן לא נמצא בקבוצת המקור');
    }

    await prisma.player.update({
      where: { memberId: player.memberId },
      data: { teamId: req.toTeamId, squadRole: null, isCaptain: false },
    });

    await prisma.user.update({
      where: { id: req.userId },
      data: {
        mappedPlayerInfo: toInputJson({
          teamId: req.toTeamId,
          memberId: player.memberId,
          status: 'approved',
        }),
      },
    });

    await prisma.teamTransferRequest.update({
      where: { id: requestId },
      data: { status: RequestStatus.approved },
    });

    await this.invalidateDivisionCaches(req.season.division);
  }

  private static assertFootballLineup(
    merged: { memberId: number; squadRole: SquadRole | null }[]
  ): void {
    const starting = merged.filter((p) => p.squadRole !== null);
    const gk = starting.filter((p) => p.squadRole === SquadRole.goalkeeper).length;
    const outfield = starting.filter(
      (p) =>
        p.squadRole === SquadRole.captain ||
        p.squadRole === SquadRole.attack ||
        p.squadRole === SquadRole.defense
    ).length;
    if (gk > 1) {
      throw new Error('ניתן להגדיר שוער אחד בהרכב פתיחה');
    }
    if (outfield > 5) {
      throw new Error('ניתן להגדיר עד 5 שחקני שדה בהרכב פתיחה');
    }
    if (starting.length > 6) {
      throw new Error('הרכב פתיחה: עד 5 שחקני שדה ושוער אחד');
    }
  }

  static async setSquadRoles(
    actorId: string,
    teamId: number,
    division: Division,
    roles: { memberId: number; squadRole: SquadRole | null }[]
  ) {
    const season = await SeasonService.getActiveSeasonForDivision(division);
    const team = await prisma.team.findFirstOrThrow({
      where: { seasonId: season.id, id: teamId },
    });

    const isOwner = team.ownerUserId === actorId;
    let isCaptain = false;
    if (!isOwner) {
      const captainRow = await prisma.player.findFirst({
        where: {
          userId: actorId,
          teamId,
          seasonId: season.id,
          isCaptain: true,
          active: true,
        },
      });
      isCaptain = !!captainRow;
    }
    if (!isOwner && !isCaptain) {
      throw new Error('רק בעלים או קפטן הקבוצה יכול לערוך תפקידים');
    }

    const captains = roles.filter((r) => r.squadRole === SquadRole.captain);
    if (captains.length > 1) {
      throw new Error('ניתן להגדיר קפטן אחד בלבד');
    }

    if (season.scoringMode === ScoringMode.football) {
      const roster = await prisma.player.findMany({
        where: { seasonId: season.id, teamId, active: true },
        select: { memberId: true, squadRole: true },
      });
      const roleMap = new Map(roster.map((p) => [p.memberId, p.squadRole]));
      for (const { memberId, squadRole } of roles) {
        roleMap.set(memberId, squadRole);
      }
      const merged = [...roleMap.entries()].map(([memberId, squadRole]) => ({
        memberId,
        squadRole,
      }));
      this.assertFootballLineup(merged);
    }

    await prisma.$transaction(async (tx) => {
      if (captains.length === 1) {
        await tx.player.updateMany({
          where: {
            seasonId: season.id,
            teamId,
            squadRole: SquadRole.captain,
            NOT: { memberId: captains[0].memberId },
          },
          data: { squadRole: null, isCaptain: false },
        });
      }

      for (const { memberId, squadRole } of roles) {
        await tx.player.updateMany({
          where: { seasonId: season.id, teamId, memberId, active: true },
          data: {
            squadRole,
            isCaptain: squadRole === SquadRole.captain,
          },
        });
      }
    });

    await this.invalidateDivisionCaches(division);
  }

  static async addOwnerToRoster(ownerId: string, teamId: number, division: Division) {
    const season = await SeasonService.getActiveSeasonForDivision(division);
    const team = await prisma.team.findFirstOrThrow({
      where: { seasonId: season.id, id: teamId },
    });

    if (team.ownerUserId !== ownerId) {
      throw new Error('רק בעלים הקבוצה יכול להוסיף את עצמו לסגל');
    }

    const existing = await prisma.player.findFirst({
      where: { userId: ownerId, seasonId: season.id, active: true },
    });
    if (existing) {
      throw new Error('כבר רשום בסגל');
    }

    const user = await prisma.user.findUniqueOrThrow({ where: { id: ownerId } });
    const memberId = await this.getNextMemberId();

    await prisma.player.create({
      data: {
        memberId,
        teamId,
        seasonId: season.id,
        userId: ownerId,
        firstName: user.displayName.split(' ')[0] || 'בעלים',
        lastName: user.displayName.split(' ').slice(1).join(' ') || '',
        nickname: user.displayName,
        number: 1,
        squadRole: SquadRole.captain,
        isCaptain: true,
      },
    });

    await this.linkUserToRoster(ownerId, teamId, memberId, {
      firstName: user.displayName.split(' ')[0] || 'בעלים',
      lastName: user.displayName.split(' ').slice(1).join(' ') || '',
      nickname: user.displayName,
      number: 1,
      position: '',
    });

    await this.invalidateDivisionCaches(division);
    return memberId;
  }

  static async listPendingJoinsForOwner(ownerId: string, teamId: number, division: Division) {
    const season = await SeasonService.getActiveSeasonForDivision(division);
    const team = await prisma.team.findFirst({
      where: { seasonId: season.id, id: teamId, ownerUserId: ownerId },
    });
    if (!team) {
      throw new Error('אין הרשאת בעלים לקבוצה זו');
    }
    return prisma.teamJoinRequest.findMany({
      where: {
        seasonId: season.id,
        teamId,
        status: RequestStatus.pending,
      },
      include: {
        user: { select: { id: true, displayName: true, email: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
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

  static async listPendingWorkflows(seasonId?: string) {
    const season = seasonId
      ? await prisma.season.findUniqueOrThrow({ where: { id: seasonId } })
      : await SeasonService.getActiveSeason(Division.boys);

    const [creations, joins, transfers, awaitingInvoice] = await Promise.all([
      prisma.teamCreationRequest.findMany({
        where: { seasonId: season.id, status: RequestStatus.pending },
        include: {
          user: { select: { id: true, displayName: true, email: true, activeDivision: true } },
        },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.teamJoinRequest.findMany({
        where: {
          seasonId: season.id,
          status: { in: [RequestStatus.pending, RequestStatus.owner_approved] },
        },
        include: {
          user: { select: { id: true, displayName: true, email: true } },
          team: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.teamTransferRequest.findMany({
        where: { seasonId: season.id, status: RequestStatus.pending },
        include: {
          user: { select: { id: true, displayName: true, email: true } },
        },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.seasonRegistration.findMany({
        where: {
          seasonId: season.id,
          status: {
            in: [
              SeasonRegistrationStatus.awaiting_invoice,
              SeasonRegistrationStatus.join_pending, // legacy pre-receipt-first
              SeasonRegistrationStatus.invoice_assigned,
              SeasonRegistrationStatus.active, // receipt-first: user submitted invoice in profile
            ],
          },
        },
        include: {
          user: { select: { id: true, displayName: true, email: true, activeDivision: true } },
        },
      }),
    ]);

    const joinByUserId = new Map(joins.map((j) => [j.userId, j]));

    const workflowUserIds = [
      ...new Set([
        ...creations.map((c) => c.userId),
        ...joins.map((j) => j.userId),
        ...transfers.map((t) => t.userId),
      ]),
    ];
    const workflowRegs =
      workflowUserIds.length > 0
        ? await prisma.seasonRegistration.findMany({
            where: { seasonId: season.id, userId: { in: workflowUserIds } },
            select: { userId: true, status: true },
          })
        : [];
    const regStatusByUser = new Map(workflowRegs.map((r) => [r.userId, r.status]));

    const workflowIdentityStates = await Promise.all(
      workflowUserIds.map(async (userId) => {
        const state = await getIdentityMatchStateImpl(userId, season.id);
        return [userId, state] as const;
      })
    );
    const identityStateByUser = new Map(workflowIdentityStates);

    const enrichWorkflowIdentity = (userId: string) => {
      const state = identityStateByUser.get(userId);
      return {
        submittedIdentityMasked: state?.submittedIdentityMasked ?? null,
        submittedBirthYear: state?.submittedBirthYear ?? null,
        assignedBirthYear: state?.assignedBirthYear ?? null,
        identityMatched: state?.identityMatched ?? false,
      };
    };

    const creationsEnriched = creations.map((c) => ({
      ...c,
      registrationStatus: regStatusByUser.get(c.userId) ?? SeasonRegistrationStatus.none,
      ...enrichWorkflowIdentity(c.userId),
    }));
    const joinsEnriched = joins.map((j) => ({
      ...j,
      registrationStatus: regStatusByUser.get(j.userId) ?? SeasonRegistrationStatus.none,
      ...enrichWorkflowIdentity(j.userId),
    }));
    const transfersEnriched = transfers.map((t) => ({
      ...t,
      registrationStatus: regStatusByUser.get(t.userId) ?? SeasonRegistrationStatus.none,
    }));

    const awaitingIdentityEnriched = (
      await Promise.all(
        awaitingInvoice.map(async (reg) => {
          const join = joinByUserId.get(reg.userId);
          const matchState = await getIdentityMatchStateImpl(reg.userId, season.id);
          return {
            user: reg.user,
            status: reg.status,
            invoiceAlert: reg.invoiceAlert,
            pendingTeamName: join?.team?.name ?? null,
            joinStatus: join?.status ?? null,
            hasAdminAssignment: matchState.hasAdminAssignment,
            submittedIdentityMasked: matchState.submittedIdentityMasked,
            submittedBirthYear: matchState.submittedBirthYear,
            assignedBirthYear: matchState.assignedBirthYear,
            identityMatched: matchState.identityMatched,
          };
        })
      )
    ).filter((row) =>
      needsIdentityWorkflowAction(
        row.status,
        row.invoiceAlert,
        row.identityMatched
      )
    );

    return {
      season,
      creations: creationsEnriched,
      joins: joinsEnriched,
      transfers: transfersEnriched,
      awaitingIdentity: awaitingIdentityEnriched,
    };
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
