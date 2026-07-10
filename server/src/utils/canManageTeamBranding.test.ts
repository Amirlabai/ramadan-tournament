import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockTeamFindFirst, mockPlayerFindFirst, mockGetActiveSeasonForDivision, mockUserFindById } =
  vi.hoisted(() => ({
    mockTeamFindFirst: vi.fn(),
    mockPlayerFindFirst: vi.fn(),
    mockGetActiveSeasonForDivision: vi.fn(),
    mockUserFindById: vi.fn(),
  }));

vi.mock('../lib/prisma', () => ({
  prisma: {
    team: {
      findFirst: (...args: unknown[]) => mockTeamFindFirst(...args),
    },
    player: {
      findFirst: (...args: unknown[]) => mockPlayerFindFirst(...args),
    },
  },
}));

vi.mock('../services/SeasonService', () => ({
  SeasonService: {
    getActiveSeasonForDivision: (...args: unknown[]) => mockGetActiveSeasonForDivision(...args),
  },
}));

vi.mock('../models/User', () => ({
  User: {
    findById: (...args: unknown[]) => mockUserFindById(...args),
  },
}));

import { canManageTeamBranding, canManageTeamRosterPlayers, isTeamOwnerOrPlatformAdmin } from './canManageTeamBranding';

describe('canManageTeamBranding', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUserFindById.mockResolvedValue({ role: 'user' });
    mockTeamFindFirst.mockResolvedValue(null);
    mockPlayerFindFirst.mockResolvedValue(null);
    mockGetActiveSeasonForDivision.mockResolvedValue({ id: 'season-boys' });
  });

  it('allows platform admin', async () => {
    mockUserFindById.mockResolvedValue({ role: 'admin' });
    await expect(canManageTeamBranding('admin-1', 7, 'boys')).resolves.toBe(true);
    expect(mockGetActiveSeasonForDivision).not.toHaveBeenCalled();
  });

  it('allows team owner in active season', async () => {
    mockTeamFindFirst.mockResolvedValue({ id: 7 });
    await expect(canManageTeamBranding('owner-1', 7, 'boys')).resolves.toBe(true);
    expect(mockTeamFindFirst).toHaveBeenCalledWith({
      where: { id: 7, ownerUserId: 'owner-1', seasonId: 'season-boys' },
      select: { id: true },
    });
    expect(mockPlayerFindFirst).not.toHaveBeenCalled();
  });

  it('allows claimed squad captain', async () => {
    mockPlayerFindFirst.mockResolvedValue({ memberId: 1 });
    await expect(canManageTeamBranding('captain-1', 7, 'boys')).resolves.toBe(true);
    expect(mockPlayerFindFirst).toHaveBeenCalledWith({
      where: {
        seasonId: 'season-boys',
        teamId: 7,
        userId: 'captain-1',
        active: true,
        isCaptain: true,
      },
      select: { memberId: true },
    });
  });

  it('denies non-captain roster player', async () => {
    await expect(canManageTeamBranding('player-1', 7, 'boys')).resolves.toBe(false);
  });

  it('denies inactive claimed captain (active filter)', async () => {
    // findFirst returns null when active:true does not match
    mockPlayerFindFirst.mockResolvedValue(null);
    await expect(canManageTeamBranding('captain-1', 7, 'boys')).resolves.toBe(false);
    expect(mockPlayerFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ active: true, isCaptain: true, teamId: 7 }),
      })
    );
  });

  it('denies captain of a different teamId', async () => {
    mockPlayerFindFirst.mockResolvedValue(null);
    await expect(canManageTeamBranding('captain-1', 99, 'boys')).resolves.toBe(false);
    expect(mockPlayerFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ teamId: 99, userId: 'captain-1' }),
      })
    );
  });

  it('denies when no active season', async () => {
    mockGetActiveSeasonForDivision.mockRejectedValue(new Error('no season'));
    await expect(canManageTeamBranding('owner-1', 7, 'boys')).resolves.toBe(false);
    await expect(canManageTeamBranding('captain-1', 7, 'boys')).resolves.toBe(false);
    expect(mockTeamFindFirst).not.toHaveBeenCalled();
    expect(mockPlayerFindFirst).not.toHaveBeenCalled();
  });
});

describe('isTeamOwnerOrPlatformAdmin', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUserFindById.mockResolvedValue({ role: 'user' });
    mockTeamFindFirst.mockResolvedValue(null);
  });

  it('allows platform admin without team lookup', async () => {
    mockUserFindById.mockResolvedValue({ role: 'Admin' });
    await expect(isTeamOwnerOrPlatformAdmin('admin-1', 7, 'boys')).resolves.toBe(true);
    expect(mockTeamFindFirst).not.toHaveBeenCalled();
  });

  it('allows owner in division (any season) and ignores captain path', async () => {
    mockTeamFindFirst.mockResolvedValue({ id: 7 });
    await expect(isTeamOwnerOrPlatformAdmin('owner-1', 7, 'boys')).resolves.toBe(true);
    expect(mockGetActiveSeasonForDivision).not.toHaveBeenCalled();
    expect(mockPlayerFindFirst).not.toHaveBeenCalled();
  });

  it('denies claimed captain who is not owner', async () => {
    await expect(isTeamOwnerOrPlatformAdmin('captain-1', 7, 'boys')).resolves.toBe(false);
  });
});

describe('canManageTeamRosterPlayers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUserFindById.mockResolvedValue({ role: 'user' });
    mockTeamFindFirst.mockResolvedValue(null);
    mockPlayerFindFirst.mockResolvedValue(null);
    mockGetActiveSeasonForDivision.mockResolvedValue({ id: 'season-boys' });
  });

  it('allows platform admin', async () => {
    mockUserFindById.mockResolvedValue({ role: 'admin' });
    await expect(canManageTeamRosterPlayers('admin-1', 7, 'boys')).resolves.toBe(true);
  });

  it('allows team owner via canActorReviewPendingJoin', async () => {
    mockTeamFindFirst.mockResolvedValue({ ownerUserId: 'owner-1' });
    await expect(canManageTeamRosterPlayers('owner-1', 7, 'boys')).resolves.toBe(true);
  });

  it('allows claimed captain', async () => {
    mockTeamFindFirst.mockResolvedValue({ ownerUserId: 'other' });
    mockPlayerFindFirst.mockResolvedValue({ memberId: 1 });
    await expect(canManageTeamRosterPlayers('captain-1', 7, 'boys')).resolves.toBe(true);
  });

  it('denies unrelated user', async () => {
    mockTeamFindFirst.mockResolvedValue({ ownerUserId: 'owner-1' });
    mockPlayerFindFirst.mockResolvedValue(null);
    await expect(canManageTeamRosterPlayers('player-1', 7, 'boys')).resolves.toBe(false);
  });
});
