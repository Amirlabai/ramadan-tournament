import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';
import { User, IUser } from '../models/User';
import { TeamRosterService } from '../services/TeamRosterService';
import { config } from '../config/env';
import { AuthRequest } from '../middleware/auth';
import { sendVerificationEmail } from '../services/emailService';
import crypto from 'crypto';
import { Division } from '@prisma/client';
import { RegistrationService } from '../services/RegistrationService';
import { setAuthCookie, authJsonBody, clearAuthCookie } from '../utils/authCookie';
import { AuthRateLimitService } from '../services/AuthRateLimitService';

const generateToken = (user: IUser) => {
    return jwt.sign(
        { userId: user.id, role: user.role },
        config.jwtSecret,
        { expiresIn: '7d' }
    );
};

/**
 * Normalizes an email address by:
 * 1. Converting to lowercase
 * 2. Trimming whitespace
 * 3. Removing subaddressing (e.g. user+test@gmail.com -> user@gmail.com)
 */
const normalizeEmail = (email: string): string => {
    const parts = email.toLowerCase().trim().split('@');
    if (parts.length !== 2) return email.toLowerCase().trim();
    
    const [local, domain] = parts;
    const cleanLocal = local.split('+')[0];
    return `${cleanLocal}@${domain}`;
};

// Helper: Hydrate player profile from the Team database if user is an approved player
const hydrateUserPayload = async (userDoc: any) => {
    const payload = {
        id: userDoc.id,
        username: userDoc.username,
        email: userDoc.email,
        displayName: userDoc.displayName,
        role: userDoc.role,
        avatarUrl: userDoc.avatarUrl,
        mappedPlayerInfo: userDoc.mappedPlayerInfo ? { ...userDoc.mappedPlayerInfo } : null,
        playerProfile: userDoc.playerProfile // fallback to custom player data
    };

    (payload as any).isPlatformAdmin =
        userDoc.role === 'admin' || userDoc.role === 'Admin';

    // If there's a pending or approved mapping, resolve names for the UI
    if (payload.mappedPlayerInfo && payload.mappedPlayerInfo.teamId > 0) {
        const team = await TeamRosterService.findTeamWithPlayersById(payload.mappedPlayerInfo.teamId);
        if (team) {
            (payload.mappedPlayerInfo as any).teamName = team.name;
            (payload.mappedPlayerInfo as any).logoUrl = team.logoUrl;
            (payload.mappedPlayerInfo as any).logoPosition = team.logoPosition;

            if (payload.mappedPlayerInfo.memberId > 0) {
                const player = team.players.find(p => p.memberId === payload.mappedPlayerInfo.memberId);
                if (player) {
                    (payload.mappedPlayerInfo as any).playerName = `${player.firstName} ${player.lastName}`;

                    if (userDoc.mappedPlayerInfo.status === 'approved') {
                        payload.playerProfile = {
                            firstName: player.firstName,
                            lastName: player.lastName,
                            nickname: player.nickname,
                            number: player.number,
                            position: player.position,
                            bio: player.bio
                        };
                    }
                }
            }
        }
    }

    try {
        const boys = await RegistrationService.getSummary(userDoc.id, Division.boys).catch(() => null);
        const girls = await RegistrationService.getSummary(userDoc.id, Division.girls).catch(() => null);
        (payload as any).tournamentRegistration = { boys, girls };
        (payload as any).activeDivision = boys?.activeDivision ?? girls?.activeDivision ?? null;

        const roster = boys?.onRoster ?? girls?.onRoster;

        if (roster && (!payload.mappedPlayerInfo || payload.mappedPlayerInfo.status !== 'approved')) {
            (payload as any).mappedPlayerInfo = {
                teamId: roster.teamId,
                memberId: roster.memberId,
                status: 'approved',
            };
        }

        const mapTeamId = payload.mappedPlayerInfo?.teamId ?? roster?.teamId;
        const mapMemberId = payload.mappedPlayerInfo?.memberId ?? roster?.memberId;
        if (mapTeamId && mapTeamId > 0 && mapMemberId && mapMemberId > 0) {
            const team = await TeamRosterService.findTeamWithPlayersById(mapTeamId);
            if (team) {
                (payload.mappedPlayerInfo as any).teamName = team.name;
                (payload.mappedPlayerInfo as any).logoUrl = team.logoUrl;
                (payload.mappedPlayerInfo as any).logoPosition = team.logoPosition;
                const player = team.players.find((p) => p.memberId === mapMemberId);
                if (player) {
                    (payload.mappedPlayerInfo as any).playerName = `${player.firstName} ${player.lastName}`;
                    const approvedMapping =
                        userDoc.mappedPlayerInfo?.status === 'approved' ||
                        payload.mappedPlayerInfo?.status === 'approved';
                    const canHydrateProfile =
                        userDoc.role === 'admin' ||
                        userDoc.role === 'Admin' ||
                        !!roster ||
                        approvedMapping;
                    if (canHydrateProfile) {
                        payload.playerProfile = {
                            firstName: player.firstName,
                            lastName: player.lastName,
                            nickname: player.nickname,
                            number: player.number,
                            position: player.position,
                            bio: player.bio,
                        };
                    }
                }
            }
        }
    } catch (err) {
        console.warn('hydrateUserPayload: registration summary skipped', err);
    }

    return payload;
};

export const register = async (req: Request, res: Response): Promise<void> => {
    try {
        const { email, password, displayName } = req.body;

        if (!email || !password || !displayName) {
            res.status(400).json({ error: 'Email, password, and display name are required' });
            return;
        }

        // Type safety
        if (typeof email !== 'string' || typeof password !== 'string' || typeof displayName !== 'string') {
            res.status(400).json({ error: 'Invalid input types' });
            return;
        }

        // Length limits
        if (email.length > 254 || password.length < 6 || password.length > 128 || displayName.trim().length < 2 || displayName.length > 50) {
            res.status(400).json({ error: 'Invalid input lengths. Display name: 2-50 chars, password: 6-128 chars.' });
            return;
        }

        // Basic email format check
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            res.status(400).json({ error: 'Invalid email format' });
            return;
        }

        // Check if user exists (using normalized email)
        const normalizedEmail = normalizeEmail(email);
        const existingUser = await User.findOne({ email: normalizedEmail });
        if (existingUser) {
            res.status(400).json({ error: 'Email is already registered' });
            return;
        }

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(password, salt);

        // Generate 6-digit verification code
        const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
        const expires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

        // Create user
        const user = new User({
            email: normalizedEmail,
            password: passwordHash,
            displayName: displayName.trim(),
            role: 'User',
            isVerified: false,
            verificationToken: verificationCode,
            verificationTokenExpires: expires
        });

        await user.save();

        // Send verification email
        await sendVerificationEmail(user.email!, verificationCode, user.displayName);

        res.status(201).json({
            message: 'Registration successful. Please check your email for the verification code.',
            needsVerification: true,
            email: user.email
        });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Server error during registration' });
    }
};

export const login = async (req: Request, res: Response): Promise<void> => {
    try {
        const { email, username, password } = req.body;

        if ((!email && !username) || !password) {
            res.status(400).json({ error: 'Email/Username and password are required' });
            return;
        }

        // Type safety — prevent object injection attacks
        if ((email && typeof email !== 'string') || (username && typeof username !== 'string') || typeof password !== 'string') {
            res.status(400).json({ error: 'Invalid input types' });
            return;
        }

        // Length limits
        if (password.length > 128) {
            res.status(400).json({ error: 'Invalid credentials' });
            return;
        }

        // Find user by either email or legacy username, explicitly querying the password field
        const normalizedEmail = email ? normalizeEmail(email as string) : null;
        const query = normalizedEmail ? { email: normalizedEmail } : { username };
        const user = await User.findOne(query).select('+password');

        if (!user || (!user.password && !user.googleId)) {
            res.status(401).json({ error: 'Invalid credentials' });
            return;
        }

        if (!user.password) {
            res.status(401).json({ error: 'Please login with Google for this account' });
            return;
        }

        // Verify password
        const isValidPassword = await bcrypt.compare(password, user.password);
        if (!isValidPassword) {
            res.status(401).json({ error: 'Invalid credentials' });
            return;
        }

        // Check if verified (only for internal email/password accounts)
        if (!user.isVerified && !user.googleId) {
            res.status(403).json({
                error: 'Email not verified',
                needsVerification: true,
                email: user.email
            });
            return;
        }

        const token = generateToken(user);

        setAuthCookie(res, token);
        res.json(authJsonBody(await hydrateUserPayload(user), token));
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

export const googleLogin = async (req: Request, res: Response): Promise<void> => {
    try {
        const { token } = req.body;

        if (!token) {
            res.status(400).json({ error: 'Google ID token is required' });
            return;
        }

        const ticket = await client.verifyIdToken({
            idToken: token,
            audience: process.env.GOOGLE_CLIENT_ID
        });
        const payload = ticket.getPayload();

        if (!payload || !payload.email) {
            res.status(400).json({ error: 'Invalid Google token' });
            return;
        }

        const normalizedEmail = normalizeEmail(payload.email);
        const googleId = payload.sub;

        // Search by googleId first (the most reliable key), then fall back to email
        let user = await User.findOne({ googleId });

        if (!user) {
            user = await User.findOne({ email: normalizedEmail });
        }

        if (!user) {
            // Brand new Google user — register them
            const newUser = new User({
                email: normalizedEmail,
                googleId,
                displayName: payload.name || normalizedEmail.split('@')[0],
                avatarUrl: payload.picture,
                googlePictureUrl: payload.picture,
                role: 'User'
            });
            user = await newUser.save();
        } else {
            // Existing user — ensure googleId is linked and Google picture URL is current
            let changed = false;
            if (!user.googleId) { user.googleId = googleId; changed = true; }
            // Always refresh the Google picture URL (it can change)
            if (payload.picture && user.googlePictureUrl !== payload.picture) {
                user.googlePictureUrl = payload.picture;
                changed = true;
            }
            // Only set avatarUrl from Google if user has no avatar yet
            if (payload.picture && !user.avatarUrl) {
                user.avatarUrl = payload.picture;
                changed = true;
            }
            if (changed) await user.save();
        }

        const jwtToken = generateToken(user);
        setAuthCookie(res, jwtToken);
        res.json(authJsonBody(await hydrateUserPayload(user), jwtToken));
    } catch (error) {
        console.error('Google login error:', error);
        res.status(500).json({ error: 'Google Authentication failed' });
    }
};

export const getMe = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const user = await User.findById(req.userId!);

        if (!user) {
            res.status(404).json({ error: 'User not found' });
            return;
        }

        res.json(await hydrateUserPayload(user));
    } catch (error) {
        console.error('Get user error:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

export const verifyEmail = async (req: Request, res: Response): Promise<void> => {
    try {
        const { email, code } = req.body;

        if (!email || !code) {
            res.status(400).json({ error: 'Email and code are required' });
            return;
        }

        const normalizedEmail = normalizeEmail(email);

        const user = await User.findOne({
            email: normalizedEmail,
            verificationToken: code,
            verificationTokenExpiresAfter: new Date(),
        });

        if (!user) {
            const allowed = await AuthRateLimitService.recordFailedVerifyEmail(normalizedEmail);
            if (!allowed) {
                res.status(429).json({ error: 'Too many verification attempts. Try again later.' });
                return;
            }
            res.status(400).json({ error: 'Invalid or expired verification code' });
            return;
        }

        user.isVerified = true;
        user.verificationToken = undefined;
        user.verificationTokenExpires = undefined;
        await user.save();

        const token = generateToken(user);
        setAuthCookie(res, token);
        res.json(authJsonBody(await hydrateUserPayload(user), token));
    } catch (error) {
        console.error('Email verification error:', error);
        res.status(500).json({ error: 'Server error during verification' });
    }
};

export const logout = async (_req: Request, res: Response): Promise<void> => {
    clearAuthCookie(res);
    res.json({ message: 'Logged out' });
};

export const resendVerification = async (req: Request, res: Response): Promise<void> => {
    try {
        const { email } = req.body;

        if (!email) {
            res.status(400).json({ error: 'Email is required' });
            return;
        }

        const user = await User.findOne({ email: normalizeEmail(email) });

        if (!user) {
            res.status(404).json({ error: 'User not found' });
            return;
        }

        if (user.isVerified) {
            res.status(400).json({ error: 'Email is already verified' });
            return;
        }

        // Generate new 6-digit verification code
        const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
        const expires = new Date(Date.now() + 24 * 60 * 60 * 1000);

        user.verificationToken = verificationCode;
        user.verificationTokenExpires = expires;
        await user.save();

        await sendVerificationEmail(user.email!, verificationCode, user.displayName);

        res.json({ message: 'Verification code resent successfully' });
    } catch (error) {
        console.error('Resend verification error:', error);
        res.status(500).json({ error: 'Server error during resending code' });
    }
};
