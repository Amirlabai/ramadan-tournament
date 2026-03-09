import { Router } from 'express';
import multer from 'multer';
import os from 'os';
import { authenticate } from '../middleware/auth';
import { requestPlayerMapping, uploadAvatar, deleteAvatar, updatePlayerProfile, requestTeamCreation, leaveTeam } from '../controllers/userController';

const router = Router();
const upload = multer({ dest: os.tmpdir() });

// Allow an authenticated user to request mapping to a specific player
router.post('/map-player', authenticate, requestPlayerMapping);

// Avatar upload
router.post('/avatar', authenticate, upload.single('avatar'), uploadAvatar);
router.delete('/avatar', authenticate, deleteAvatar);

// Player profile editing (any approved-mapped user)
router.patch('/player-profile', authenticate, updatePlayerProfile);

// Team creation request
router.post('/request-team', authenticate, requestTeamCreation);

// Leave team
router.post('/leave-team', authenticate, leaveTeam);

export default router;
