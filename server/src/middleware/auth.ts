import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/env';
import { PLAYER_COOKIE, SESSION_COOKIE } from '../utils/authCookie';

export interface AuthRequest extends Request {
    userId?: string;
    isPlayer?: boolean;
    memberId?: number;
    teamId?: number;
}

export const authenticate = (
    req: AuthRequest,
    res: Response,
    next: NextFunction
): void => {
    try {
        const token =
            req.cookies?.[SESSION_COOKIE] ??
            req.cookies?.[PLAYER_COOKIE] ??
            req.headers.authorization?.replace('Bearer ', '');

        if (!token) {
            res.status(401).json({ error: 'Authentication required' });
            return;
        }

        const decoded = jwt.verify(token, config.jwtSecret) as {
            userId: string;
            isPlayer?: boolean;
            memberId?: number;
            teamId?: number;
        };
        req.userId = decoded.userId;
        req.isPlayer = decoded.isPlayer;
        req.memberId = decoded.memberId;
        req.teamId = decoded.teamId;

        if (decoded.isPlayer) {
            const path = req.originalUrl.split('?')[0];
            if (!path.startsWith('/api/players')) {
                res.status(401).json({ error: 'Authentication required' });
                return;
            }
        }

        next();
    } catch (error) {
        res.status(401).json({ error: 'Invalid or expired token' });
    }
};

export const authorize = (roles: string[]) => {
    return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
        try {
            if (!req.userId) {
                res.status(401).json({ error: 'User not authenticated' });
                return;
            }

            if (config.mockDevData && req.userId === 'mock-dev-admin') {
                const token =
                    req.cookies?.[SESSION_COOKIE] ??
                    req.headers.authorization?.replace('Bearer ', '');
                if (token) {
                    const decoded = jwt.verify(token, config.jwtSecret) as { role?: string };
                    const role = decoded.role || 'admin';
                    if (roles.includes(role) || roles.includes('Admin')) {
                        next();
                        return;
                    }
                }
                res.status(403).json({ error: 'Permission denied: insufficient role' });
                return;
            }

            const { User } = await import('../models/User');
            const user = await User.findById(req.userId);

            if (!user) {
                res.status(401).json({ error: 'User not found' });
                return;
            }

            if (!roles.includes(user.role)) {
                res.status(403).json({ error: 'Permission denied: insufficient role' });
                return;
            }

            next();
        } catch (error) {
            console.error('Authorization error:', error);
            res.status(500).json({ error: 'Internal server error during authorization' });
        }
    };
};
