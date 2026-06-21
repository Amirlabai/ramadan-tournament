import express, { Router } from 'express';
import rateLimit from 'express-rate-limit';
import {
    register,
    login,
    googleLogin,
    getMe,
    verifyEmail,
    resendVerification,
    logout,
} from '../controllers/authController';
import { authenticate } from '../middleware/auth';

const router = Router();

const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many login attempts. Try again later.' },
});

const registerLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many registration attempts. Try again later.' },
});

const verifyLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many verification attempts. Try again later.' },
});

const resendLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 3,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many resend attempts. Try again later.' },
});

const logoutLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many logout attempts. Try again later.' },
});

router.post('/register', registerLimiter, register);
router.post('/login', loginLimiter, login);
router.post('/google', loginLimiter, googleLogin);
router.post('/logout', logoutLimiter, logout);
router.get('/me', authenticate, getMe);
router.post('/verify-email', verifyLimiter, verifyEmail);
router.post('/resend-verification', resendLimiter, resendVerification);

export default router;
