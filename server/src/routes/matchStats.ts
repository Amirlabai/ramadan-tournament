import { Router } from 'express';
import { getMatchStats, regenerateMatchStats } from '../controllers/matchStatsController';
import { requirePlatformAdmin } from '../middleware/auth';

const router = Router();

router.get('/:id', getMatchStats);
router.post('/:id/regenerate', requirePlatformAdmin, regenerateMatchStats);

export default router;
