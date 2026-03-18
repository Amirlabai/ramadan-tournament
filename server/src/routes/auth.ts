import express, { Router } from 'express';
import { register, login, googleLogin, getMe, verifyEmail, resendVerification } from '../controllers/authController';
import { authenticate } from '../middleware/auth';

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.post('/google', googleLogin);
router.get('/me', authenticate, getMe);
router.post('/verify-email', verifyEmail);
router.post('/resend-verification', resendVerification);

export default router;
