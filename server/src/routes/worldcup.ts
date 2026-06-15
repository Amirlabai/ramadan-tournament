import { Router } from 'express';
import {
  getDashboard,
  getKnockout,
  getMatches,
  getMeta,
  getStandings,
  getTeams,
  getTopScorers,
} from '../controllers/worldcupController';

const router = Router();

router.get('/meta', getMeta);
router.get('/matches', getMatches);
router.get('/teams', getTeams);
router.get('/stats/standings', getStandings);
router.get('/stats/top-scorers', getTopScorers);
router.get('/stats/dashboard', getDashboard);
router.get('/stats/knockout', getKnockout);

export default router;
