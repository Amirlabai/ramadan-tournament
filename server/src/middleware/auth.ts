import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/env';
import { PLAYER_COOKIE, SESSION_COOKIE } from '../utils/authCookie';
import { respondNotFound } from '../utils/respondNotFound';

export interface AuthRequest extends Request {
    userId?: string;
    isPlayer?: boolean;
    memberId?: number;
    teamId?: number;
}

const PLATFORM_ADMIN_ROLES = ['Admin', 'admin'];

function readToken(req: AuthRequest): string | undefined {
    const path = req.originalUrl.split('?')[0];
    const isPlayerApi = path.startsWith('/api/players');

    if (isPlayerApi) {
        return (
            req.cookies?.[PLAYER_COOKIE] ??
            req.headers.authorization?.replace(/^Bearer\s+/i, '')
        );
    }

    const bearer = req.headers.authorization?.replace(/^Bearer\s+/i, '');
    if (bearer) return bearer;
    return req.cookies?.[SESSION_COOKIE] ?? req.cookies?.[PLAYER_COOKIE];
}

function applyDecoded(req: AuthRequest, decoded: {
    userId: string;
    isPlayer?: boolean;
    memberId?: number;
    teamId?: number;
}): void {
    req.userId = decoded.userId;
    req.isPlayer = decoded.isPlayer;
    req.memberId = decoded.memberId;
    req.teamId = decoded.teamId;
}

async function hasRequiredRole(req: AuthRequest, roles: string[]): Promise<boolean> {
    if (!req.userId) return false;

    if (config.mockDevData && req.userId === 'mock-dev-admin') {
        const token = readToken(req);
        if (!token) return false;
        try {
            const decoded = jwt.verify(token, config.jwtSecret) as { role?: string };
            const role = decoded.role || 'admin';
            return roles.includes(role) || roles.includes('Admin');
        } catch {
            return false;
        }
    }

    const { User } = await import('../models/User');
    const user = await User.findById(req.userId);
    return user != null && roles.includes(user.role);
}

export const authenticate = (
    req: AuthRequest,
    res: Response,
    next: NextFunction
): void => {
    try {
        const token = readToken(req);

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
        applyDecoded(req, decoded);

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

/** Admin-only routes: missing/invalid session or wrong role → 404 (conceal existence). */
export const requirePlatformAdmin = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const token = readToken(req);
        if (!token) {
            respondNotFound(res);
            return;
        }

        const decoded = jwt.verify(token, config.jwtSecret) as {
            userId: string;
            isPlayer?: boolean;
            memberId?: number;
            teamId?: number;
        };

        if (decoded.isPlayer) {
            respondNotFound(res);
            return;
        }

        applyDecoded(req, decoded);

        if (!(await hasRequiredRole(req, PLATFORM_ADMIN_ROLES))) {
            respondNotFound(res);
            return;
        }

        next();
    } catch (err) {
        console.debug('requirePlatformAdmin: concealed auth failure', err);
        respondNotFound(res);
    }
};
