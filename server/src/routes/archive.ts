import express from 'express';
import { SeasonArchive } from '../models/SeasonArchive';
import { StatsService } from '../services/StatsService';
import { authenticate, authorize } from '../middleware/auth';

const router = express.Router();

/**
 * @route   GET /api/archive
 * @desc    Get all archived seasons (metadata only)
 */
router.get('/', async (req, res) => {
  try {
    const archives = await SeasonArchive.find()
      .select('yearMonth displayName winner topScorer createdAt')
      .sort({ yearMonth: -1 });
    res.json(archives);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

/**
 * @route   GET /api/archive/:yearMonth
 * @desc    Get full details for a specific archived season
 */
router.get('/:yearMonth', async (req, res) => {
  try {
    const archive = await SeasonArchive.findOne({ yearMonth: req.params.yearMonth });
    if (!archive) {
      return res.status(404).json({ message: 'Season not found' });
    }
    res.json(archive);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

/**
 * @route   POST /api/admin/archive
 * @desc    Freeze current data into a new archive
 * @access  Admin only
 */
router.post('/create', authenticate, authorize(['Admin', 'admin']), async (req, res) => {
  try {
    const { yearMonth, displayName, winnerId, mvpId, summary } = req.body;

    if (!yearMonth || !displayName) {
      return res.status(400).json({ message: 'yearMonth and displayName are required' });
    }

    // Check if already exists
    const existing = await SeasonArchive.findOne({ yearMonth });
    if (existing) {
      return res.status(400).json({ message: `Season ${yearMonth} already exists` });
    }

    // Calculate final stats
    const standings = await StatsService.calculateStandings();
    const topScorers = await StatsService.calculateTopScorers();

    // Find winner details
    const winnerEntry = standings.find(s => s.teamId === winnerId) || standings[0];
    const topScorerEntry = topScorers[0];

    await SeasonArchive.create({
      yearMonth,
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
          // In a real scenario we'd look up the player info
          // For now we assume the frontend sends the details or we calculate it
          memberId: mvpId,
          name: 'TBD', // Placeholder
          teamName: 'TBD'
      } : undefined,
      standings,
      topScorers,
      summary
    });

    res.json({ message: 'Season archived successfully' });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
