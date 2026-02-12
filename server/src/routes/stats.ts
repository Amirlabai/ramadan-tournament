import { Router } from 'express';
import { getStandings, getTopScorers, getPlayerStats, getDashboard } from '../controllers/statsController';

const router = Router();

router.get('/standings', getStandings);
router.get('/top-scorers', getTopScorers);
router.get('/player-stats', getPlayerStats);
router.get('/dashboard', getDashboard);

export default router;
