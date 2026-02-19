
import { Router } from 'express';
import multer from 'multer';
import { authenticate, uploadPhoto } from '../controllers/playerController';
import { authenticate as authenticateToken } from '../middleware/auth';
import os from 'os';

const router = Router();
const upload = multer({ dest: os.tmpdir() });

// Public route for player login
router.post('/auth', authenticate);

// Protected route for photo upload
// authenticateToken validates the JWT and sets req.userId
router.post('/upload', authenticateToken, upload.single('image'), uploadPhoto);

export default router;
