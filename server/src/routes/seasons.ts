import { Router } from 'express';
import { Division } from '@prisma/client';
import { SeasonService } from '../services/SeasonService';

const router = Router();

router.get('/active', async (req, res) => {
  try {
    const divisionParam = (req.query.division as string) || (req.query.slug === 'girls' ? 'girls' : 'boys');
    const division = divisionParam === 'girls' ? Division.girls : Division.boys;
    const season = await SeasonService.getActiveSeason(division);
    res.json({
      seasonId: season.id,
      yearMonth: season.yearMonth,
      division: season.division,
      scoringMode: season.scoringMode,
      displayName: season.displayName,
      isActive: season.isActive,
    });
  } catch (error) {
    console.error('Active season error:', error);
    res.status(404).json({ error: 'No active season found' });
  }
});

export default router;
