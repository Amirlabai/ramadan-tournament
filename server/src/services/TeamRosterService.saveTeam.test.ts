import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Division } from '@prisma/client';

const {
  mockPlayerUpsert,
  mockPlayerFindUnique,
  mockTeamUpdate,
  mockSeasonFindUnique,
  mockPlayerAggregate,
  mockExecuteRaw,
  mockTransaction,
  mockInvalidateDivisionCaches,
} = vi.hoisted(() => ({
  mockPlayerUpsert: vi.fn(),
  mockPlayerFindUnique: vi.fn(),
  mockTeamUpdate: vi.fn(),
  mockSeasonFindUnique: vi.fn(),
  mockPlayerAggregate: vi.fn(),
  mockExecuteRaw: vi.fn(),
  mockTransaction: vi.fn(),
  mockInvalidateDivisionCaches: vi.fn(),
}));

vi.mock('../lib/prisma', () => ({
  prisma: {
    player: {
      upsert: (...args: unknown[]) => mockPlayerUpsert(...args),
      aggregate: (...args: unknown[]) => mockPlayerAggregate(...args),
    },
    team: {
      update: (...args: unknown[]) => mockTeamUpdate(...args),
    },
    season: {
      findUnique: (...args: unknown[]) => mockSeasonFindUnique(...args),
    },
    $transaction: (fn: (tx: unknown) => Promise<void>) => mockTransaction(fn),
  },
}));

vi.mock('./registrationHelpers', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./registrationHelpers')>();
  return {
    ...actual,
    getNextMemberId: async () => {
      const result = await mockPlayerAggregate();
      return (result._max.memberId ?? 0) + 1;
    },
    invalidateDivisionCaches: (...args: unknown[]) => mockInvalidateDivisionCaches(...args),
  };
});

import { TeamRosterService } from './TeamRosterService';

const SEASON_ID = 'season-boys-1';

const basePlayer = {
  memberId: 99,
  firstName: 'Test',
  lastName: 'Player',
  nickname: 'TP',
  number: 7,
  position: 'הגנה',
  isCaptain: false,
  head_photo: '',
  pending_head_photo: '',
  bio: '',
};

function makeTx() {
  return {
    player: {
      upsert: mockPlayerUpsert,
      findUnique: mockPlayerFindUnique,
      aggregate: mockPlayerAggregate,
    },
    team: { update: mockTeamUpdate },
    $executeRaw: mockExecuteRaw,
  };
}

describe('TeamRosterService.saveTeam', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPlayerUpsert.mockResolvedValue({});
    mockPlayerFindUnique.mockResolvedValue({
      teamId: 1,
      seasonId: SEASON_ID,
      active: true,
    });
    mockTeamUpdate.mockResolvedValue({});
    mockSeasonFindUnique.mockResolvedValue({ division: Division.boys });
    mockInvalidateDivisionCaches.mockResolvedValue(undefined);
    mockTransaction.mockImplementation(async (fn: (tx: ReturnType<typeof makeTx>) => Promise<void>) =>
      fn(makeTx())
    );
  });

  it('upsert update sets teamId and reactivates when moving between teams', async () => {
    mockPlayerFindUnique.mockResolvedValue({
      teamId: 1,
      seasonId: SEASON_ID,
      active: true,
    });

    await TeamRosterService.saveTeam({
      id: 6,
      name: 'Team Six',
      seasonId: SEASON_ID,
      players: [basePlayer],
    });

    expect(mockPlayerUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { memberId: 99 },
        update: expect.objectContaining({
          teamId: 6,
          seasonId: SEASON_ID,
          active: true,
        }),
      })
    );
  });

  it('upsert update omits active when same team and already active', async () => {
    mockPlayerFindUnique.mockResolvedValue({
      teamId: 6,
      seasonId: SEASON_ID,
      active: true,
    });

    await TeamRosterService.saveTeam({
      id: 6,
      name: 'Team Six',
      seasonId: SEASON_ID,
      players: [basePlayer],
    });

    expect(mockPlayerUpsert.mock.calls[0][0].update).not.toHaveProperty('active');
  });

  it('upsert update reactivates when player was inactive', async () => {
    mockPlayerFindUnique.mockResolvedValue({
      teamId: 6,
      seasonId: SEASON_ID,
      active: false,
    });

    await TeamRosterService.saveTeam({
      id: 6,
      name: 'Team Six',
      seasonId: SEASON_ID,
      players: [basePlayer],
    });

    expect(mockPlayerUpsert.mock.calls[0][0].update).toEqual(
      expect.objectContaining({ active: true, teamId: 6 })
    );
  });

  it('upsert create sets active true for new players', async () => {
    mockPlayerFindUnique.mockResolvedValue(null);

    await TeamRosterService.saveTeam({
      id: 6,
      name: 'Team Six',
      seasonId: SEASON_ID,
      players: [{ ...basePlayer, memberId: 900 }],
    });

    expect(mockPlayerUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          memberId: 900,
          teamId: 6,
          seasonId: SEASON_ID,
          active: true,
        }),
      })
    );
  });

  it('runs player upserts and team update inside a transaction', async () => {
    await TeamRosterService.saveTeam({
      id: 6,
      name: 'Team Six',
      seasonId: SEASON_ID,
      players: [basePlayer],
    });

    expect(mockTransaction).toHaveBeenCalledTimes(1);
    expect(mockTeamUpdate).toHaveBeenCalled();
  });

  it('invalidates division caches after save by default', async () => {
    await TeamRosterService.saveTeam({
      id: 6,
      name: 'Team Six',
      seasonId: SEASON_ID,
      players: [basePlayer],
    });

    expect(mockInvalidateDivisionCaches).toHaveBeenCalledWith(Division.boys);
  });

  it('skips cache invalidation when invalidateCache is false', async () => {
    await TeamRosterService.saveTeam(
      { id: 6, name: 'Team Six', seasonId: SEASON_ID, players: [basePlayer] },
      { invalidateCache: false }
    );

    expect(mockInvalidateDivisionCaches).not.toHaveBeenCalled();
  });

  it('warns when season is missing during cache invalidation', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    mockSeasonFindUnique.mockResolvedValue(null);

    await TeamRosterService.saveTeam({
      id: 6,
      name: 'Team Six',
      seasonId: SEASON_ID,
      players: [basePlayer],
    });

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('invalidateTeamSeasonCaches: season not found')
    );
    warnSpy.mockRestore();
  });
});

describe('TeamRosterService.getNextMemberId', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uses global max member_id across all players (includes inactive)', async () => {
    mockPlayerAggregate.mockResolvedValue({ _max: { memberId: 850 } });

    const nextId = await TeamRosterService.getNextMemberId(Division.boys);

    expect(mockPlayerAggregate).toHaveBeenCalled();
    expect(nextId).toBe(851);
  });
});
