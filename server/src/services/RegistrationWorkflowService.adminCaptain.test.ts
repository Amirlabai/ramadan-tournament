import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Division, ScoringMode, SquadRole } from '@prisma/client';

const {
  mockPlayerFindFirst,
  mockPlayerFindMany,
  mockPlayerUpdateMany,
  mockTeamFindFirst,
  mockTransaction,
  mockGetActiveSeasonForDivision,
  mockInvalidateDivisionCaches,
  mockSyncTeamJoinReviewQueue,
} = vi.hoisted(() => ({
  mockPlayerFindFirst: vi.fn(),
  mockPlayerFindMany: vi.fn(),
  mockPlayerUpdateMany: vi.fn(),
  mockTeamFindFirst: vi.fn(),
  mockTransaction: vi.fn(),
  mockGetActiveSeasonForDivision: vi.fn(),
  mockInvalidateDivisionCaches: vi.fn(),
  mockSyncTeamJoinReviewQueue: vi.fn(),
}));

vi.mock('../lib/prisma', () => ({
  prisma: {
    player: {
      findFirst: (...args: unknown[]) => mockPlayerFindFirst(...args),
      findMany: (...args: unknown[]) => mockPlayerFindMany(...args),
      updateMany: (...args: unknown[]) => mockPlayerUpdateMany(...args),
    },
    team: {
      findFirst: (...args: unknown[]) => mockTeamFindFirst(...args),
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
    invalidateDivisionCaches: (...args: unknown[]) => mockInvalidateDivisionCaches(...args),
  };
});

vi.mock('../utils/syncTeamJoinReviewQueue', () => ({
  syncTeamJoinReviewQueue: (...args: unknown[]) => mockSyncTeamJoinReviewQueue(...args),
  syncOpenJoinQueuesForSeason: vi.fn(),
}));

import { RegistrationWorkflowService } from './RegistrationWorkflowService';

const SEASON_ID = 'season-captain-1';
const TEAM_ID = 7;

function makeTx() {
  return {
    player: {
      updateMany: mockPlayerUpdateMany,
    },
  };
}

describe('RegistrationWorkflowService captain admin APIs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetActiveSeasonForDivision.mockResolvedValue({
      id: SEASON_ID,
      division: Division.boys,
      scoringMode: ScoringMode.football,
    });
    mockTeamFindFirst.mockResolvedValue({ id: TEAM_ID, name: 'קבוצה א' });
    mockTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
      fn(makeTx())
    );
    mockPlayerUpdateMany.mockResolvedValue({ count: 1 });
    mockSyncTeamJoinReviewQueue.mockResolvedValue(undefined);
    mockInvalidateDivisionCaches.mockResolvedValue(undefined);
  });

  describe('listCaptainCandidates', () => {
    it('returns linked and unlinked candidates without user IDs', async () => {
      mockPlayerFindMany.mockResolvedValue([
        {
          memberId: 1,
          firstName: 'אחמד',
          lastName: 'כהן',
          nickname: 'אחמד',
          number: 10,
          isCaptain: true,
          userId: 'user-1',
        },
        {
          memberId: 2,
          firstName: 'יוסף',
          lastName: 'לוי',
          nickname: 'יוסי',
          number: 7,
          isCaptain: false,
          userId: null,
        },
      ]);

      const result = await RegistrationWorkflowService.listCaptainCandidates(TEAM_ID, Division.boys);

      expect(result.teamName).toBe('קבוצה א');
      expect(result.currentCaptainMemberId).toBe(1);
      expect(result.candidates).toEqual([
        expect.objectContaining({
          memberId: 1,
          isCaptain: true,
          hasLinkedUser: true,
        }),
        expect.objectContaining({
          memberId: 2,
          isCaptain: false,
          hasLinkedUser: false,
        }),
      ]);
      expect(JSON.stringify(result)).not.toContain('user-1');
      expect(JSON.stringify(result)).not.toMatch(/"userId"/);
    });

    it('rejects missing team', async () => {
      mockTeamFindFirst.mockResolvedValue(null);
      await expect(
        RegistrationWorkflowService.listCaptainCandidates(TEAM_ID, Division.boys)
      ).rejects.toThrow('הקבוצה לא נמצאה');
    });
  });

  describe('adminSetCaptain', () => {
    it('demotes previous captain, promotes selected player, syncs queue, invalidates cache', async () => {
      mockPlayerFindFirst
        .mockResolvedValueOnce({
          memberId: 2,
          firstName: 'יוסף',
          lastName: 'לוי',
          nickname: 'יוסי',
          isCaptain: false,
          userId: 'user-2',
        })
        .mockResolvedValueOnce({
          memberId: 1,
          firstName: 'אחמד',
          lastName: 'כהן',
          nickname: 'אחמד',
        });
      mockPlayerFindMany.mockResolvedValue([
        { memberId: 1, squadRole: SquadRole.captain },
        { memberId: 2, squadRole: null },
      ]);

      const result = await RegistrationWorkflowService.adminSetCaptain(
        TEAM_ID,
        Division.boys,
        2
      );

      expect(result).toMatchObject({
        teamId: TEAM_ID,
        memberId: 2,
        hasLinkedUser: true,
        previousCaptainMemberId: 1,
        alreadyCaptain: false,
        message: 'הקפטן עודכן',
      });

      expect(mockPlayerUpdateMany).toHaveBeenCalledWith({
        where: {
          seasonId: SEASON_ID,
          teamId: TEAM_ID,
          OR: [{ isCaptain: true }, { squadRole: SquadRole.captain }],
          NOT: { memberId: 2 },
        },
        data: { squadRole: null, isCaptain: false },
      });
      expect(mockPlayerUpdateMany).toHaveBeenCalledWith({
        where: {
          seasonId: SEASON_ID,
          teamId: TEAM_ID,
          memberId: 2,
          active: true,
        },
        data: { squadRole: SquadRole.captain, isCaptain: true },
      });
      expect(mockSyncTeamJoinReviewQueue).toHaveBeenCalledWith(
        expect.anything(),
        SEASON_ID,
        TEAM_ID
      );
      expect(mockInvalidateDivisionCaches).toHaveBeenCalledWith(Division.boys);
    });

    it('allows selecting an unlinked player and reports hasLinkedUser false', async () => {
      mockPlayerFindFirst
        .mockResolvedValueOnce({
          memberId: 3,
          firstName: 'סאמר',
          lastName: 'חאג',
          nickname: '',
          isCaptain: false,
          userId: null,
        })
        .mockResolvedValueOnce(null);
      mockPlayerFindMany.mockResolvedValue([{ memberId: 3, squadRole: null }]);

      const result = await RegistrationWorkflowService.adminSetCaptain(
        TEAM_ID,
        Division.boys,
        3
      );

      expect(result.hasLinkedUser).toBe(false);
      expect(result.alreadyCaptain).toBe(false);
      expect(mockSyncTeamJoinReviewQueue).toHaveBeenCalled();
      expect(mockInvalidateDivisionCaches).toHaveBeenCalled();
    });

    it('rejects promoting a bench player when football lineup is already full', async () => {
      mockPlayerFindFirst
        .mockResolvedValueOnce({
          memberId: 99,
          firstName: 'ספסל',
          lastName: 'שחקן',
          nickname: '',
          isCaptain: false,
          userId: null,
        })
        .mockResolvedValueOnce(null);
      mockPlayerFindMany.mockResolvedValue([
        { memberId: 1, squadRole: SquadRole.goalkeeper },
        { memberId: 2, squadRole: SquadRole.attack },
        { memberId: 3, squadRole: SquadRole.attack },
        { memberId: 4, squadRole: SquadRole.defense },
        { memberId: 5, squadRole: SquadRole.defense },
        { memberId: 6, squadRole: SquadRole.defense },
        { memberId: 99, squadRole: null },
      ]);

      await expect(
        RegistrationWorkflowService.adminSetCaptain(TEAM_ID, Division.boys, 99)
      ).rejects.toThrow('ניתן להגדיר עד 5 שחקני שדה בהרכב פתיחה');

      expect(mockTransaction).not.toHaveBeenCalled();
      expect(mockInvalidateDivisionCaches).not.toHaveBeenCalled();
    });

    it('no-ops when player is already the only captain', async () => {
      mockPlayerFindFirst
        .mockResolvedValueOnce({
          memberId: 1,
          firstName: 'אחמד',
          lastName: 'כהן',
          nickname: 'אחמד',
          isCaptain: true,
          userId: 'user-1',
        })
        .mockResolvedValueOnce(null);

      const result = await RegistrationWorkflowService.adminSetCaptain(
        TEAM_ID,
        Division.boys,
        1
      );

      expect(result.alreadyCaptain).toBe(true);
      expect(mockTransaction).not.toHaveBeenCalled();
      expect(mockInvalidateDivisionCaches).not.toHaveBeenCalled();
    });

    it('rejects inactive or missing players', async () => {
      mockPlayerFindFirst.mockResolvedValueOnce(null);

      await expect(
        RegistrationWorkflowService.adminSetCaptain(TEAM_ID, Division.boys, 99)
      ).rejects.toThrow('השחקן לא נמצא בסגל הפעיל של הקבוצה');

      expect(mockTransaction).not.toHaveBeenCalled();
    });

    it('rejects missing team', async () => {
      mockTeamFindFirst.mockResolvedValue(null);

      await expect(
        RegistrationWorkflowService.adminSetCaptain(TEAM_ID, Division.boys, 1)
      ).rejects.toThrow('הקבוצה לא נמצאה');
    });
  });
});
