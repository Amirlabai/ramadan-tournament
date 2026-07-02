import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { ingestClientEvents } from '../controllers/analyticsController';

const router = Router();

const analyticsLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
});

router.post('/events', analyticsLimiter, ingestClientEvents);

export default router;
