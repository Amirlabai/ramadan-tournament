import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RequestStatus } from '@prisma/client';

const { mockPlayerFindFirst, mockTeamJoinRequestUpdateMany } = vi.hoisted(() => ({
  mockPlayerFindFirst: vi.fn(),
  mockTeamJoinRequestUpdateMany: vi.fn(),
}));

import { syncTeamJoinReviewQueue } from './syncTeamJoinReviewQueue';

const SEASON_ID = 'season-1';
const TEAM_ID = 7;

function makeDb() {
  return {
    player: { findFirst: mockPlayerFindFirst },
    teamJoinRequest: { updateMany: mockTeamJoinRequestUpdateMany },
  };
}

describe('syncTeamJoinReviewQueue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTeamJoinRequestUpdateMany.mockResolvedValue({ count: 1 });
  });

  it('reopens auto-skipped owner_approved to pending when claimed captain exists', async () => {
    mockPlayerFindFirst.mockResolvedValue({ memberId: 1 });

    await syncTeamJoinReviewQueue(makeDb(), SEASON_ID, TEAM_ID);

    expect(mockTeamJoinRequestUpdateMany).toHaveBeenCalledWith({
      where: {
        seasonId: SEASON_ID,
        teamId: TEAM_ID,
        status: RequestStatus.owner_approved,
        adminReviewedAt: null,
        ownerReviewedAt: null,
      },
      data: { status: RequestStatus.pending },
    });
  });

  it('does not reopen captain-approved admin-queue rows (ownerReviewedAt set)', async () => {
    mockPlayerFindFirst.mockResolvedValue({ memberId: 1 });

    await syncTeamJoinReviewQueue(makeDb(), SEASON_ID, TEAM_ID);

    const reopenWhere = mockTeamJoinRequestUpdateMany.mock.calls[0]?.[0]?.where;
    expect(reopenWhere).toEqual(
      expect.objectContaining({
        status: RequestStatus.owner_approved,
        ownerReviewedAt: null,
        adminReviewedAt: null,
      })
    );
    // Rows with ownerReviewedAt set fail this filter and stay owner_approved for admin.
  });

  it('promotes pending to owner_approved when no claimed captain', async () => {
    mockPlayerFindFirst.mockResolvedValue(null);

    await syncTeamJoinReviewQueue(makeDb(), SEASON_ID, TEAM_ID);

    expect(mockTeamJoinRequestUpdateMany).toHaveBeenCalledWith({
      where: {
        seasonId: SEASON_ID,
        teamId: TEAM_ID,
        status: RequestStatus.pending,
      },
      data: { status: RequestStatus.owner_approved },
    });
  });
});
