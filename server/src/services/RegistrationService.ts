import bcrypt from 'bcryptjs';
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
  classifyInvoiceMatch,
  INVOICE_ALERT_MISMATCH,
  INVOICE_ALERT_SIMILAR,
  INVOICE_ALERT_USER_DIFFERS_FROM_ADMIN,
  INVOICE_ALERT_USER_SIMILAR_TO_ADMIN,
  type InvoiceMatchKind,
} from '../utils/invoiceSimilarity';

export type WorkflowDivision = Division;

export interface RegistrationSummary {
  seasonId: string;
  division: Division;
  status: SeasonRegistrationStatus;
  activeDivision: Division | null;
  invoiceAlert: string | null;
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

    const unredeemedInvoice = await prisma.invoiceCode.findFirst({
      where: { seasonId, assignedUserId: userId, redeemedAt: null },
    });
    const nextStatus = unredeemedInvoice
      ? SeasonRegistrationStatus.invoice_assigned
      : SeasonRegistrationStatus.none;
    await this.upsertSeasonRegistration(userId, seasonId, division, nextStatus);
  }

  static async cancelPendingRegistrationRequest(userId: string, division: Division) {
    const season = await SeasonService.getActiveSeason(division);
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
        const unredeemedInvoice = await tx.invoiceCode.findFirst({
          where: { seasonId: season.id, assignedUserId: userId, redeemedAt: null },
        });
        const nextStatus = unredeemedInvoice
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
      invoiceAlert: reg?.invoiceAlert ?? null,
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

  /** Normalize receipt / invoice number (activation code = same value user enters on profile). */
  static normalizeInvoiceNumber(raw: string): string {
    const normalized = raw.trim().toUpperCase().replace(/[\s-]/g, '');
    if (!/^[A-Z0-9]{3,24}$/.test(normalized)) {
      throw new Error('מספר חשבונית חייב להיות אלפאנומרי (3–24 תווים, ללא רווחים)');
    }
    return normalized;
  }

  private static async assertInvoiceUniqueInSeason(
    seasonId: string,
    normalized: string,
    excludeInvoiceId?: string
  ): Promise<void> {
    const exactOther = await prisma.invoiceCode.findFirst({
      where: {
        seasonId,
        codeNormalized: normalized,
        ...(excludeInvoiceId ? { NOT: { id: excludeInvoiceId } } : {}),
      },
    });
    if (exactOther) {
      throw new Error('מספר חשבונית זה כבר הוקצה למשתמש אחר בעונה זו');
    }

    const seasonInvoices = await prisma.invoiceCode.findMany({
      where: {
        seasonId,
        redeemedAt: null,
        codeNormalized: null,
        ...(excludeInvoiceId ? { NOT: { id: excludeInvoiceId } } : {}),
      },
    });
    for (const inv of seasonInvoices) {
      if (await bcrypt.compare(normalized, inv.codeHash)) {
        throw new Error('מספר חשבונית זה כבר הוקצה למשתמש אחר בעונה זו');
      }
    }
  }

  private static async findSimilarInvoiceOwner(
    seasonId: string,
    normalized: string,
    excludeUserId: string
  ): Promise<{ userId: string; displayName: string; codeNormalized: string } | null> {
    const others = await prisma.invoiceCode.findMany({
      where: {
        seasonId,
        codeNormalized: { not: null },
        NOT: { assignedUserId: excludeUserId },
      },
      select: {
        codeNormalized: true,
        assignedUserId: true,
        assignedUser: { select: { displayName: true } },
      },
    });

    for (const row of others) {
      if (!row.codeNormalized) continue;
      const kind = classifyInvoiceMatch(normalized, row.codeNormalized);
      if (kind === 'exact' || kind === 'similar') {
        return {
          userId: row.assignedUserId,
          displayName: row.assignedUser.displayName,
          codeNormalized: row.codeNormalized,
        };
      }
    }
    return null;
  }

  private static async verifyAdminInvoiceAgainstUser(
    userId: string,
    seasonId: string,
    normalized: string
  ): Promise<{
    invoiceNumber: string;
    updated: boolean;
    verifyOnly: true;
    match: InvoiceMatchKind | 'unknown';
    userAlertSet: boolean;
    adminMessage: string;
  }> {
    const userInvoice = await prisma.invoiceCode.findFirst({
      where: { seasonId, assignedUserId: userId, redeemedAt: { not: null } },
      orderBy: { redeemedAt: 'desc' },
    });

    let match: InvoiceMatchKind | 'unknown' = 'unknown';
    let userAlert: string | null = null;
    let adminMessage: string;

    if (userInvoice?.codeNormalized) {
      match = classifyInvoiceMatch(normalized, userInvoice.codeNormalized);
    } else if (userInvoice) {
      match = (await bcrypt.compare(normalized, userInvoice.codeHash)) ? 'exact' : 'unknown';
    } else {
      throw new Error('לא נמצאה חשבונית שהמשתמש הזין');
    }

    switch (match) {
      case 'exact':
        userAlert = null;
        adminMessage = 'תואם למספר שהמשתמש הזין בפרופיל.';
        break;
      case 'similar':
        userAlert = INVOICE_ALERT_SIMILAR;
        adminMessage =
          'דומה לחשבונית שהמשתמש הזין — המשתמש יראה התראה בפרופיל.';
        break;
      case 'mismatch':
        userAlert = INVOICE_ALERT_MISMATCH;
        adminMessage =
          'שונה מהחשבונית שהמשתמש הזין — המשתמש יראה התראה בפרופיל.';
        break;
      default:
        adminMessage =
          'לא ניתן להשוות (חשבונית ישנה ללא נתוני השוואה) — רק התאמה מדויקת נבדקה.';
        break;
    }

    await prisma.seasonRegistration.update({
      where: { userId_seasonId: { userId, seasonId } },
      data: { invoiceAlert: userAlert },
    });

    return {
      invoiceNumber: normalized,
      updated: false,
      verifyOnly: true,
      match,
      userAlertSet: !!userAlert,
      adminMessage,
    };
  }

  static async assignInvoice(
    adminId: string,
    userId: string,
    seasonId: string,
    invoiceNumber: string
  ): Promise<{
    invoiceNumber: string;
    updated: boolean;
    verifyOnly?: boolean;
    match?: InvoiceMatchKind | 'unknown';
    userAlertSet?: boolean;
    adminMessage?: string;
    similarToUser?: { displayName: string };
  }> {
    const season = await prisma.season.findUniqueOrThrow({ where: { id: seasonId } });
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });

    if (user.activeDivision && user.activeDivision !== season.division) {
      throw new Error('לא ניתן להקצות קוד תשלום לטורניר שונה מהצד שנבחר על ידי המשתמש');
    }

    const normalized = this.normalizeInvoiceNumber(invoiceNumber);

    const reg = await prisma.seasonRegistration.findUnique({
      where: { userId_seasonId: { userId, seasonId } },
    });
    if (reg?.status === SeasonRegistrationStatus.active) {
      return this.verifyAdminInvoiceAgainstUser(userId, seasonId, normalized);
    }

    const similarToOther = await this.findSimilarInvoiceOwner(seasonId, normalized, userId);

    const existingUnused = await prisma.invoiceCode.findFirst({
      where: { seasonId, assignedUserId: userId, redeemedAt: null },
    });

    if (existingUnused) {
      await this.assertInvoiceUniqueInSeason(seasonId, normalized, existingUnused.id);
      const codeHash = await bcrypt.hash(normalized, 10);
      await prisma.invoiceCode.update({
        where: { id: existingUnused.id },
        data: { codeHash, codeNormalized: normalized, createdById: adminId },
      });
      await prisma.seasonRegistration.upsert({
        where: { userId_seasonId: { userId, seasonId } },
        create: {
          userId,
          seasonId,
          division: season.division,
          status: SeasonRegistrationStatus.invoice_assigned,
        },
        update: { status: SeasonRegistrationStatus.invoice_assigned, division: season.division },
      });
      return {
        invoiceNumber: normalized,
        updated: true,
        similarToUser: similarToOther ? { displayName: similarToOther.displayName } : undefined,
        adminMessage: similarToOther
          ? `הוקצה. שים לב: דומה לחשבונית של ${similarToOther.displayName}.`
          : 'מספר החשבונית עודכן. המשתמש מזין את המספר בפרופיל.',
      };
    }

    await this.assertInvoiceUniqueInSeason(seasonId, normalized);

    const codeHash = await bcrypt.hash(normalized, 10);

    await prisma.$transaction(async (tx) => {
      await tx.invoiceCode.create({
        data: {
          seasonId,
          codeHash,
          codeNormalized: normalized,
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

    return {
      invoiceNumber: normalized,
      updated: false,
      similarToUser: similarToOther ? { displayName: similarToOther.displayName } : undefined,
      adminMessage: similarToOther
        ? `הוקצה. שים לב: דומה לחשבונית של ${similarToOther.displayName}.`
        : 'מספר החשבונית הוקצה. המשתמש מזין את אותו מספר בפרופיל.',
    };
  }

  private static async recordInvoiceAttemptFailure(
    userId: string,
    seasonId: string,
    reason: string
  ): Promise<never> {
    const attempts = await InvoiceRateLimitService.recordFailedAttempt(userId, seasonId);
    if (attempts >= MAX_INVOICE_ATTEMPTS) {
      throw new Error('נחסמת עד מחר בשל ניסיונות רבים. נסה שוב מחר.');
    }
    const remaining = MAX_INVOICE_ATTEMPTS - attempts;
    throw new Error(`${reason} נותרו ${remaining} ניסיונים היום.`);
  }

  static async redeemInvoice(userId: string, code: string, division: Division): Promise<void> {
    const season = await SeasonService.getActiveSeason(division);
    await this.assertDivisionAccess(userId, division);

    if (await InvoiceRateLimitService.isLocked(userId, season.id)) {
      throw new Error('נחסמת עד מחר בשל ניסיונות רבים. נסה שוב מחר.');
    }

    let normalized: string;
    try {
      normalized = this.normalizeInvoiceNumber(code);
    } catch {
      return this.recordInvoiceAttemptFailure(userId, season.id, 'מספר חשבונית לא תקין.');
    }

    const reg = await prisma.seasonRegistration.findUnique({
      where: { userId_seasonId: { userId, seasonId: season.id } },
    });

    if (reg?.status === SeasonRegistrationStatus.active) {
      throw new Error('הרישום כבר פעיל לעונה זו');
    }

    const onRoster = await prisma.player.findFirst({
      where: { userId, seasonId: season.id, active: true },
    });
    if (onRoster) {
      throw new Error('אתה כבר רשום בסגל לעונה זו');
    }

    const ownedTeam = await prisma.team.findFirst({
      where: { seasonId: season.id, ownerUserId: userId },
    });
    if (ownedTeam) {
      throw new Error('אתה כבר בעל קבוצה לעונה זו');
    }

    const existingUnused = await prisma.invoiceCode.findFirst({
      where: { seasonId: season.id, assignedUserId: userId, redeemedAt: null },
    });

    try {
      await this.assertInvoiceUniqueInSeason(season.id, normalized, existingUnused?.id);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'מספר חשבונית לא תקין';
      return this.recordInvoiceAttemptFailure(userId, season.id, msg);
    }

    const codeHash = await bcrypt.hash(normalized, 10);
    const now = new Date();

    let invoiceAlert: string | null = null;
    if (existingUnused?.createdById && existingUnused.codeNormalized) {
      const match = classifyInvoiceMatch(normalized, existingUnused.codeNormalized);
      if (match === 'similar') {
        invoiceAlert = INVOICE_ALERT_USER_SIMILAR_TO_ADMIN;
      } else if (match === 'mismatch') {
        invoiceAlert = INVOICE_ALERT_USER_DIFFERS_FROM_ADMIN;
      }
    }

    await prisma.$transaction(async (tx) => {
      if (existingUnused) {
        await tx.invoiceCode.update({
          where: { id: existingUnused.id },
          data: { codeHash, codeNormalized: normalized, redeemedAt: now },
        });
      } else {
        await tx.invoiceCode.create({
          data: {
            seasonId: season.id,
            codeHash,
            codeNormalized: normalized,
            assignedUserId: userId,
            redeemedAt: now,
          },
        });
      }

      await tx.seasonRegistration.upsert({
        where: { userId_seasonId: { userId, seasonId: season.id } },
        create: {
          userId,
          seasonId: season.id,
          division: season.division,
          status: SeasonRegistrationStatus.active,
          redeemedAt: now,
          invoiceAlert,
        },
        update: {
          status: SeasonRegistrationStatus.active,
          redeemedAt: now,
          division: season.division,
          invoiceAlert,
        },
      });
    });

    await this.lockActiveDivision(userId, division);
    await InvoiceRateLimitService.clearAttempts(userId, season.id);
  }

  static async assertRegistrationActiveForRequest(
    userId: string,
    seasonId: string
  ): Promise<void> {
    const reg = await prisma.seasonRegistration.findUnique({
      where: { userId_seasonId: { userId, seasonId } },
    });
    if (reg?.status !== SeasonRegistrationStatus.active) {
      throw new Error('הזן את מספר החשבונית בפרופיל לפני שליחת בקשה');
    }
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
    const season = await SeasonService.getActiveSeason(division);
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

  static async submitJoinRequest(userId: string, division: Division, teamId: number) {
    const season = await SeasonService.getActiveSeason(division);
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

    const memberId = await this.getNextMemberId();
    const profile = (req.user.playerProfile as Record<string, unknown> | null) ?? {};
    const firstName = String(profile.firstName ?? req.user.displayName).slice(0, 50);
    const lastName = String(profile.lastName ?? '').slice(0, 50);
    const nickname = String(profile.nickname ?? req.user.displayName).slice(0, 50);
    const number = Number(profile.number) || 99;
    const position = String(profile.position ?? '').slice(0, 30);

    await prisma.$transaction(async (tx) => {
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

      await tx.user.update({
        where: { id: req.userId },
        data: {
          mappedPlayerInfo: toInputJson({
            teamId: req.teamId,
            memberId,
            status: 'approved',
          }),
          playerProfile: toInputJson({
            firstName,
            lastName,
            nickname,
            number,
            position,
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
              SeasonRegistrationStatus.join_pending, // legacy pre-receipt-first
              SeasonRegistrationStatus.invoice_assigned,
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

    const creationsEnriched = creations.map((c) => ({
      ...c,
      registrationStatus: regStatusByUser.get(c.userId) ?? SeasonRegistrationStatus.none,
    }));
    const joinsEnriched = joins.map((j) => ({
      ...j,
      registrationStatus: regStatusByUser.get(j.userId) ?? SeasonRegistrationStatus.none,
    }));
    const transfersEnriched = transfers.map((t) => ({
      ...t,
      registrationStatus: regStatusByUser.get(t.userId) ?? SeasonRegistrationStatus.none,
    }));

    const awaitingInvoiceEnriched = await Promise.all(
      awaitingInvoice.map(async (reg) => {
        const join = joinByUserId.get(reg.userId);
        const hasUnredeemedCode = await prisma.invoiceCode.findFirst({
          where: {
            seasonId: season.id,
            assignedUserId: reg.userId,
            redeemedAt: null,
          },
          select: { codeNormalized: true },
        });
        return {
          user: reg.user,
          status: reg.status,
          pendingTeamName: join?.team?.name ?? null,
          joinStatus: join?.status ?? null,
          hasUnredeemedCode: !!hasUnredeemedCode,
          assignedInvoiceNumber: hasUnredeemedCode?.codeNormalized ?? null,
        };
      })
    );

    return {
      season,
      creations: creationsEnriched,
      joins: joinsEnriched,
      transfers: transfersEnriched,
      awaitingInvoice: awaitingInvoiceEnriched,
    };
  }

  static async searchUsersForInvoice(seasonId: string, query: string, limit = 20) {
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
    const [regs, codes] = await Promise.all([
      prisma.seasonRegistration.findMany({
        where: { seasonId, userId: { in: userIds } },
      }),
      prisma.invoiceCode.findMany({
        where: { seasonId, assignedUserId: { in: userIds }, redeemedAt: null },
      }),
    ]);

    const regByUser = new Map(regs.map((r) => [r.userId, r.status]));
    const codeByUser = new Map(
      codes.map((c) => [c.assignedUserId, c.codeNormalized ?? null])
    );

    return users.map((u) => ({
      id: u.id,
      displayName: u.displayName,
      email: u.email,
      activeDivision: u.activeDivision,
      registrationStatus: regByUser.get(u.id) ?? SeasonRegistrationStatus.none,
      hasUnredeemedCode: codeByUser.has(u.id),
      assignedInvoiceNumber: codeByUser.get(u.id) ?? null,
    }));
  }
}
