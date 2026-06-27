import { Router } from 'express';
import multer from 'multer';
import os from 'os';
import rateLimit from 'express-rate-limit';
import { authenticate } from '../middleware/auth';
import type { AuthRequest } from '../middleware/auth';
import { uploadAvatar, deleteAvatar, updatePlayerProfile, leaveTeam, cancelPlayerMapping, requestPlayerMapping } from '../controllers/userController';
import { getRegistrationStatus, verifyIdentity, redeemInvoice, cancelRegistrationRequest } from '../controllers/registrationController';

const router = Router();
const upload = multer({ dest: os.tmpdir() });

const cancelRegistrationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => (req as AuthRequest).userId ?? req.ip ?? 'unknown',
  message: { error: 'יותר מדי בקשות ביטול. נסה שוב בעוד כמה דקות.' },
});

router.get('/registration', authenticate, getRegistrationStatus);
router.post('/verify-identity', authenticate, verifyIdentity);
router.post('/redeem-invoice', authenticate, redeemInvoice);
router.post(
  '/cancel-registration-request',
  authenticate,
  cancelRegistrationLimiter,
  cancelRegistrationRequest
);

// Legacy claim flow — returns 410; use POST /api/teams/:id/join-request
router.post('/map-player', authenticate, requestPlayerMapping);

// Avatar upload
router.post('/avatar', authenticate, upload.single('avatar'), uploadAvatar);
router.delete('/avatar', authenticate, deleteAvatar);

// Player profile editing (any approved-mapped user)
router.patch('/player-profile', authenticate, updatePlayerProfile);

// Leave team
router.post('/leave-team', authenticate, leaveTeam);
router.post('/cancel-mapping', authenticate, cancelPlayerMapping);

export default router;
