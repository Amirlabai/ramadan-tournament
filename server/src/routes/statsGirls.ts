import { Router } from 'express';
import { getGirlsDashboard, getPointsStandings } from '../controllers/statsGirlsController';

const router = Router();

router.get('/', getGirlsDashboard);
router.get('/standings', getPointsStandings);
router.get('/dashboard', getGirlsDashboard);

export default router;
