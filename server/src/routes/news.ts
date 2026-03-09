import { Router } from 'express';
import { getAllNews, createNews, updateNews, deleteNews } from '../controllers/newsController';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

// Public routes
router.get('/', getAllNews);

// Admin routes
router.post('/', authenticate, authorize(['Admin', 'admin']), createNews);
router.put('/:id', authenticate, authorize(['Admin', 'admin']), updateNews);
router.delete('/:id', authenticate, authorize(['Admin', 'admin']), deleteNews);

export default router;
