import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Division, RequestStatus, SeasonRegistrationStatus, TeamStatus } from '@prisma/client';

const {
  mockPlayerFindFirst,
  mockPlayerFindMany,
  mockPlayerCreate,
  mockPlayerUpdate,
  mockTeamFindFirst,
  mockTeamJoinRequestFindFirst,
  mockTeamJoinRequestFindUniqueOrThrow,
  mockTeamJoinRequestUpdate,
  mockTeamCreationRequestFindFirst,
  mockTransaction,
  mockGetActiveSeasonForDivision,
  mockAssertDivisionAccess,
  mockLockActiveDivision,
  mockTeamJoinRequestCreate,
  mockTeamJoinRequestUpdateMany,
  mockTeamCreationRequestUpdateMany,
  mockSeasonRegistrationUpsert,
  mockSeasonRegistrationFindUnique,
  mockUserFindUnique,
  mockUserUpdate,
  mockGetNextMemberId,
  mockInvalidateDivisionCaches,
  mockAssertMatchedIdentityForApproval,
} = vi.hoisted(() => ({
  mockPlayerFindFirst: vi.fn(),
  mockPlayerFindMany: vi.fn(),
  mockPlayerCreate: vi.fn(),
  mockPlayerUpdate: vi.fn(),
  mockTeamFindFirst: vi.fn(),
  mockTeamJoinRequestFindFirst: vi.fn(),
  mockTeamJoinRequestFindUniqueOrThrow: vi.fn(),
  mockTeamJoinRequestUpdate: vi.fn(),
  mockTeamCreationRequestFindFirst: vi.fn(),
  mockTransaction: vi.fn(),
  mockGetActiveSeasonForDivision: vi.fn(),
  mockAssertDivisionAccess: vi.fn(),
  mockLockActiveDivision: vi.fn(),
  mockTeamJoinRequestCreate: vi.fn(),
  mockTeamJoinRequestUpdateMany: vi.fn(),
  mockTeamCreationRequestUpdateMany: vi.fn(),
  mockSeasonRegistrationUpsert: vi.fn(),
  mockSeasonRegistrationFindUnique: vi.fn(),
  mockUserFindUnique: vi.fn(),
  mockUserUpdate: vi.fn(),
  mockGetNextMemberId: vi.fn(),
  mockInvalidateDivisionCaches: vi.fn(),
  mockAssertMatchedIdentityForApproval: vi.fn(),
}));

vi.mock('../lib/prisma', () => ({
  prisma: {
    player: {
      findFirst: (...args: unknown[]) => mockPlayerFindFirst(...args),
      findMany: (...args: unknown[]) => mockPlayerFindMany(...args),
      create: (...args: unknown[]) => mockPlayerCreate(...args),
      update: (...args: unknown[]) => mockPlayerUpdate(...args),
    },
    team: {
      findFirst: (...args: unknown[]) => mockTeamFindFirst(...args),
    },
    teamJoinRequest: {
      findFirst: (...args: unknown[]) => mockTeamJoinRequestFindFirst(...args),
      findUniqueOrThrow: (...args: unknown[]) => mockTeamJoinRequestFindUniqueOrThrow(...args),
      update: (...args: unknown[]) => mockTeamJoinRequestUpdate(...args),
    },
    teamCreationRequest: {
      findFirst: (...args: unknown[]) => mockTeamCreationRequestFindFirst(...args),
    },
    seasonRegistration: {
      findUnique: (...args: unknown[]) => mockSeasonRegistrationFindUnique(...args),
    },
    $transaction: (fn: (tx: unknown) => Promise<unknown>) => mockTransaction(fn),
  },
}));

vi.mock('./SeasonService', () => ({
  SeasonService: {
    getActiveSeasonForDivision: (...args: unknown[]) => mockGetActiveSeasonForDivision(...args),
  },
}));

vi.mock('./RegistrationIdentityService', () => ({
  assertMatchedIdentityForApproval: (...args: unknown[]) =>
    mockAssertMatchedIdentityForApproval(...args),
}));

vi.mock('./registrationHelpers', async () => {
  const actual = await vi.importActual<typeof import('./registrationHelpers')>('./registrationHelpers');
  return {
    ...actual,
    assertDivisionAccess: (...args: unknown[]) => mockAssertDivisionAccess(...args),
    lockActiveDivision: (...args: unknown[]) => mockLockActiveDivision(...args),
    getNextMemberId: (...args: unknown[]) => mockGetNextMemberId(...args),
    invalidateDivisionCaches: (...args: unknown[]) => mockInvalidateDivisionCaches(...args),
  };
});

import { RegistrationWorkflowService } from './RegistrationWorkflowService';

const USER_ID = 'user-join-1';
const TEAM_ID = 12;
const SEASON_ID = 'season-1';

function makeTx() {
  return {
    player: {
      findFirst: mockPlayerFindFirst,
      findMany: mockPlayerFindMany,
      create: mockPlayerCreate,
      update: mockPlayerUpdate,
    },
    team: {
      findFirst: mockTeamFindFirst,
    },
    teamJoinRequest: {
      updateMany: mockTeamJoinRequestUpdateMany,
      create: mockTeamJoinRequestCreate,
      findMany: vi.fn().mockResolvedValue([]),
      update: mockTeamJoinRequestUpdate,
    },
    teamCreationRequest: {
      updateMany: mockTeamCreationRequestUpdateMany,
    },
    seasonRegistration: {
      upsert: mockSeasonRegistrationUpsert,
    },
    user: {
      findUnique: mockUserFindUnique,
      update: mockUserUpdate,
    },
  };
}

function makeAdminApproveTx() {
  return {
    player: {
      findFirst: mockPlayerFindFirst,
      findMany: mockPlayerFindMany,
      create: mockPlayerCreate,
      update: mockPlayerUpdate,
    },
    teamJoinRequest: {
      update: mockTeamJoinRequestUpdate,
    },
    user: {
      update: mockUserUpdate,
    },
  };
}

describe('RegistrationWorkflowService submit join routing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetActiveSeasonForDivision.mockResolvedValue({ id: SEASON_ID, division: Division.boys });
    mockAssertDivisionAccess.mockResolvedValue(undefined);
    mockLockActiveDivision.mockResolvedValue(undefined);
    mockTeamJoinRequestFindFirst.mockResolvedValue(null);
    mockTeamCreationRequestFindFirst.mockResolvedValue(null);
    mockTeamJoinRequestCreate.mockResolvedValue({ id: 'join-1' });
    mockSeasonRegistrationUpsert.mockResolvedValue(undefined);
    mockUserFindUnique.mockResolvedValue({ playerProfile: null });
    mockUserUpdate.mockResolvedValue(undefined);
    mockTransaction.mockImplementation(async (fn: (tx: ReturnType<typeof makeTx>) => Promise<unknown>) =>
      fn(makeTx())
    );
    vi.spyOn(RegistrationWorkflowService, 'assertRegistrationActiveForRequest').mockResolvedValue(undefined);
  });

  it('creates pending join when a reviewer exists (claimed captain)', async () => {
    mockPlayerFindFirst
      .mockResolvedValueOnce(null) // onRoster
      .mockResolvedValueOnce({ memberId: 99 }); // claimed captain exists
    mockTeamFindFirst
      .mockResolvedValueOnce({ id: TEAM_ID, seasonId: SEASON_ID, status: TeamStatus.active }) // active team
      .mockResolvedValueOnce({ ownerUserId: null }); // reviewer coverage check

    await RegistrationWorkflowService.submitJoinRequest(USER_ID, Division.boys, TEAM_ID);

    expect(mockTeamJoinRequestCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ status: RequestStatus.pending }),
    });
  });

  it('creates pending join when team owner exists', async () => {
    mockPlayerFindFirst
      .mockResolvedValueOnce(null); // onRoster
    mockTeamFindFirst
      .mockResolvedValueOnce({ id: TEAM_ID, seasonId: SEASON_ID, status: TeamStatus.active }) // active team
      .mockResolvedValueOnce({ ownerUserId: 'owner-1' }); // reviewer coverage via owner

    await RegistrationWorkflowService.submitJoinRequest(USER_ID, Division.boys, TEAM_ID);

    expect(mockTeamJoinRequestCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ status: RequestStatus.pending }),
    });
  });

  it('creates owner_approved join when no owner and no claimed captain', async () => {
    mockPlayerFindFirst
      .mockResolvedValueOnce(null) // onRoster
      .mockResolvedValueOnce(null); // no claimed captain
    mockTeamFindFirst
      .mockResolvedValueOnce({ id: TEAM_ID, seasonId: SEASON_ID, status: TeamStatus.active }) // active team
      .mockResolvedValueOnce({ ownerUserId: null }); // reviewer coverage check

    await RegistrationWorkflowService.submitJoinRequest(USER_ID, Division.boys, TEAM_ID);

    expect(mockTeamJoinRequestCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ status: RequestStatus.owner_approved }),
    });
  });
});

describe('RegistrationWorkflowService admin pending count', () => {
  it('counts only owner_approved joins as admin-actionable', async () => {
    const listSpy = vi
      .spyOn(RegistrationWorkflowService, 'listPendingWorkflows')
      .mockResolvedValue({
        season: { id: SEASON_ID } as any,
        creations: [{ id: 'c1' }] as any,
        joins: [{ id: 'j1', status: RequestStatus.pending }, { id: 'j2', status: RequestStatus.owner_approved }] as any,
        transfers: [{ id: 't1' }] as any,
        awaitingIdentity: [{ userId: 'u1' }] as any,
      });

    const total = await RegistrationWorkflowService.countPendingAdminActionsForSeason(SEASON_ID);

    expect(total).toBe(4);
    expect(listSpy).toHaveBeenCalledWith(SEASON_ID);
  });
});

describe('RegistrationWorkflowService adminReviewJoin', () => {
  const REQUEST_ID = 'join-admin-1';
  const ADMIN_ID = 'admin-1';

  beforeEach(() => {
    vi.clearAllMocks();
    mockAssertMatchedIdentityForApproval.mockResolvedValue(undefined);
    mockSeasonRegistrationFindUnique.mockResolvedValue({
      status: SeasonRegistrationStatus.active,
    });
    mockTeamJoinRequestFindUniqueOrThrow.mockResolvedValue({
      id: REQUEST_ID,
      userId: USER_ID,
      teamId: TEAM_ID,
      seasonId: SEASON_ID,
      status: RequestStatus.owner_approved,
      season: { division: Division.boys },
      user: {
        id: USER_ID,
        displayName: 'Test User',
        playerProfile: {
          firstName: 'Test',
          lastName: 'User',
          nickname: 'Tester',
          number: 7,
          position: '',
        },
      },
    });
    mockPlayerFindMany.mockResolvedValue([]);
    mockGetNextMemberId.mockResolvedValue(501);
    mockPlayerCreate.mockResolvedValue({ memberId: 501 });
    mockUserUpdate.mockResolvedValue(undefined);
    mockTeamJoinRequestUpdate.mockResolvedValue(undefined);
    mockInvalidateDivisionCaches.mockResolvedValue(undefined);
    mockTransaction.mockImplementation(
      async (fn: (tx: ReturnType<typeof makeAdminApproveTx>) => Promise<unknown>) =>
        fn(makeAdminApproveTx())
    );
  });

  it('creates a new player when no requestedMemberId and no existing link', async () => {
    mockPlayerFindFirst.mockResolvedValue(null);

    await RegistrationWorkflowService.adminReviewJoin(REQUEST_ID, ADMIN_ID, true);

    expect(mockPlayerCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        memberId: 501,
        userId: USER_ID,
        teamId: TEAM_ID,
        seasonId: SEASON_ID,
        firstName: 'Test',
      }),
    });
    expect(mockPlayerUpdate).not.toHaveBeenCalled();
  });

  it('links an existing slot when requestedMemberId is set', async () => {
    mockTeamJoinRequestFindUniqueOrThrow.mockResolvedValue({
      id: REQUEST_ID,
      userId: USER_ID,
      teamId: TEAM_ID,
      seasonId: SEASON_ID,
      status: RequestStatus.owner_approved,
      season: { division: Division.boys },
      user: {
        id: USER_ID,
        displayName: 'Test User',
        playerProfile: {
          firstName: 'Test',
          lastName: 'User',
          nickname: 'Tester',
          number: 7,
          position: 'חלוץ',
          requestedMemberId: 88,
        },
      },
    });
    mockPlayerFindFirst.mockResolvedValue({
      memberId: 88,
      teamId: TEAM_ID,
      seasonId: SEASON_ID,
      userId: null,
      firstName: 'Roster',
      lastName: 'Slot',
      nickname: 'Slotty',
      number: 9,
      position: 'בלם',
      active: true,
    });
    mockPlayerUpdate.mockResolvedValue({ memberId: 88 });

    await RegistrationWorkflowService.adminReviewJoin(REQUEST_ID, ADMIN_ID, true);

    expect(mockPlayerUpdate).toHaveBeenCalledWith({
      where: { memberId: 88 },
      data: expect.objectContaining({
        userId: USER_ID,
        position: 'חלוץ',
      }),
    });
    expect(mockPlayerCreate).not.toHaveBeenCalled();
  });

  it('keeps slot position when linking with empty profile position', async () => {
    mockTeamJoinRequestFindUniqueOrThrow.mockResolvedValue({
      id: REQUEST_ID,
      userId: USER_ID,
      teamId: TEAM_ID,
      seasonId: SEASON_ID,
      status: RequestStatus.owner_approved,
      season: { division: Division.boys },
      user: {
        id: USER_ID,
        displayName: 'Test User',
        playerProfile: {
          firstName: 'Test',
          lastName: 'User',
          nickname: 'Tester',
          number: 7,
          position: '',
          requestedMemberId: 88,
        },
      },
    });
    mockPlayerFindFirst.mockResolvedValue({
      memberId: 88,
      teamId: TEAM_ID,
      seasonId: SEASON_ID,
      userId: null,
      firstName: 'Roster',
      lastName: 'Slot',
      nickname: 'Slotty',
      number: 9,
      position: 'בלם',
      active: true,
    });
    mockPlayerUpdate.mockResolvedValue({ memberId: 88 });

    await RegistrationWorkflowService.adminReviewJoin(REQUEST_ID, ADMIN_ID, true);

    expect(mockPlayerUpdate).toHaveBeenCalledWith({
      where: { memberId: 88 },
      data: expect.objectContaining({
        userId: USER_ID,
        position: 'בלם',
      }),
    });
    expect(mockPlayerCreate).not.toHaveBeenCalled();
  });
});
