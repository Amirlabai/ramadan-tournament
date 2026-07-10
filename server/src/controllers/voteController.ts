import { Response } from 'express';
import { Division, TeamStatus } from '@prisma/client';
import { AuthRequest } from '../middleware/auth';
import { getRequestDivision, TournamentRequest } from '../middleware/tournamentDivision';
import { prisma } from '../lib/prisma';
import { SeasonService } from '../services/SeasonService';

type VoteReq = AuthRequest & TournamentRequest;

async function getSeasonForVote(req: VoteReq) {
  return SeasonService.getActiveSeason(getRequestDivision(req));
}

export const castVote = async (req: VoteReq, res: Response): Promise<void> => {
  try {
    const userId = req.userId;
    if (!userId) {
      res.status(401).json({ message: 'User not authenticated' });
      return;
    }

    const division = getRequestDivision(req);
    const season = await getSeasonForVote(req);
    const { playerMemberId, teamId, category = 'mvp' } = req.body as {
      playerMemberId?: number;
      teamId?: number;
      category?: string;
    };

    const existing = await prisma.vote.findUnique({
      where: {
        userId_seasonId_category: { userId, seasonId: season.id, category },
      },
    });

    if (division === Division.girls) {
      if (!teamId) {
        res.status(400).json({ message: 'teamId is required for girls MVP vote' });
        return;
      }
      const team = await prisma.team.findFirst({
        where: { seasonId: season.id, id: teamId, status: TeamStatus.active },
      });
      if (!team) {
        res.status(404).json({ message: 'Team not found' });
        return;
      }

      if (existing) {
        if (existing.teamId === teamId) {
          await prisma.vote.delete({ where: { id: existing.id } });
          res.json({ message: 'Vote removed successfully', voted: false });
          return;
        }
        await prisma.vote.update({
          where: { id: existing.id },
          data: { teamId, playerMemberId: null },
        });
        res.json({ message: 'Vote updated successfully', voted: true, teamId });
        return;
      }

      await prisma.vote.create({
        data: { userId, seasonId: season.id, category, teamId, playerMemberId: null },
      });
      res.status(201).json({ message: 'Vote cast successfully', voted: true, teamId });
      return;
    }

    if (!playerMemberId) {
      res.status(400).json({ message: 'Player memberId is required' });
      return;
    }

    const player = await prisma.player.findFirst({
      where: { memberId: playerMemberId, seasonId: season.id, active: true },
    });
    if (!player) {
      res.status(404).json({ message: 'Player not found' });
      return;
    }

    if (existing) {
      if (existing.playerMemberId === playerMemberId) {
        await prisma.vote.delete({ where: { id: existing.id } });
        res.json({ message: 'Vote removed successfully', voted: false });
        return;
      }
      await prisma.vote.update({
        where: { id: existing.id },
        data: { playerMemberId, teamId: null },
      });
      res.json({ message: 'Vote updated successfully', voted: true, playerMemberId });
      return;
    }

    await prisma.vote.create({
      data: { userId, seasonId: season.id, category, playerMemberId, teamId: null },
    });
    res.status(201).json({ message: 'Vote cast successfully', voted: true, playerMemberId });
  } catch (error) {
    console.error('Error casting vote:', error);
    res.status(500).json({
      message: 'Error casting vote',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

export const getMyVote = async (req: VoteReq, res: Response): Promise<void> => {
  try {
    const userId = req.userId;
    const category = (req.query.category as string) || 'mvp';

    if (!userId) {
      res.status(401).json({ message: 'User not authenticated' });
      return;
    }

    const season = await getSeasonForVote(req);
    const vote = await prisma.vote.findUnique({
      where: {
        userId_seasonId_category: { userId, seasonId: season.id, category },
      },
    });

    if (!vote) {
      res.json({ voted: false });
      return;
    }

    if (getRequestDivision(req) === Division.girls) {
      res.json({
        voted: true,
        teamId: vote.teamId,
        category: vote.category,
      });
      return;
    }

    res.json({
      voted: true,
      playerMemberId: vote.playerMemberId,
      category: vote.category,
    });
  } catch (error) {
    console.error('Error fetching user vote:', error);
    res.status(500).json({ message: 'Error fetching vote status' });
  }
};

export const getVoteResults = async (req: VoteReq, res: Response): Promise<void> => {
  try {
    const category = (req.query.category as string) || 'mvp';
    const division = getRequestDivision(req);
    const season = await getSeasonForVote(req);

    const votes = await prisma.vote.findMany({
      where: { seasonId: season.id, category },
    });

    if (division === Division.girls) {
      const counts = new Map<number, number>();
      for (const v of votes) {
        if (v.teamId == null) continue;
        counts.set(v.teamId, (counts.get(v.teamId) || 0) + 1);
      }
      const sorted = [...counts.entries()]
        .map(([teamId, voteCount]) => ({ teamId, votes: voteCount }))
        .sort((a, b) => b.votes - a.votes)
        .slice(0, 10);

      if (!sorted.length) {
        res.json({ leaderboard: [] });
        return;
      }

      const teamIds = sorted.map((r) => r.teamId);
      const teams = await prisma.team.findMany({
        where: { seasonId: season.id, id: { in: teamIds } },
        select: { id: true, name: true },
      });
      const teamById = new Map(teams.map((t) => [t.id, t]));

      res.json({
        leaderboard: sorted.map((r) => ({
          teamId: r.teamId,
          votes: r.votes,
          teamName: teamById.get(r.teamId)?.name ?? '',
        })),
      });
      return;
    }

    const counts = new Map<number, number>();
    for (const v of votes) {
      if (v.playerMemberId == null) continue;
      counts.set(v.playerMemberId, (counts.get(v.playerMemberId) || 0) + 1);
    }
    const results = [...counts.entries()]
      .map(([memberId, voteCount]) => ({ memberId, votes: voteCount }))
      .sort((a, b) => b.votes - a.votes)
      .slice(0, 10);

    if (!results.length) {
      res.json({ leaderboard: [] });
      return;
    }

    const memberIds = results.map((r) => r.memberId);
    const players = await prisma.player.findMany({
      where: { seasonId: season.id, memberId: { in: memberIds }, active: true },
      include: { team: { select: { name: true, ownerUserId: true } } },
    });
    const playerByMember = new Map(players.map((p) => [p.memberId, p]));

    res.json({
      leaderboard: results
        .map((result) => {
          const player = playerByMember.get(result.memberId);
          if (!player) return null;
          return {
            memberId: result.memberId,
            votes: result.votes,
            player: {
              firstName: player.firstName,
              lastName: player.lastName,
              nickname: player.nickname,
              number: player.number,
              head_photo: player.headPhoto || '',
              isCaptain: player.isCaptain,
              isTeamOwner: !!player.team.ownerUserId && player.userId === player.team.ownerUserId,
              squadRole: player.squadRole,
              position: player.position,
            },
            teamName: player.team.name,
            teamId: player.teamId,
          };
        })
        .filter(Boolean),
    });
  } catch (error) {
    console.error('Error fetching vote results:', error);
    res.status(500).json({ message: 'Error fetching vote results' });
  }
};
