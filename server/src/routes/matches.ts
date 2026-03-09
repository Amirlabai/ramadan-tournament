import { Router } from 'express';
import { getAllMatches, createMatch, updateMatch, deleteMatch } from '../controllers/matchController';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

// Public routes
router.get('/', getAllMatches);

// Admin routes
router.post('/', authenticate, authorize(['Admin', 'admin']), createMatch);
router.put('/:id', authenticate, authorize(['Admin', 'admin']), updateMatch);
router.delete('/:id', authenticate, authorize(['Admin', 'admin']), deleteMatch);

export default router;
