import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Division, Prisma, RequestStatus } from '@prisma/client';

const {
  mockPlayerFindFirst,
  mockPlayerUpdate,
  mockTeamJoinRequestUpdateMany,
  mockTeamJoinRequestFindFirst,
  mockTeamTransferRequestUpdateMany,
  mockUserFindUnique,
  mockUserUpdate,
  mockTransaction,
  mockGetActiveSeasonForDivision,
  mockClearMappingsForDeletedPlayer,
  mockInvalidateDivisionCaches,
  mockExistsSync,
  mockUnlinkSync,
} = vi.hoisted(() => ({
  mockPlayerFindFirst: vi.fn(),
  mockPlayerUpdate: vi.fn(),
  mockTeamJoinRequestUpdateMany: vi.fn(),
  mockTeamJoinRequestFindFirst: vi.fn(),
  mockTeamTransferRequestUpdateMany: vi.fn(),
  mockUserFindUnique: vi.fn(),
  mockUserUpdate: vi.fn(),
  mockTransaction: vi.fn(),
  mockGetActiveSeasonForDivision: vi.fn(),
  mockClearMappingsForDeletedPlayer: vi.fn(),
  mockInvalidateDivisionCaches: vi.fn(),
  mockExistsSync: vi.fn(),
  mockUnlinkSync: vi.fn(),
}));

vi.mock('../lib/prisma', () => ({
  prisma: {
    player: {
      findFirst: (...args: unknown[]) => mockPlayerFindFirst(...args),
    },
    $transaction: (fn: (tx: unknown) => Promise<void>) => mockTransaction(fn),
  },
}));

vi.mock('./SeasonService', () => ({
  SeasonService: {
    getActiveSeasonForDivision: (...args: unknown[]) => mockGetActiveSeasonForDivision(...args),
  },
}));

vi.mock('../repositories/userMappingRepository', () => ({
  clearMappingsForDeletedPlayer: (...args: unknown[]) =>
    mockClearMappingsForDeletedPlayer(...args),
}));

vi.mock('./registrationHelpers', () => ({
  invalidateDivisionCaches: (...args: unknown[]) => mockInvalidateDivisionCaches(...args),
}));

vi.mock('fs', () => ({
  default: {
    existsSync: (...args: unknown[]) => mockExistsSync(...args),
    unlinkSync: (...args: unknown[]) => mockUnlinkSync(...args),
  },
}));

import { PlayerService } from './PlayerService';
import { PlayerServiceError } from '../errors/PlayerServiceError';

const SEASON_ID = 'season-boys-1';
const PLAYER = {
  memberId: 42,
  teamId: 3,
  seasonId: SEASON_ID,
  userId: 'user-linked-1',
  headPhoto: '/uploads/players/head-42.jpg',
  pendingHeadPhoto: '/uploads/players/pending-42.jpg',
  active: true,
};

function makeTx() {
  return {
    player: {
      update: mockPlayerUpdate,
      findFirst: vi.fn().mockResolvedValue(null),
    },
    teamJoinRequest: {
      updateMany: mockTeamJoinRequestUpdateMany,
      findFirst: mockTeamJoinRequestFindFirst,
    },
    teamTransferRequest: {
      updateMany: mockTeamTransferRequestUpdateMany,
    },
    user: {
      findUnique: mockUserFindUnique,
      update: mockUserUpdate,
    },
  };
}

describe('PlayerService.deactivateRosterMember', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetActiveSeasonForDivision.mockResolvedValue({ id: SEASON_ID, division: Division.boys });
    mockPlayerFindFirst.mockResolvedValue(PLAYER);
    mockTransaction.mockImplementation(async (fn: (tx: ReturnType<typeof makeTx>) => Promise<void>) => {
      await fn(makeTx());
    });
    mockTeamJoinRequestFindFirst.mockResolvedValue(null);
    mockUserFindUnique.mockResolvedValue({
      mappedPlayerInfo: { teamId: 3, memberId: 42, status: 'approved' },
      playerProfile: { firstName: 'Test', lastName: 'Player' },
    });
    mockClearMappingsForDeletedPlayer.mockResolvedValue(undefined);
    mockInvalidateDivisionCaches.mockResolvedValue(undefined);
    mockExistsSync.mockReturnValue(true);
  });

  it('throws SEASON_NOT_ACTIVE when season lookup returns null', async () => {
    mockGetActiveSeasonForDivision.mockResolvedValue(null);

    await expect(
      PlayerService.deactivateRosterMember(PLAYER.memberId, PLAYER.teamId, Division.boys)
    ).rejects.toMatchObject({
      code: 'SEASON_NOT_ACTIVE',
      status: 503,
    } satisfies Partial<PlayerServiceError>);

    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it('throws SEASON_NOT_ACTIVE when season lookup rejects', async () => {
    mockGetActiveSeasonForDivision.mockRejectedValue(new Error('No season'));

    await expect(
      PlayerService.deactivateRosterMember(PLAYER.memberId, PLAYER.teamId, Division.boys)
    ).rejects.toMatchObject({
      code: 'SEASON_NOT_ACTIVE',
      status: 503,
    } satisfies Partial<PlayerServiceError>);
  });

  it('throws PLAYER_NOT_FOUND when roster slot is missing', async () => {
    mockPlayerFindFirst.mockResolvedValue(null);

    await expect(
      PlayerService.deactivateRosterMember(PLAYER.memberId, PLAYER.teamId, Division.boys)
    ).rejects.toMatchObject({
      code: 'PLAYER_NOT_FOUND',
      status: 404,
    } satisfies Partial<PlayerServiceError>);

    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it('soft-deletes the player, clears photos in tx, and unlinks linked user', async () => {
    await PlayerService.deactivateRosterMember(PLAYER.memberId, PLAYER.teamId, Division.boys);

    expect(mockPlayerUpdate).toHaveBeenCalledWith({
      where: { memberId: PLAYER.memberId },
      data: {
        userId: null,
        active: false,
        headPhoto: '',
        pendingHeadPhoto: '',
      },
    });

    expect(mockTeamJoinRequestFindFirst).toHaveBeenCalledWith({
      where: {
        userId: PLAYER.userId,
        seasonId: { not: SEASON_ID },
        status: { in: [RequestStatus.pending, RequestStatus.owner_approved] },
      },
    });

    expect(mockClearMappingsForDeletedPlayer).toHaveBeenCalledWith(
      PLAYER.teamId,
      PLAYER.memberId,
      expect.objectContaining({ player: expect.any(Object) })
    );
    expect(mockInvalidateDivisionCaches).toHaveBeenCalledWith(Division.boys);
    expect(mockUnlinkSync).toHaveBeenCalledTimes(2);
  });

  it('invalidates cache before photo file delete', async () => {
    const order: string[] = [];
    mockInvalidateDivisionCaches.mockImplementation(async () => {
      order.push('cache');
    });
    mockUnlinkSync.mockImplementation(() => {
      order.push('unlink');
    });

    await PlayerService.deactivateRosterMember(PLAYER.memberId, PLAYER.teamId, Division.boys);

    expect(order).toEqual(['cache', 'unlink', 'unlink']);
  });

  it('still invalidates cache when photo file delete throws', async () => {
    mockUnlinkSync.mockImplementation(() => {
      throw new Error('EACCES');
    });

    await PlayerService.deactivateRosterMember(PLAYER.memberId, PLAYER.teamId, Division.boys);

    expect(mockInvalidateDivisionCaches).toHaveBeenCalledWith(Division.boys);
  });

  it('does not delete photo files or invalidate cache when transaction fails', async () => {
    mockTransaction.mockRejectedValue(new Error('tx failed'));

    await expect(
      PlayerService.deactivateRosterMember(PLAYER.memberId, PLAYER.teamId, Division.boys)
    ).rejects.toThrow('tx failed');

    expect(mockUnlinkSync).not.toHaveBeenCalled();
    expect(mockInvalidateDivisionCaches).not.toHaveBeenCalled();
  });

  it('deactivates unlinked roster slots without user cleanup', async () => {
    mockPlayerFindFirst.mockResolvedValue({ ...PLAYER, userId: null, headPhoto: '', pendingHeadPhoto: '' });

    await PlayerService.deactivateRosterMember(PLAYER.memberId, PLAYER.teamId, Division.girls);

    expect(mockPlayerUpdate).toHaveBeenCalledWith({
      where: { memberId: PLAYER.memberId },
      data: {
        userId: null,
        active: false,
        headPhoto: '',
        pendingHeadPhoto: '',
      },
    });
    expect(mockTeamJoinRequestUpdateMany).not.toHaveBeenCalled();
    expect(mockUserUpdate).not.toHaveBeenCalled();
    expect(mockInvalidateDivisionCaches).toHaveBeenCalledWith(Division.girls);
  });
});
