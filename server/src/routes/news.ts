import { Router } from 'express';
import { getAllNews, createNews, updateNews, deleteNews } from '../controllers/newsController';
import { requirePlatformAdmin } from '../middleware/auth';

const router = Router();

// Public routes
router.get('/', getAllNews);

// Admin routes
router.post('/', requirePlatformAdmin, createNews);
router.put('/:id', requirePlatformAdmin, updateNews);
router.delete('/:id', requirePlatformAdmin, deleteNews);

export default router;
