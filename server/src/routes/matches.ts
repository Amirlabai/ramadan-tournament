import { Router } from 'express';
import { getAllMatches, createMatch, updateMatch, deleteMatch, syncPlayoffs } from '../controllers/matchController';
import { requirePlatformAdmin } from '../middleware/auth';

const router = Router();

// Public routes
router.get('/', getAllMatches);

// Admin routes
router.post('/sync-playoffs', requirePlatformAdmin, syncPlayoffs);
router.post('/', requirePlatformAdmin, createMatch);
router.put('/:id', requirePlatformAdmin, updateMatch);
router.delete('/:id', requirePlatformAdmin, deleteMatch);

export default router;
