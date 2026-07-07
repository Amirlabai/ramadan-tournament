import {
  Division,
  Prisma,
  RequestStatus,
  ScoringMode,
  SeasonRegistrationStatus,
  SquadRole,
  TeamStatus,
} from '@prisma/client';
import { prisma } from '../lib/prisma';
import { config } from '../config/env';
import { toInputJson } from '../lib/json';
import { SeasonService } from './SeasonService';
import { sanitizeTeamCreationFields } from '../utils/inputValidation';
import {
  assertMatchedIdentityForApproval,
  computeIdentityMatchState,
  hasAdminIdentityOnReg,
  identitySelectFields,
  needsIdentityWorkflowAction,
} from './RegistrationIdentityService';
import { parseRequestedMemberId } from '../utils/requestedMemberId';
import { mergeProfilePosition, rosterAudit } from '../utils/rosterAuditLog';
import {
  assertDivisionAccess,
  getNextMemberId,
  getNextTeamId,
  invalidateDivisionCaches,
  lockActiveDivision,
} from './registrationHelpers';
import { RegistrationQueryService } from './RegistrationQueryService';
import { findPendingTeamCreationRequests } from '../repositories/userMappingRepository';

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

async function upsertSeasonRegistration(
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

async function restoreRegistrationStatusAfterCancel(
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
    ? SeasonRegistrationStatus.identity_assigned
    : SeasonRegistrationStatus.none;
  await upsertSeasonRegistration(userId, seasonId, division, nextStatus);
}

async function syncPlayerProfile(
  userId: string,
  playerFields: {
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
      playerProfile: toInputJson({
        firstName: playerFields.firstName,
        lastName: playerFields.lastName,
        nickname: playerFields.nickname,
        number: playerFields.number,
        position: playerFields.position ?? '',
      }),
    },
  });
}

function assertFootballLineup(
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

async function hasClaimedCaptainReviewer(
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

function normalizePreferredJerseyNumber(value: unknown): number | null {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 99) {
    return null;
  }
  return parsed;
}

async function resolveAvailableJerseyNumber(
  db: Pick<Prisma.TransactionClient, 'player'>,
  seasonId: string,
  teamId: number,
  preferred: unknown
): Promise<number> {
  const preferredNumber = normalizePreferredJerseyNumber(preferred);
  const taken = await db.player.findMany({
    where: { seasonId, teamId, active: true },
    select: { number: true },
  });
  const takenNumbers = new Set(
    taken
      .map((row) => row.number)
      .filter((num) => Number.isInteger(num) && num >= 1 && num <= 99)
  );
  if (preferredNumber != null && !takenNumbers.has(preferredNumber)) {
    return preferredNumber;
  }
  for (let candidate = 1; candidate <= 99; candidate += 1) {
    if (!takenNumbers.has(candidate)) {
      return candidate;
    }
  }
  throw new Error('לא נותרו מספרי חולצה פנויים בקבוצה');
}

async function resolveJoinLinkMemberId(
  db: Pick<Prisma.TransactionClient, 'player'>,
  input: {
    userId: string;
    teamId: number;
    seasonId: string;
    requestedMemberId?: number;
  }
): Promise<number | null> {
  if (input.requestedMemberId != null) {
    return input.requestedMemberId;
  }

  const existingLinked = await db.player.findFirst({
    where: {
      userId: input.userId,
      teamId: input.teamId,
      seasonId: input.seasonId,
      active: true,
    },
    select: { memberId: true },
  });
  if (existingLinked) {
    return existingLinked.memberId;
  }

  // No fuzzy name match — callers must set requestedMemberId (claim/join UX) or accept create.
  return null;
}

async function hasPreAdminReviewerCoverage(
  db: Pick<Prisma.TransactionClient, 'team' | 'player'>,
  seasonId: string,
  teamId: number
): Promise<boolean> {
  const team = await db.team.findFirst({
    where: { seasonId, id: teamId },
    select: { ownerUserId: true },
  });
  if (team?.ownerUserId) {
    return true;
  }
  const claimedCaptain = await db.player.findFirst({
    where: {
      seasonId,
      teamId,
      active: true,
      isCaptain: true,
      userId: { not: null },
    },
    select: { memberId: true },
  });
  return !!claimedCaptain;
}

async function canActorReviewPendingJoin(
  actorId: string,
  seasonId: string,
  teamId: number,
  teamOwnerUserId: string | null
): Promise<boolean> {
  if (teamOwnerUserId === actorId) {
    return true;
  }
  // Captain reviewer is strictly scoped to same season+team and claimed userId.
  return hasClaimedCaptainReviewer(prisma, actorId, seasonId, teamId);
}

export class RegistrationWorkflowService {
  static async cancelPendingRegistrationRequest(userId: string, division: Division) {
    const season = await SeasonService.getActiveSeasonForDivision(division);
    await assertDivisionAccess(userId, division);

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
      if (reg?.status === SeasonRegistrationStatus.join_pending) {
        const hasAdminIdentity = hasAdminIdentityOnReg(reg);
        const nextStatus = hasAdminIdentity
          ? SeasonRegistrationStatus.identity_assigned
          : SeasonRegistrationStatus.none;
        await tx.seasonRegistration.upsert({
          where: { userId_seasonId: { userId, seasonId: season.id } },
          create: { userId, seasonId: season.id, division, status: nextStatus },
          update: { status: nextStatus, division },
        });
      }
    });

    return RegistrationQueryService.getSummary(userId, division);
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
    await assertDivisionAccess(userId, division);
    await RegistrationWorkflowService.assertRegistrationActiveForRequest(userId, season.id);
    await lockActiveDivision(userId, division);

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
      await restoreRegistrationStatusAfterCancel(
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

    const teamId = await getNextTeamId(req.seasonId);
    const memberId = await getNextMemberId();

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

    await invalidateDivisionCaches(req.season.division);
    return team;
  }

  static async submitJoinRequest(
    userId: string,
    division: Division,
    teamId: number,
    options?: JoinRequestOptions
  ) {
    const season = await SeasonService.getActiveSeasonForDivision(division);
    await assertDivisionAccess(userId, division);
    await RegistrationWorkflowService.assertRegistrationActiveForRequest(userId, season.id);
    await lockActiveDivision(userId, division);

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

      const initialStatus = (await hasPreAdminReviewerCoverage(tx, season.id, teamId))
        ? RequestStatus.pending
        : RequestStatus.owner_approved;

      const req = await tx.teamJoinRequest.create({
        data: {
          userId,
          seasonId: season.id,
          teamId,
          status: initialStatus,
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
    actorId: string,
    requestId: string,
    approve: boolean
  ) {
    const req = await prisma.teamJoinRequest.findUniqueOrThrow({
      where: { id: requestId },
      include: { season: true, team: true },
    });

    const team = await prisma.team.findFirst({
      where: { seasonId: req.seasonId, id: req.teamId },
      select: { ownerUserId: true },
    });
    if (!team) {
      throw new Error('הקבוצה לא נמצאה');
    }

    const canReview = await canActorReviewPendingJoin(
      actorId,
      req.seasonId,
      req.teamId,
      team.ownerUserId ?? null
    );
    if (!canReview) {
      throw new Error('רק בעלים או קפטן משויך לקבוצה יכול לאשר בקשה זו');
    }

    if (req.status !== RequestStatus.pending) {
      throw new Error('הבקשה אינה ממתינה לאישור בעלים');
    }

    await prisma.teamJoinRequest.update({
      where: { id: requestId },
      data: {
        status: approve ? RequestStatus.owner_approved : RequestStatus.rejected,
        ownerReviewedAt: new Date(),
        ownerReviewedBy: actorId,
      },
    });

    if (!approve) {
      await restoreRegistrationStatusAfterCancel(
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
      rosterAudit('admin_join_rejected', {
        requestId,
        adminId,
        userId: req.userId,
        teamId: req.teamId,
        seasonId: req.seasonId,
      });
      await restoreRegistrationStatusAfterCancel(
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
    const rawPosition = profile.position != null ? String(profile.position) : undefined;

    let linkFirstName = firstName;
    let linkLastName = lastName;
    let linkNickname = nickname;
    let linkNumber = number;
    let linkPosition = mergeProfilePosition(rawPosition, '');
    let auditMode: 'link' | 'create' = 'create';
    let auditMemberId: number | null = null;
    let auditSlotPosition: string | null = null;

    try {
      await prisma.$transaction(async (tx) => {
        let memberId: number;

        const linkMemberId = await resolveJoinLinkMemberId(tx, {
          userId: req.userId,
          teamId: req.teamId,
          seasonId: req.seasonId,
          requestedMemberId,
        });

        if (linkMemberId != null) {
          const slot = await tx.player.findFirst({
            where: {
              memberId: linkMemberId,
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
          auditSlotPosition = slot.position;
          const mergedPosition = mergeProfilePosition(rawPosition, slot.position);
          await tx.player.update({
            where: { memberId: linkMemberId },
            data: {
              userId: req.userId,
              position: mergedPosition,
            },
          });
          memberId = linkMemberId;
          linkFirstName = slot.firstName;
          linkLastName = slot.lastName;
          linkNickname = slot.nickname;
          linkNumber = slot.number;
          linkPosition = mergedPosition;
          auditMode = 'link';
          auditMemberId = memberId;
        } else {
          // No requestedMemberId and no prior userId link — create a new roster row.
          // Unclaimed placeholder slots are not auto-linked; join UX must set requestedMemberId.
          const duplicateOnTeam = await tx.player.findFirst({
            where: {
              userId: req.userId,
              teamId: req.teamId,
              seasonId: req.seasonId,
              active: true,
            },
          });
          if (duplicateOnTeam) {
            throw new Error('המשתמש כבר משויך לשחקן פעיל בקבוצה זו');
          }

          memberId = await getNextMemberId();
          const allocatedNumber = await resolveAvailableJerseyNumber(
            tx,
            req.seasonId,
            req.teamId,
            number
          );
          const createPosition = mergeProfilePosition(rawPosition, '');
          await tx.player.create({
            data: {
              memberId,
              teamId: req.teamId,
              seasonId: req.seasonId,
              userId: req.userId,
              firstName,
              lastName,
              nickname,
              number: allocatedNumber,
              position: createPosition,
            },
          });
          linkNumber = allocatedNumber;
          linkPosition = createPosition;
          auditMode = 'create';
          auditMemberId = memberId;
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

      rosterAudit('admin_join_approved', {
        requestId,
        adminId,
        userId: req.userId,
        teamId: req.teamId,
        seasonId: req.seasonId,
        mode: auditMode,
        memberId: auditMemberId,
        requestedMemberId: requestedMemberId ?? null,
        profilePosition: rawPosition ?? null,
        rosterPosition: auditSlotPosition,
        mergedPosition: linkPosition || null,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      rosterAudit('admin_join_approve_failed', {
        requestId,
        adminId,
        userId: req.userId,
        teamId: req.teamId,
        seasonId: req.seasonId,
        requestedMemberId: requestedMemberId ?? null,
        profilePosition: rawPosition ?? null,
        rosterPosition: auditSlotPosition,
        error: message,
      });
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new Error('מספר חולצה כבר תפוס בקבוצה. בחר מספר אחר ונסה שוב.');
      }
      throw err;
    }

    await invalidateDivisionCaches(req.season.division);
  }

  static async submitTransfer(
    userId: string,
    division: Division,
    toTeamId: number
  ) {
    const season = await SeasonService.getActiveSeasonForDivision(division);
    await assertDivisionAccess(userId, division);

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
    void adminId;
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

    await invalidateDivisionCaches(req.season.division);
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
      assertFootballLineup(merged);
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

    await invalidateDivisionCaches(division);
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
    const memberId = await getNextMemberId();

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

    await syncPlayerProfile(ownerId, {
      firstName: user.displayName.split(' ')[0] || 'בעלים',
      lastName: user.displayName.split(' ').slice(1).join(' ') || '',
      nickname: user.displayName,
      number: 1,
      position: '',
    });

    await invalidateDivisionCaches(division);
    return memberId;
  }

  static async listPendingJoinsForOwner(ownerId: string, teamId: number, division: Division) {
    const season = await SeasonService.getActiveSeasonForDivision(division);
    const team = await prisma.team.findFirst({
      where: { seasonId: season.id, id: teamId },
      select: { id: true, ownerUserId: true },
    });
    if (!team) {
      throw new Error('הקבוצה לא נמצאה');
    }
    const canReview = await canActorReviewPendingJoin(
      ownerId,
      season.id,
      teamId,
      team.ownerUserId ?? null
    );
    if (!canReview) {
      throw new Error('אין הרשאת בעלים/קפטן לקבוצה זו');
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

  static async listPendingWorkflows(seasonId?: string) {
    const season = seasonId
      ? await prisma.season.findUniqueOrThrow({ where: { id: seasonId } })
      : await SeasonService.getActiveSeason(Division.boys);

    const [creations, joins, transfers] = await Promise.all([
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
    ]);

    const workflowUserIds = [
      ...new Set([
        ...creations.map((c) => c.userId),
        ...joins.map((j) => j.userId),
        ...transfers.map((t) => t.userId),
      ]),
    ];

    const noneStatusFilters: Array<{
      userPersonalIdEnc?: { not: null };
      userPersonalIdMasked?: { not: null };
      invoiceAlert?: { not: null };
      userId?: { in: string[] };
    }> = [
      { userPersonalIdEnc: { not: null } },
      { userPersonalIdMasked: { not: null } },
      { invoiceAlert: { not: null } },
    ];
    if (workflowUserIds.length > 0) {
      noneStatusFilters.push({ userId: { in: workflowUserIds } });
    }

    const awaitingInvoice = await prisma.seasonRegistration.findMany({
      where: {
        seasonId: season.id,
        OR: [
          {
            status: {
              in: [
                SeasonRegistrationStatus.awaiting_identity,
                SeasonRegistrationStatus.join_pending,
                SeasonRegistrationStatus.identity_assigned,
                SeasonRegistrationStatus.active,
              ],
            },
          },
          {
            status: SeasonRegistrationStatus.none,
            OR: noneStatusFilters,
          },
        ],
      },
      include: {
        user: { select: { id: true, displayName: true, email: true, activeDivision: true } },
      },
    });

    const joinByUserId = new Map(joins.map((j) => [j.userId, j]));

    const workflowRegs =
      workflowUserIds.length > 0
        ? await prisma.seasonRegistration.findMany({
            where: { seasonId: season.id, userId: { in: workflowUserIds } },
            select: { userId: true, status: true },
          })
        : [];
    const regStatusByUser = new Map(workflowRegs.map((r) => [r.userId, r.status]));

    const allIdentityUserIds = [
      ...new Set([...workflowUserIds, ...awaitingInvoice.map((r) => r.userId)]),
    ];
    const identityRegs =
      allIdentityUserIds.length > 0
        ? await prisma.seasonRegistration.findMany({
            where: { seasonId: season.id, userId: { in: allIdentityUserIds } },
            select: { userId: true, ...identitySelectFields },
          })
        : [];
    const identityStateByUser = new Map(
      identityRegs.map((r) => [r.userId, computeIdentityMatchState(r)])
    );

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

    const creationsByUserId = new Set(creations.map((c) => c.userId));

    const awaitingIdentityEnriched = awaitingInvoice
      .map((reg) => {
        const join = joinByUserId.get(reg.userId);
        const matchState = identityStateByUser.get(reg.userId) ?? computeIdentityMatchState(null);
        return {
          userId: reg.userId,
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
      .filter((row) => {
        if (row.status === SeasonRegistrationStatus.none) {
          return (
            row.identityMatched === false &&
            (!!row.submittedIdentityMasked ||
              !!row.invoiceAlert ||
              joinByUserId.has(row.userId) ||
              creationsByUserId.has(row.userId))
          );
        }
        return needsIdentityWorkflowAction(row.status, row.invoiceAlert, row.identityMatched);
      });

    return {
      season,
      creations: creationsEnriched,
      joins: joinsEnriched,
      transfers: transfersEnriched,
      awaitingIdentity: awaitingIdentityEnriched,
    };
  }

  static async countPendingAdminActionsForSeason(seasonId: string): Promise<number> {
    const data = await RegistrationWorkflowService.listPendingWorkflows(seasonId);
    const adminJoins = data.joins.filter((j) => j.status === RequestStatus.owner_approved).length;
    return (
      data.awaitingIdentity.length +
      data.creations.length +
      adminJoins +
      data.transfers.length
    );
  }

  static async countLegacyTeamRequests(): Promise<number> {
    const users = await findPendingTeamCreationRequests();
    return users.length;
  }

  static async countPendingAdminActions(): Promise<{
    total: number;
    bySeason: Record<string, number>;
    partial?: boolean;
    skippedSeasonIds?: string[];
  }> {
    const seasons = await prisma.season.findMany({
      where: { isActive: true },
      select: { id: true },
    });
    const bySeason: Record<string, number> = {};
    const skippedSeasonIds: string[] = [];
    let seasonTotal = 0;
    for (const season of seasons) {
      try {
        const count = await RegistrationWorkflowService.countPendingAdminActionsForSeason(season.id);
        if (count > 0) {
          bySeason[season.id] = count;
        }
        seasonTotal += count;
      } catch (err) {
        skippedSeasonIds.push(season.id);
        const message = err instanceof Error ? err.message : String(err);
        console.warn(
          'countPendingAdminActions: season skipped',
          season.id,
          message
        );
      }
    }
    let legacy = 0;
    let legacyFailed = false;
    try {
      legacy = await RegistrationWorkflowService.countLegacyTeamRequests();
    } catch (err) {
      legacyFailed = true;
      const message = err instanceof Error ? err.message : String(err);
      console.warn('countPendingAdminActions: legacy team requests skipped', message);
    }
    const total = seasonTotal + legacy;
    const partial = skippedSeasonIds.length > 0 || legacyFailed;
    if (config.nodeEnv !== 'production') {
      console.log('[workflow] pending-count', {
        total,
        bySeason,
        legacy,
        activeSeasons: seasons.length,
        partial,
        skippedSeasonIds,
      });
    }
    return {
      total,
      bySeason,
      ...(partial && {
        partial: true,
        ...(skippedSeasonIds.length > 0 && { skippedSeasonIds }),
      }),
    };
  }
}
