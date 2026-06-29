import { Router } from 'express';
import { Division } from '@prisma/client';
import { SeasonService } from '../services/SeasonService';

const router = Router();

function isNoActiveSeasonError(message: string): boolean {
  return message.includes('No active season');
}

router.get('/active', async (req, res) => {
  try {
    const divisionParam = (req.query.division as string) || (req.query.slug === 'girls' ? 'girls' : 'boys');
    const division = divisionParam === 'girls' ? Division.girls : Division.boys;
    // Girls: points-mode season only — matches registration getActiveSeasonForDivision.
    const season =
      division === Division.girls
        ? await SeasonService.getActiveGirlsSeason()
        : await SeasonService.getActiveSeason(Division.boys);
    if (!season) {
      res.status(404).json({ error: 'No active season found' });
      return;
    }
    res.json({
      seasonId: season.id,
      yearMonth: season.yearMonth,
      division: season.division,
      scoringMode: season.scoringMode,
      displayName: season.displayName,
      isActive: season.isActive,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (isNoActiveSeasonError(message)) {
      res.status(404).json({ error: 'No active season found' });
      return;
    }
    console.error('Active season error:', error);
    res.status(500).json({ error: 'שגיאה בשרת' });
  }
});

export default router;
