import express from 'express';
import { Division } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { SeasonArchive } from '../models/SeasonArchive';
import { StatsService } from '../services/StatsService';
import { requirePlatformAdmin } from '../middleware/auth';

const router = express.Router();

function parseDivision(value: unknown): Division {
  return value === 'girls' ? Division.girls : Division.boys;
}

/**
 * @route   GET /api/archive?division=boys|girls
 * @desc    Get archived seasons (metadata only), optionally filtered by division
 */
router.get('/', async (req, res) => {
  try {
    const division = req.query.division ? parseDivision(req.query.division) : undefined;
    const archives = await prisma.seasonArchive.findMany({
      where: division ? { division } : undefined,
      select: {
        yearMonth: true,
        division: true,
        displayName: true,
        winner: true,
        topScorer: true,
        createdAt: true,
      },
      orderBy: { yearMonth: 'desc' },
    });
    res.json(archives);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ message });
  }
});

/**
 * @route   GET /api/archive/:yearMonth?division=boys|girls
 * @desc    Get full details for a specific archived season
 */
router.get('/:yearMonth', async (req, res) => {
  try {
    const division = parseDivision(req.query.division);
    const archive = await prisma.seasonArchive.findFirst({
      where: { yearMonth: req.params.yearMonth, division },
    });
    if (!archive) {
      return res.status(404).json({ message: 'Season not found' });
    }
    res.json(archive);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ message });
  }
});

/**
 * @route   POST /api/archive/create
 * @desc    Freeze current data into a new archive
 * @access  Admin only
 */
router.post('/create', requirePlatformAdmin, async (req, res) => {
  try {
    const { yearMonth, displayName, winnerId, mvpId, summary, division: divisionRaw } = req.body;
    const division = parseDivision(divisionRaw);

    if (!yearMonth || !displayName) {
      return res.status(400).json({ message: 'yearMonth and displayName are required' });
    }

    const existing = await prisma.seasonArchive.findFirst({
      where: { yearMonth, division },
    });
    if (existing) {
      return res.status(400).json({ message: `Season ${yearMonth} (${division}) already exists` });
    }

    const standings = await StatsService.calculateStandings();
    const topScorers = await StatsService.calculateTopScorers();

    const winnerEntry = standings.find(s => s.teamId === winnerId) || standings[0];
    const topScorerEntry = topScorers[0];

    await SeasonArchive.create({
      yearMonth,
      division,
      displayName,
      winner: {
        teamId: winnerEntry.teamId,
        name: winnerEntry.teamName,
        logoUrl: winnerEntry.logoUrl
      },
      topScorer: {
        memberId: topScorerEntry.memberId,
        name: topScorerEntry.playerName,
        teamName: topScorerEntry.teamName,
        goals: topScorerEntry.goals
      },
      mvp: mvpId ? {
          memberId: mvpId,
          name: 'TBD',
          teamName: 'TBD'
      } : undefined,
      standings,
      topScorers,
      summary
    });

    res.json({ message: 'Season archived successfully' });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ message });
  }
});

export default router;
