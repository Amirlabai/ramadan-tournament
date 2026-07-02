import { Division, Prisma, RequestStatus } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import { prisma } from '../lib/prisma';
import { toInputJson } from '../lib/json';
import { clearMappingsForDeletedPlayer } from '../repositories/userMappingRepository';
import { invalidateDivisionCaches } from './registrationHelpers';
import { SeasonService } from './SeasonService';
import { PlayerServiceError } from '../errors/PlayerServiceError';

export interface PlayerProfileUpdateInput {
  firstName?: string;
  lastName?: string;
  nickname?: string;
  number?: number;
  position?: string;
  bio?: string;
}

function normalizeFullName(firstName: string, lastName: string): string {
  return `${firstName.trim().toLowerCase()} ${lastName.trim().toLowerCase()}`.replace(/\s+/g, ' ').trim();
}

async function invalidatePlayerSeasonCaches(seasonId: string): Promise<void> {
  const season = await prisma.season.findUnique({
    where: { id: seasonId },
    select: { division: true },
  });
  if (season) {
    await invalidateDivisionCaches(season.division);
  }
}

function deletePlayerPhotoFile(photoPath?: string | null): void {
  if (!photoPath?.startsWith('/uploads/players/')) return;
  const fileName = photoPath.split('/').pop();
  if (!fileName) return;
  const fullPath = path.join(process.cwd(), 'uploads', 'players', fileName);
  try {
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
    }
  } catch (err) {
    console.error('Failed to delete player photo file:', fullPath, err);
  }
}

function deletePlayerPhotoFiles(headPhoto?: string | null, pendingHeadPhoto?: string | null): void {
  deletePlayerPhotoFile(headPhoto);
  deletePlayerPhotoFile(pendingHeadPhoto);
}

async function unlinkRosterSlot(
  tx: Prisma.TransactionClient,
  input: {
    memberId: number;
    seasonId: string;
    userId?: string | null;
    clearPhotos?: boolean;
  }
): Promise<void> {
  await tx.player.update({
    where: { memberId: input.memberId },
    data: {
      userId: null,
      active: false,
      ...(input.clearPhotos ? { headPhoto: '', pendingHeadPhoto: '' } : {}),
    },
  });

  if (!input.userId) return;

  const otherActive = await tx.player.findFirst({
    where: { userId: input.userId, active: true },
  });
  const otherSeasonPending = await tx.teamJoinRequest.findFirst({
    where: {
      userId: input.userId,
      seasonId: { not: input.seasonId },
      status: { in: [RequestStatus.pending, RequestStatus.owner_approved] },
    },
  });

  await tx.teamJoinRequest.updateMany({
    where: {
      userId: input.userId,
      seasonId: input.seasonId,
      status: { in: [RequestStatus.pending, RequestStatus.owner_approved] },
    },
    data: { status: RequestStatus.invalidated },
  });

  await tx.teamTransferRequest.updateMany({
    where: {
      userId: input.userId,
      seasonId: input.seasonId,
      status: RequestStatus.pending,
    },
    data: { status: RequestStatus.invalidated },
  });

  const userRow = await tx.user.findUnique({
    where: { id: input.userId },
    select: { playerProfile: true, mappedPlayerInfo: true },
  });
  const mapped = userRow?.mappedPlayerInfo as {
    memberId?: number;
    status?: string;
  } | null;

  const userUpdate: {
    mappedPlayerInfo?: ReturnType<typeof toInputJson>;
    playerProfile?: ReturnType<typeof toInputJson>;
  } = {};

  if (!mapped?.memberId || mapped.memberId === input.memberId) {
    userUpdate.mappedPlayerInfo = toInputJson(null);
  }

  if (!otherActive && !otherSeasonPending) {
    userUpdate.playerProfile = toInputJson(null);
  } else {
    const prof = (userRow?.playerProfile as Record<string, unknown> | null) ?? {};
    if ('requestedMemberId' in prof) {
      const { requestedMemberId: _removed, ...rest } = prof;
      userUpdate.playerProfile = toInputJson(Object.keys(rest).length > 0 ? rest : null);
    }
  }

  if (Object.keys(userUpdate).length > 0) {
    await tx.user.update({
      where: { id: input.userId },
      data: userUpdate,
    });
  }
}

export class PlayerService {
  private static async assertUniqueOnTeam(
    seasonId: string,
    teamId: number,
    fields: {
      number: number;
      firstName: string;
      lastName: string;
      nickname: string;
    },
    excludeMemberId?: number
  ): Promise<void> {
    const others = await prisma.player.findMany({
      where: {
        seasonId,
        teamId,
        active: true,
        ...(excludeMemberId ? { NOT: { memberId: excludeMemberId } } : {}),
      },
      select: { memberId: true, number: true, firstName: true, lastName: true, nickname: true },
    });

    for (const p of others) {
      if (p.number === fields.number) {
        throw new Error(`מספר ${fields.number} כבר בשימוש על ידי שחקן אחר בקבוצה`);
      }
      const otherName = normalizeFullName(p.firstName, p.lastName);
      const newName = normalizeFullName(fields.firstName, fields.lastName);
      if (newName.length > 1 && otherName === newName) {
        throw new Error('שחקן עם שם פרטי ושם משפחה זהים כבר קיים בקבוצה');
      }
      const nick = fields.nickname.trim();
      if (nick && p.nickname.trim().toLowerCase() === nick.toLowerCase()) {
        throw new Error('כינוי זה כבר בשימוש על ידי שחקן אחר בקבוצה');
      }
    }
  }

  private static async resolveActivePlayerForUser(userId: string) {
    const byLink = await prisma.player.findFirst({
      where: { userId, active: true },
    });
    if (byLink) return byLink;

    const user = await prisma.user.findUnique({ where: { id: userId } });
    const mapped = user?.mappedPlayerInfo as {
      memberId?: number;
      status?: string;
    } | null;

    if (mapped?.memberId && mapped.memberId > 0 && mapped.status === 'approved') {
      const byMember = await prisma.player.findFirst({
        where: { memberId: mapped.memberId, active: true },
      });
      if (!byMember) {
        throw new Error('רשומת השחקן לא נמצאה');
      }
      if (byMember.userId && byMember.userId !== userId) {
        throw new Error('אין הרשאה לערוך שחקן זה');
      }
      return byMember;
    }

    throw new Error('לא נמצא שחקן פעיל — הצטרף לקבוצה או המתן לאישור');
  }

  static async updateOwnProfile(userId: string, raw: PlayerProfileUpdateInput) {
    const player = await this.resolveActivePlayerForUser(userId);

    const firstName =
      raw.firstName != null ? String(raw.firstName).trim().slice(0, 50) : player.firstName;
    const lastName =
      raw.lastName != null ? String(raw.lastName).trim().slice(0, 50) : player.lastName;
    const nickname =
      raw.nickname != null ? String(raw.nickname).trim().slice(0, 50) : player.nickname;
    const number = raw.number != null ? Number(raw.number) : player.number;
    const position =
      raw.position != null ? String(raw.position).trim().slice(0, 30) : player.position;
    const bio = raw.bio != null ? String(raw.bio).trim().slice(0, 300) : player.bio;

    if (!firstName) {
      throw new Error('שם פרטי נדרש');
    }
    if (!Number.isInteger(number) || number < 1 || number > 99) {
      throw new Error('מספר חולצה חייב להיות בין 1 ל־99');
    }

    await this.assertUniqueOnTeam(
      player.seasonId,
      player.teamId,
      { number, firstName, lastName, nickname },
      player.memberId
    );

    const updated = await prisma
      .$transaction(async (tx) => {
        const row = await tx.player.update({
          where: { memberId: player.memberId },
          data: {
            firstName,
            lastName,
            nickname,
            number,
            position,
            bio,
            userId: player.userId ?? userId,
          },
        });

        await tx.user.update({
          where: { id: userId },
          data: {
            mappedPlayerInfo: toInputJson({
              teamId: row.teamId,
              memberId: row.memberId,
              status: 'approved',
            }),
            playerProfile: toInputJson({
              firstName,
              lastName,
              nickname,
              number,
              position,
              bio,
            }),
          },
        });

        return row;
      })
      .catch((err: unknown) => {
        if (
          err &&
          typeof err === 'object' &&
          'code' in err &&
          (err as { code: string }).code === 'P2002'
        ) {
          throw new Error('מספר חולצה זה כבר בשימוש בקבוצה');
        }
        throw err;
      });

    await invalidatePlayerSeasonCaches(player.seasonId);

    return {
      firstName: updated.firstName,
      lastName: updated.lastName,
      nickname: updated.nickname,
      number: updated.number,
      position: updated.position,
      bio: updated.bio,
    };
  }

  /** Draft profile while join is pending — validate against target team roster. */
  static async syncAvatarToRoster(userId: string, avatarUrl: string | undefined): Promise<void> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { activeDivision: true },
    });

    const where: { userId: string; active: boolean; seasonId?: string } = {
      userId,
      active: true,
    };
    if (user?.activeDivision) {
      const season = await SeasonService.getActiveSeasonForDivision(user.activeDivision).catch(
        () => null
      );
      if (season) where.seasonId = season.id;
    }

    const player = await prisma.player.findFirst({
      where,
      orderBy: { createdAt: 'desc' },
    });
    if (!player) return;

    await prisma.player.update({
      where: { memberId: player.memberId },
      data: { headPhoto: avatarUrl ?? '' },
    });
    await invalidatePlayerSeasonCaches(player.seasonId);
  }

  static async leaveTeam(userId: string, division: Division = Division.boys): Promise<void> {
    const season = await SeasonService.getActiveSeasonForDivision(division).catch(() => null);
    if (!season) {
      throw new PlayerServiceError('SEASON_NOT_ACTIVE', 'אין עונה פעילה', 503);
    }

    const player = await prisma.player.findFirst({
      where: {
        userId,
        active: true,
        seasonId: season.id,
      },
      orderBy: { createdAt: 'desc' },
    });
    if (!player) {
      throw new PlayerServiceError('NOT_ON_ROSTER', 'משתמש לא משויך לקבוצה', 400);
    }

    const ownedOnSeason = await prisma.team.findFirst({
      where: { ownerUserId: userId, seasonId: player.seasonId },
      select: { id: true },
    });
    if (ownedOnSeason) {
      throw new PlayerServiceError(
        'TEAM_OWNER',
        'בעל קבוצה לא יכול לעזוב — פנה למנהל',
        400
      );
    }

    await prisma.$transaction(async (tx) => {
      await unlinkRosterSlot(tx, {
        memberId: player.memberId,
        seasonId: player.seasonId,
        userId,
      });
    });

    await invalidateDivisionCaches(division);
  }

  /** Platform admin: remove a roster slot (soft-delete). */
  static async deactivateRosterMember(
    memberId: number,
    teamId: number,
    division: Division = Division.boys
  ): Promise<void> {
    const season = await SeasonService.getActiveSeasonForDivision(division).catch(() => null);
    if (!season) {
      throw new PlayerServiceError('SEASON_NOT_ACTIVE', 'אין עונה פעילה', 503);
    }

    const player = await prisma.player.findFirst({
      where: {
        memberId,
        teamId,
        seasonId: season.id,
        active: true,
      },
    });
    if (!player) {
      throw new PlayerServiceError('PLAYER_NOT_FOUND', 'שחקן לא נמצא בקבוצה', 404);
    }

    const headPhoto = player.headPhoto;
    const pendingHeadPhoto = player.pendingHeadPhoto;

    await prisma.$transaction(async (tx) => {
      await unlinkRosterSlot(tx, {
        memberId: player.memberId,
        seasonId: player.seasonId,
        userId: player.userId,
        clearPhotos: true,
      });
      await clearMappingsForDeletedPlayer(teamId, memberId, tx);
    });

    await invalidateDivisionCaches(division);
    deletePlayerPhotoFiles(headPhoto, pendingHeadPhoto);
  }

  static async updatePendingProfile(userId: string, raw: PlayerProfileUpdateInput) {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const pendingJoin = await prisma.teamJoinRequest.findFirst({
      where: {
        userId,
        status: { in: [RequestStatus.pending, RequestStatus.owner_approved] },
      },
      orderBy: { createdAt: 'desc' },
    });

    const firstName =
      raw.firstName != null
        ? String(raw.firstName).trim().slice(0, 50)
        : (user.playerProfile as { firstName?: string } | null)?.firstName ?? '';
    const lastName =
      raw.lastName != null
        ? String(raw.lastName).trim().slice(0, 50)
        : (user.playerProfile as { lastName?: string } | null)?.lastName ?? '';
    const nickname =
      raw.nickname != null
        ? String(raw.nickname).trim().slice(0, 50)
        : (user.playerProfile as { nickname?: string } | null)?.nickname ?? '';
    const number =
      raw.number != null
        ? Number(raw.number)
        : Number((user.playerProfile as { number?: number } | null)?.number) || 99;
    const position =
      raw.position != null
        ? String(raw.position).trim().slice(0, 30)
        : (user.playerProfile as { position?: string } | null)?.position ?? '';
    const bio =
      raw.bio != null
        ? String(raw.bio).trim().slice(0, 300)
        : (user.playerProfile as { bio?: string } | null)?.bio ?? '';

    if (!firstName) {
      throw new Error('שם פרטי נדרש');
    }
    if (!Number.isInteger(number) || number < 1 || number > 99) {
      throw new Error('מספר חולצה חייב להיות בין 1 ל־99');
    }

    if (pendingJoin) {
      await this.assertUniqueOnTeam(pendingJoin.seasonId, pendingJoin.teamId, {
        number,
        firstName,
        lastName,
        nickname,
      });
    }

    const playerProfile = { firstName, lastName, nickname, number, position, bio };
    await prisma.user.update({
      where: { id: userId },
      data: { playerProfile: toInputJson(playerProfile) },
    });

    return playerProfile;
  }
}
