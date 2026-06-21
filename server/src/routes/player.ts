
import { Router } from 'express';
import multer from 'multer';
import { authenticate, uploadPhoto, playerLogout } from '../controllers/playerController';
import { authenticate as authenticateToken } from '../middleware/auth';
import os from 'os';

const router = Router();
const upload = multer({ dest: os.tmpdir() });

router.post('/auth', authenticate);
router.post('/logout', playerLogout);
router.post('/upload', authenticateToken, upload.single('image'), uploadPhoto);

export default router;
