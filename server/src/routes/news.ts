import { Router } from 'express';
import { getAllNews, createNews, updateNews, deleteNews } from '../controllers/newsController';
import { authenticate } from '../middleware/auth';

const router = Router();

// Public routes
router.get('/', getAllNews);

// Admin routes
router.post('/', authenticate, createNews);
router.put('/:id', authenticate, updateNews);
router.delete('/:id', authenticate, deleteNews);

export default router;
