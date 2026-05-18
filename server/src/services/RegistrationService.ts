import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import {
  Division,
  RequestStatus,
  SeasonRegistrationStatus,
  SquadRole,
  TeamStatus,
} from '@prisma/client';
import { prisma } from '../lib/prisma';
import { CacheService } from './CacheService';
import { InvoiceRateLimitService } from './InvoiceRateLimitService';
import { SeasonService } from './SeasonService';

export type WorkflowDivision = Division;

export interface RegistrationSummary {
  seasonId: string;
  division: Division;
  status: SeasonRegistrationStatus;
  activeDivision: Division | null;
  pendingJoin: { id: string; teamId: number; status: RequestStatus } | null;
  pendingCreation: { id: string; teamName: string; status: RequestStatus } | null;
  pendingTransfer: { id: string; fromTeamId: number; toTeamId: number; status: RequestStatus } | null;
  onRoster: { teamId: number; memberId: number } | null;
  ownedTeamId: number | null;
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
    const season = await SeasonService.getActiveSeason(division).catch(() => null);
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

  static async getSummary(userId: string, division: Division): Promise<RegistrationSummary> {
    const season = await SeasonService.getActiveSeason(division);
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });

    const [reg, join, creation, transfer, player, ownedTeam] = await Promise.all([
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
    ]);

    return {
      seasonId: season.id,
      division,
      status: reg?.status ?? SeasonRegistrationStatus.none,
      activeDivision: user.activeDivision,
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
      onRoster: player ? { teamId: player.teamId, memberId: player.memberId } : null,
      ownedTeamId: ownedTeam?.id ?? null,
    };
  }

  static generateInvoiceCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    const bytes = crypto.randomBytes(8);
    for (let i = 0; i < 8; i++) {
      code += chars[bytes[i] % chars.length];
    }
    return code;
  }

  static async assignInvoice(
    adminId: string,
    userId: string,
    seasonId: string
  ): Promise<{ plainCode: string }> {
    const season = await prisma.season.findUniqueOrThrow({ where: { id: seasonId } });
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });

    if (user.activeDivision && user.activeDivision !== season.division) {
      throw new Error('לא ניתן להקצות קוד תשלום לטורניר שונה מהצד שנבחר על ידי המשתמש');
    }

    const existingUnused = await prisma.invoiceCode.findFirst({
      where: { seasonId, assignedUserId: userId, redeemedAt: null },
    });
    if (existingUnused) {
      throw new Error('למשתמש כבר הוקצה קוד שלא נפדה לעונה זו');
    }

    const plainCode = this.generateInvoiceCode();
    const codeHash = await bcrypt.hash(plainCode, 10);

    await prisma.$transaction(async (tx) => {
      await tx.invoiceCode.create({
        data: {
          seasonId,
          codeHash,
          assignedUserId: userId,
          createdById: adminId,
        },
      });
      await tx.seasonRegistration.upsert({
        where: { userId_seasonId: { userId, seasonId } },
        create: {
          userId,
          seasonId,
          division: season.division,
          status: SeasonRegistrationStatus.invoice_assigned,
        },
        update: { status: SeasonRegistrationStatus.invoice_assigned, division: season.division },
      });
    });

    if (!user.activeDivision) {
      await prisma.user.update({
        where: { id: userId },
        data: { activeDivision: season.division },
      });
    }

    return { plainCode };
  }

  static async redeemInvoice(userId: string, code: string, division: Division): Promise<void> {
    const season = await SeasonService.getActiveSeason(division);
    const normalized = code.trim().toUpperCase();

    if (!normalized) {
      throw new Error('יש להזין קוד תשלום');
    }

    if (await InvoiceRateLimitService.isLocked(userId, season.id)) {
      throw new Error('נחסמת עד מחר בשל ניסיונות שגויים רבים. נסה שוב מחר.');
    }

    const invoice = await prisma.invoiceCode.findFirst({
      where: { seasonId: season.id, assignedUserId: userId, redeemedAt: null },
      orderBy: { createdAt: 'desc' },
    });

    if (!invoice) {
      throw new Error('אין קוד תשלום מוקצה לחשבון שלך לעונה זו');
    }

    const match = await bcrypt.compare(normalized, invoice.codeHash);
    if (!match) {
      const attempts = await InvoiceRateLimitService.recordFailedAttempt(userId, season.id);
      const remaining = Math.max(0, 5 - attempts);
      if (remaining === 0) {
        throw new Error('נחסמת עד מחר בשל ניסיונות שגויים רבים.');
      }
      throw new Error(`קוד שגוי. נותרו ${remaining} ניסיונים היום.`);
    }

    await prisma.$transaction(async (tx) => {
      await tx.invoiceCode.update({
        where: { id: invoice.id },
        data: { redeemedAt: new Date() },
      });
      await tx.seasonRegistration.upsert({
        where: { userId_seasonId: { userId, seasonId: season.id } },
        create: {
          userId,
          seasonId: season.id,
          division: season.division,
          status: SeasonRegistrationStatus.active,
          redeemedAt: new Date(),
        },
        update: {
          status: SeasonRegistrationStatus.active,
          redeemedAt: new Date(),
          division: season.division,
        },
      });
    });

    await InvoiceRateLimitService.clearAttempts(userId, season.id);
  }

  static async submitTeamCreation(
    userId: string,
    division: Division,
    teamName: string,
    description = ''
  ) {
    const season = await SeasonService.getActiveSeason(division);
    await this.assertDivisionAccess(userId, division);
    await this.lockActiveDivision(userId, division);

    const pending = await prisma.teamCreationRequest.findFirst({
      where: { userId, seasonId: season.id, status: RequestStatus.pending },
    });
    if (pending) {
      throw new Error('יש לך כבר בקשת הקמת קבוצה ממתינה');
    }

    const onRoster = await prisma.player.findFirst({
      where: { userId, seasonId: season.id, active: true },
    });
    if (onRoster) {
      throw new Error('אתה כבר בסגל. השתמש בבקשת העברה לשינוי קבוצה.');
    }

    const req = await prisma.teamCreationRequest.create({
      data: {
        userId,
        seasonId: season.id,
        teamName: teamName.trim(),
        description: description.trim(),
        status: RequestStatus.pending,
      },
    });

    await this.upsertSeasonRegistration(
      userId,
      season.id,
      division,
      SeasonRegistrationStatus.join_pending
    );

    return req;
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
      return null;
    }

    const teamId = await this.getNextTeamId(req.seasonId);
    const memberId = await this.getNextMemberId();

    const team = await prisma.$transaction(async (tx) => {
      const created = await tx.team.create({
        data: {
          id: teamId,
          seasonId: req.seasonId,
          name: req.teamName,
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

      await tx.teamCreationRequest.update({
        where: { id: requestId },
        data: { status: RequestStatus.approved },
      });

      return created;
    });

    await this.invalidateDivisionCaches(req.season.division);
    return team;
  }

  static async submitJoinRequest(userId: string, division: Division, teamId: number) {
    const season = await SeasonService.getActiveSeason(division);
    await this.assertDivisionAccess(userId, division);
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

    await prisma.teamJoinRequest.updateMany({
      where: {
        userId,
        seasonId: season.id,
        status: { in: [RequestStatus.pending, RequestStatus.owner_approved] },
      },
      data: { status: RequestStatus.invalidated },
    });

    const req = await prisma.teamJoinRequest.create({
      data: {
        userId,
        seasonId: season.id,
        teamId,
        status: RequestStatus.pending,
      },
    });

    await this.upsertSeasonRegistration(
      userId,
      season.id,
      division,
      SeasonRegistrationStatus.join_pending
    );

    return req;
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
      return;
    }

    const reg = await prisma.seasonRegistration.findUnique({
      where: { userId_seasonId: { userId: req.userId, seasonId: req.seasonId } },
    });
    if (reg?.status !== SeasonRegistrationStatus.active) {
      throw new Error('לא ניתן להוסיף לסגל לפני פדיון קוד תשלום (סטטוס רישום לא פעיל)');
    }

    const memberId = await this.getNextMemberId();
    const profile = (req.user.playerProfile as Record<string, unknown> | null) ?? {};

    await prisma.$transaction(async (tx) => {
      await tx.player.create({
        data: {
          memberId,
          teamId: req.teamId,
          seasonId: req.seasonId,
          userId: req.userId,
          firstName: String(profile.firstName ?? req.user.displayName).slice(0, 50),
          lastName: String(profile.lastName ?? '').slice(0, 50),
          nickname: String(profile.nickname ?? req.user.displayName).slice(0, 50),
          number: Number(profile.number) || 99,
          position: String(profile.position ?? '').slice(0, 30),
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
    const season = await SeasonService.getActiveSeason(division);
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

    await prisma.teamTransferRequest.update({
      where: { id: requestId },
      data: { status: RequestStatus.approved },
    });

    await this.invalidateDivisionCaches(req.season.division);
  }

  static async setSquadRoles(
    ownerId: string,
    teamId: number,
    division: Division,
    roles: { memberId: number; squadRole: SquadRole | null }[]
  ) {
    const season = await SeasonService.getActiveSeason(division);
    const team = await prisma.team.findFirstOrThrow({
      where: { seasonId: season.id, id: teamId },
    });

    if (team.ownerUserId !== ownerId) {
      throw new Error('רק בעלים הקבוצה יכול לערוך תפקידים');
    }

    const captains = roles.filter((r) => r.squadRole === SquadRole.captain);
    if (captains.length > 1) {
      throw new Error('ניתן להגדיר קפטן אחד בלבד');
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
    const season = await SeasonService.getActiveSeason(division);
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

    await this.invalidateDivisionCaches(division);
    return memberId;
  }

  static async listPendingJoinsForOwner(ownerId: string, teamId: number, division: Division) {
    const season = await SeasonService.getActiveSeason(division);
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
    const season = await SeasonService.getActiveSeason(division);
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
              SeasonRegistrationStatus.join_pending,
            ],
          },
        },
        include: {
          user: { select: { id: true, displayName: true, email: true, activeDivision: true } },
        },
      }),
    ]);

    return { season, creations, joins, transfers, awaitingInvoice };
  }
}
