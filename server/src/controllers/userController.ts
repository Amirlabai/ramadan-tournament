import { Response } from 'express';
import { Division } from '@prisma/client';
import { User } from '../models/User';
import { Team } from '../models/Team';
import { AuthRequest } from '../middleware/auth';
import path from 'path';
import fs from 'fs';
import { config } from '../config/env';
import { sendTeamRequestNotification, sendPlayerMappingNotification } from '../services/emailService';
import { PlayerService } from '../services/PlayerService';
import { PlayerServiceError } from '../errors/PlayerServiceError';
import {
    findPendingTeamCreationRequests,
} from '../repositories/userMappingRepository';

// Voluntary leave team (roster row via players.user_id)
export const leaveTeam = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const raw = req.query.division;
        if (raw != null && raw !== 'boys' && raw !== 'girls') {
            res.status(400).json({ error: 'division חייב להיות boys או girls' });
            return;
        }
        const division = raw === 'girls' ? Division.girls : Division.boys;
        await PlayerService.leaveTeam(req.userId!, division);
        res.json({ message: 'עזבת את הקבוצה בהצלחה' });
    } catch (error) {
        if (error instanceof PlayerServiceError) {
            res.status(error.status).json({ error: error.message, code: error.code });
            return;
        }
        console.error('Leave team error:', error);
        res.status(500).json({ error: 'שגיאה בשרת בעת עזיבת הקבוצה' });
    }
};

/** Deprecated — use POST /api/teams/:id/join-request */
export const requestPlayerMapping = async (_req: AuthRequest, res: Response): Promise<void> => {
    res.status(410).json({
        error: 'שיוך שחקן ישן הוסר. השתמש ב"בקשת הצטרפות" מעמוד הקבוצות.',
        code: 'LEGACY_MAP_PLAYER_DEPRECATED',
    });
};

// ── User edits their own player info ─────────────────────────────────────────
export const updatePlayerProfile = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const body = req.body as Record<string, unknown>;
        const input = {
            firstName: body.firstName as string | undefined,
            lastName: body.lastName as string | undefined,
            nickname: body.nickname as string | undefined,
            number: body.number != null ? Number(body.number) : undefined,
            position: body.position as string | undefined,
            bio: body.bio as string | undefined,
        };

        try {
            const playerProfile = await PlayerService.updateOwnProfile(req.userId!, input);
            res.json({ message: 'פרטי השחקן עודכנו', playerProfile });
            return;
        } catch (activeErr) {
            const msg = activeErr instanceof Error ? activeErr.message : '';
            if (!msg.includes('לא נמצא שחקן פעיל')) {
                throw activeErr;
            }
        }

        const playerProfile = await PlayerService.updatePendingProfile(req.userId!, input);
        res.json({ message: 'פרטי השחקן עודכנו (ממתין לאישור)', playerProfile });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'שגיאה בשרת';
        const status = message.includes('לא נמצא') || message.includes('אין הרשאה') ? 404 : 400;
        console.error('Update player profile error:', error);
        res.status(status).json({ error: message });
    }
};


export const uploadAvatar = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        if (!req.file) {
            res.status(400).json({ error: 'No file uploaded' });
            return;
        }

        const user = await User.findById(req.userId!);
        if (!user) {
            res.status(404).json({ error: 'User not found' });
            return;
        }

        // Remove old avatar if it's a local upload
        if (user.avatarUrl && user.avatarUrl.startsWith('/uploads/')) {
            const oldPath = path.join(process.cwd(), user.avatarUrl);
            if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
        }

        const uploadsDir = path.join(process.cwd(), 'uploads', 'players');
        if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

        const ext = path.extname(req.file.originalname) || '.jpg';
        const filename = `avatar_${req.userId}_${Date.now()}${ext}`;
        const finalPath = path.join(uploadsDir, filename);

        // Use copyFileSync + unlinkSync instead of renameSync.
        // renameSync fails with EXDEV on Render because /tmp and /uploads are on different file systems.
        fs.copyFileSync(req.file.path, finalPath);
        fs.unlinkSync(req.file.path);

        user.avatarUrl = `/uploads/players/${filename}`;
        await user.save();
        await PlayerService.syncAvatarToRoster(req.userId!, user.avatarUrl);

        res.json({ message: 'Avatar updated successfully', avatarUrl: user.avatarUrl });
    } catch (error) {
        console.error('Avatar upload error:', error);
        res.status(500).json({ error: 'Server error during avatar upload' });
    }
};

export const deleteAvatar = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const user = await User.findById(req.userId!);
        if (!user) { res.status(404).json({ error: 'User not found' }); return; }

        // Delete the local file if the current avatar is an uploaded one
        if (user.avatarUrl && user.avatarUrl.startsWith('/uploads/')) {
            const filePath = path.join(process.cwd(), user.avatarUrl);
            if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        }
        // Revert to Google profile picture, or clear entirely
        user.avatarUrl = user.googlePictureUrl ?? undefined;
        await user.save();
        await PlayerService.syncAvatarToRoster(req.userId!, user.avatarUrl);

        res.json({ message: 'Avatar deleted', avatarUrl: user.avatarUrl ?? null });
    } catch (error) {
        console.error('Avatar delete error:', error);
        res.status(500).json({ error: 'Server error during avatar deletion' });
    }
};

export const getPendingTeamRequests = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const users = await findPendingTeamCreationRequests();
        res.json(users);
    } catch (error) {
        console.error('Error fetching team requests:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

export const approveTeamRequest = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { userId } = req.params;
        const { action } = req.body; // 'approved' or 'rejected'

        // Allowlist the action value — never trust raw user input for state decisions
        if (action !== 'approved' && action !== 'rejected') {
            res.status(400).json({ error: 'Invalid action. Must be "approved" or "rejected"' });
            return;
        }

        const user = await User.findById(userId);
        if (!user || !user.pendingTeamRequest) {
            res.status(404).json({ error: 'User or team request not found' });
            return;
        }

        if (action === 'approved') {
            // Find the max team ID to assign a new one
            const maxTeam = await Team.findOne().sort({ id: -1 });
            const newTeamId = (maxTeam?.id ?? 0) + 1;

            // Create the team
            const newTeam = new Team({
                id: newTeamId,
                name: user.pendingTeamRequest.teamName,
                players: []
            });
            await newTeam.save();

            // Captain state lives in mappedPlayerInfo (memberId 0), not platform role
            user.mappedPlayerInfo = { teamId: newTeamId, memberId: 0, status: 'approved' };
            user.pendingTeamRequest.status = 'approved';
        } else {
            user.pendingTeamRequest.status = 'rejected';
        }

        await user.save();
        res.json({ message: `Team request ${action}` });
    } catch (error) {
        console.error('Team approval error:', error);
        res.status(500).json({ error: 'Server error during approval' });
    }
};

// ─── Admin: legacy user-team mappings (removed — use registration workflow) ───

const LEGACY_MAPPING_SUNSET = {
    error: 'ניהול שיוכי שחקנים ישן הוסר. השתמש בלשונית סגל ורישום → תהליך רישום.',
    code: 'LEGACY_USER_MAPPINGS_DEPRECATED',
};

export const getUserMappings = async (_req: AuthRequest, res: Response): Promise<void> => {
    res.status(410).json(LEGACY_MAPPING_SUNSET);
};

export const updateUserMapping = async (_req: AuthRequest, res: Response): Promise<void> => {
    res.status(410).json(LEGACY_MAPPING_SUNSET);
};

