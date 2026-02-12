import { Router } from 'express';
import { getAllMatches, createMatch, updateMatch, deleteMatch } from '../controllers/matchController';
import { authenticate } from '../middleware/auth';

const router = Router();

// Public routes
router.get('/', getAllMatches);

// Admin routes
router.post('/', authenticate, createMatch);
router.put('/:id', authenticate, updateMatch);
router.delete('/:id', authenticate, deleteMatch);

export default router;
