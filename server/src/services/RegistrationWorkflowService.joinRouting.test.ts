import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Division, RequestStatus, TeamStatus } from '@prisma/client';

const {
  mockPlayerFindFirst,
  mockTeamFindFirst,
  mockTeamJoinRequestFindFirst,
  mockTeamCreationRequestFindFirst,
  mockTransaction,
  mockGetActiveSeasonForDivision,
  mockAssertDivisionAccess,
  mockLockActiveDivision,
  mockTeamJoinRequestCreate,
  mockTeamJoinRequestUpdateMany,
  mockTeamCreationRequestUpdateMany,
  mockSeasonRegistrationUpsert,
  mockUserFindUnique,
  mockUserUpdate,
} = vi.hoisted(() => ({
  mockPlayerFindFirst: vi.fn(),
  mockTeamFindFirst: vi.fn(),
  mockTeamJoinRequestFindFirst: vi.fn(),
  mockTeamCreationRequestFindFirst: vi.fn(),
  mockTransaction: vi.fn(),
  mockGetActiveSeasonForDivision: vi.fn(),
  mockAssertDivisionAccess: vi.fn(),
  mockLockActiveDivision: vi.fn(),
  mockTeamJoinRequestCreate: vi.fn(),
  mockTeamJoinRequestUpdateMany: vi.fn(),
  mockTeamCreationRequestUpdateMany: vi.fn(),
  mockSeasonRegistrationUpsert: vi.fn(),
  mockUserFindUnique: vi.fn(),
  mockUserUpdate: vi.fn(),
}));

vi.mock('../lib/prisma', () => ({
  prisma: {
    player: {
      findFirst: (...args: unknown[]) => mockPlayerFindFirst(...args),
    },
    team: {
      findFirst: (...args: unknown[]) => mockTeamFindFirst(...args),
    },
    teamJoinRequest: {
      findFirst: (...args: unknown[]) => mockTeamJoinRequestFindFirst(...args),
    },
    teamCreationRequest: {
      findFirst: (...args: unknown[]) => mockTeamCreationRequestFindFirst(...args),
    },
    $transaction: (fn: (tx: unknown) => Promise<unknown>) => mockTransaction(fn),
  },
}));

vi.mock('./SeasonService', () => ({
  SeasonService: {
    getActiveSeasonForDivision: (...args: unknown[]) => mockGetActiveSeasonForDivision(...args),
  },
}));

vi.mock('./registrationHelpers', async () => {
  const actual = await vi.importActual<typeof import('./registrationHelpers')>('./registrationHelpers');
  return {
    ...actual,
    assertDivisionAccess: (...args: unknown[]) => mockAssertDivisionAccess(...args),
    lockActiveDivision: (...args: unknown[]) => mockLockActiveDivision(...args),
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
    },
    team: {
      findFirst: mockTeamFindFirst,
    },
    teamJoinRequest: {
      updateMany: mockTeamJoinRequestUpdateMany,
      create: mockTeamJoinRequestCreate,
      findMany: vi.fn().mockResolvedValue([]),
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
