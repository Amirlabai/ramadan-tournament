import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Division, RequestStatus } from '@prisma/client';

const {
  mockPlayerFindFirst,
  mockTeamFindFirst,
  mockPlayerUpdate,
  mockTeamJoinRequestUpdateMany,
  mockTeamJoinRequestFindFirst,
  mockTeamTransferRequestUpdateMany,
  mockUserFindUnique,
  mockUserUpdate,
  mockTransaction,
  mockGetActiveSeasonForDivision,
  mockInvalidateDivisionCaches,
} = vi.hoisted(() => ({
  mockPlayerFindFirst: vi.fn(),
  mockTeamFindFirst: vi.fn(),
  mockPlayerUpdate: vi.fn(),
  mockTeamJoinRequestUpdateMany: vi.fn(),
  mockTeamJoinRequestFindFirst: vi.fn(),
  mockTeamTransferRequestUpdateMany: vi.fn(),
  mockUserFindUnique: vi.fn(),
  mockUserUpdate: vi.fn(),
  mockTransaction: vi.fn(),
  mockGetActiveSeasonForDivision: vi.fn(),
  mockInvalidateDivisionCaches: vi.fn(),
}));

vi.mock('../lib/prisma', () => ({
  prisma: {
    player: {
      findFirst: (...args: unknown[]) => mockPlayerFindFirst(...args),
    },
    team: {
      findFirst: (...args: unknown[]) => mockTeamFindFirst(...args),
    },
    $transaction: (fn: (tx: unknown) => Promise<void>) => mockTransaction(fn),
  },
}));

vi.mock('./SeasonService', () => ({
  SeasonService: {
    getActiveSeasonForDivision: (...args: unknown[]) => mockGetActiveSeasonForDivision(...args),
  },
}));

vi.mock('./registrationHelpers', () => ({
  invalidateDivisionCaches: (...args: unknown[]) => mockInvalidateDivisionCaches(...args),
}));

import { PlayerService } from './PlayerService';
import { PlayerServiceError } from '../errors/PlayerServiceError';

const SEASON_ID = 'season-boys-1';
const USER_ID = 'user-leave-1';
const PLAYER = {
  memberId: 7,
  teamId: 2,
  seasonId: SEASON_ID,
  userId: USER_ID,
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

describe('PlayerService.leaveTeam', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetActiveSeasonForDivision.mockResolvedValue({ id: SEASON_ID, division: Division.boys });
    mockPlayerFindFirst.mockResolvedValue(PLAYER);
    mockTeamFindFirst.mockResolvedValue(null);
    mockTransaction.mockImplementation(async (fn: (tx: ReturnType<typeof makeTx>) => Promise<void>) => {
      await fn(makeTx());
    });
    mockTeamJoinRequestFindFirst.mockResolvedValue(null);
    mockUserFindUnique.mockResolvedValue({
      mappedPlayerInfo: { teamId: 2, memberId: 7, status: 'approved' },
      playerProfile: { firstName: 'Leave', lastName: 'Test' },
    });
    mockInvalidateDivisionCaches.mockResolvedValue(undefined);
  });

  it('throws SEASON_NOT_ACTIVE when no active season', async () => {
    mockGetActiveSeasonForDivision.mockResolvedValue(null);

    await expect(PlayerService.leaveTeam(USER_ID, Division.boys)).rejects.toMatchObject({
      code: 'SEASON_NOT_ACTIVE',
      status: 503,
    } satisfies Partial<PlayerServiceError>);

    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it('throws NOT_ON_ROSTER when user is not on a team', async () => {
    mockPlayerFindFirst.mockResolvedValue(null);

    await expect(PlayerService.leaveTeam(USER_ID, Division.boys)).rejects.toMatchObject({
      code: 'NOT_ON_ROSTER',
      status: 400,
    } satisfies Partial<PlayerServiceError>);
  });

  it('throws TEAM_OWNER when user owns the team', async () => {
    mockTeamFindFirst.mockResolvedValue({ id: PLAYER.teamId });

    await expect(PlayerService.leaveTeam(USER_ID, Division.boys)).rejects.toMatchObject({
      code: 'TEAM_OWNER',
      status: 400,
    } satisfies Partial<PlayerServiceError>);

    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it('soft-deletes roster slot without clearing photo fields', async () => {
    await PlayerService.leaveTeam(USER_ID, Division.boys);

    expect(mockPlayerUpdate).toHaveBeenCalledWith({
      where: { memberId: PLAYER.memberId },
      data: { userId: null, active: false },
    });
  });

  it('checks cross-season pending joins before invalidating same-season requests', async () => {
    await PlayerService.leaveTeam(USER_ID, Division.boys);

    expect(mockTeamJoinRequestFindFirst).toHaveBeenCalledWith({
      where: {
        userId: USER_ID,
        seasonId: { not: SEASON_ID },
        status: { in: [RequestStatus.pending, RequestStatus.owner_approved] },
      },
    });
  });

  it('does not invalidate cache when transaction fails', async () => {
    mockTransaction.mockRejectedValue(new Error('tx failed'));

    await expect(PlayerService.leaveTeam(USER_ID, Division.boys)).rejects.toThrow('tx failed');

    expect(mockInvalidateDivisionCaches).not.toHaveBeenCalled();
  });

  it('invalidates division caches after leave', async () => {
    await PlayerService.leaveTeam(USER_ID, Division.boys);

    expect(mockInvalidateDivisionCaches).toHaveBeenCalledWith(Division.boys);
  });
});
