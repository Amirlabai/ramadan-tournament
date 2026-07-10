import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { TeamRosterService } from '../services/TeamRosterService';
import { config } from '../config/env';
import { AuthRequest } from '../middleware/auth';
import { setPlayerCookie, clearPlayerCookie } from '../utils/authCookie';
import { personalIdLookupValues } from '../utils/personalIdCrypto';
import { normalizePersonalId, parseBirthYear } from '../utils/personalIdValidation';
import { SeasonService } from '../services/SeasonService';
import { prisma } from '../lib/prisma';
import fs from 'fs';
import path from 'path';
import nodemailer from 'nodemailer';
import { AnalyticsService } from '../services/AnalyticsService';
import {
  publicUploadUrl,
  unlinkUpload,
  uploadWriteDir,
  UPLOADS_DISK_MISCONFIG_MESSAGE,
} from '../utils/uploadPaths';
import { safeImageExt } from '../utils/safeImageExt';

const logPlayerZoneEvent = (
  eventName: string,
  properties?: Record<string, unknown>
) => {
  AnalyticsService.log({
    eventName,
    category: 'player_zone',
    source: 'server',
    properties,
  });
};

export const authenticate = async (req: Request, res: Response): Promise<void> => {
    try {
        const { personalId, birthYear } = req.body;

        if (!personalId || !birthYear) {
            res.status(400).json({ error: 'Personal ID and Birth Year are required' });
            logPlayerZoneEvent('player_zone_login_failed', { reason: 'missing_fields' });
            return;
        }

        let normalizedId: string;
        let birthYearNum: number;
        try {
            normalizedId = normalizePersonalId(String(personalId));
            birthYearNum = parseBirthYear(birthYear);
        } catch {
            res.status(401).json({ error: 'Player not found or invalid credentials' });
            logPlayerZoneEvent('player_zone_login_failed', { reason: 'invalid_credentials' });
            return;
        }
        const season = await SeasonService.getActiveFootballSeason();
        const playerRow = await prisma.player.findFirst({
            where: {
                seasonId: season.id,
                personalIdEnc: { in: personalIdLookupValues(normalizedId) },
                birthYear: birthYearNum,
                active: true,
            },
        });

        if (!playerRow) {
            res.status(401).json({ error: 'Player not found or invalid credentials' });
            logPlayerZoneEvent('player_zone_login_failed', { reason: 'not_found' });
            return;
        }

        const team = await TeamRosterService.findTeamWithPlayersById(playerRow.teamId);
        if (!team) {
            res.status(401).json({ error: 'Player not found or invalid credentials' });
            logPlayerZoneEvent('player_zone_login_failed', { reason: 'team_not_found' });
            return;
        }

        const teamMeta = await prisma.team.findFirst({
            where: { id: playerRow.teamId, seasonId: season.id },
            select: { ownerUserId: true },
        });

        const player = team.players.find((p) => p.memberId === playerRow.memberId);

        if (!player) {
            res.status(401).json({ error: 'Player data inconsistency' });
            logPlayerZoneEvent('player_zone_login_failed', { reason: 'data_inconsistency' });
            return;
        }

        const token = jwt.sign(
            {
                userId: String(player.memberId),
                memberId: player.memberId,
                teamId: team.id,
                isPlayer: true,
            },
            config.jwtSecret,
            { expiresIn: '24h' }
        );

        setPlayerCookie(res, token);
        const body: Record<string, unknown> = {
            player: {
                memberId: playerRow.memberId,
                firstName: playerRow.firstName,
                lastName: playerRow.lastName,
                teamId: team.id,
                teamName: team.name,
                head_photo: playerRow.headPhoto || '',
                pending_head_photo: playerRow.pendingHeadPhoto || '',
                position: playerRow.position,
                isCaptain: playerRow.isCaptain,
                squadRole: playerRow.squadRole,
                isTeamOwner: !!teamMeta?.ownerUserId && playerRow.userId === teamMeta.ownerUserId,
            },
        };
        if (config.nodeEnv !== 'production') {
            body.token = token;
        }
        logPlayerZoneEvent('player_zone_login_success', { teamId: team.id });
        res.json(body);

    } catch (error) {
        console.error('Player auth error:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

const sendAdminNotification = async (playerName: string, teamName: string) => {
    if (!config.email.user || !config.email.pass || !config.email.admin) {
        console.warn('Email credentials not configured, skipping notification');
        return;
    }

    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: config.email.user,
            pass: config.email.pass
        }
    });

    const mailOptions = {
        from: config.email.user,
        to: config.email.admin,
        subject: `תמונה חדשה לאישור: ${playerName}`,
        html: `
            <div dir="rtl" style="font-family: sans-serif;">
                <h2>היי אמיר, יש תמונה חדשה שמחכה לאישורך!</h2>
                <p><strong>שחקן:</strong> ${playerName}</p>
                <p><strong>קבוצה:</strong> ${teamName}</p>
                <hr />
                <p>כדי לאשר או לדחות את התמונה, היכנס לפאנל הניהול:</p>
                <a href="https://ramadan-tournament-client.vercel.app/admin/login" 
                   style="background-color: #2A6B11; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">
                   לפאנל הניהול
                </a>
            </div>
        `
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log(`Admin notification email sent for ${playerName}`);
    } catch (error) {
        console.error('Error sending admin notification email:', error);
    }
};

export const playerLogout = async (_req: Request, res: Response): Promise<void> => {
    clearPlayerCookie(res);
    res.json({ message: 'Logged out' });
};

export const uploadPhoto = async (req: AuthRequest, res: Response): Promise<void> => {
    if (!req.file) {
        res.status(400).json({ error: 'No file uploaded' });
        logPlayerZoneEvent('photo_upload_failed', { reason: 'no_file' });
        return;
    }

    try {
        // We need to identify the player.
        // req.userId should correspond to personalId if token was issued by playerAuth
        // But let's verify.

        // We also need memberId. auth middleware only sets userId.
        // We can either update auth middleware to set memberId, or re-fetch player using userId (personalId).

        const memberId = req.memberId ?? parseInt(req.userId!, 10);
        const teamId = req.teamId;
        if (!memberId || !teamId) {
            res.status(401).json({ error: 'Authentication required' });
            logPlayerZoneEvent('photo_upload_failed', { reason: 'unauthenticated' });
            return;
        }

        const team = await TeamRosterService.findTeamWithPlayersById(teamId);

        if (!team) {
            res.status(404).json({ error: 'Player not found' });
            logPlayerZoneEvent('photo_upload_failed', { reason: 'player_not_found' });
            fs.unlinkSync(req.file.path);
            return;
        }

        const playerIndex = team.players.findIndex((p) => p.memberId === memberId);
        if (playerIndex === -1) {
            res.status(404).json({ error: 'Player not found in team' });
            logPlayerZoneEvent('photo_upload_failed', { reason: 'player_not_in_team' });
            fs.unlinkSync(req.file.path);
            return;
        }

        const player = team.players[playerIndex];

        const uploadsDir = uploadWriteDir('players');
        const fileExt = safeImageExt(req.file.originalname);
        const fileName = `player_${player.memberId}_${Date.now()}${fileExt}`;
        const finalPath = path.join(uploadsDir, fileName);

        // Use copyFileSync + unlinkSync instead of renameSync.
        // renameSync fails with EXDEV on Render because /tmp and /uploads are on different file systems.
        fs.copyFileSync(req.file.path, finalPath);
        fs.unlinkSync(req.file.path);

        const publicUrl = publicUploadUrl('players', fileName);
        const previousPending = player.pending_head_photo;

        team.players[playerIndex].pending_head_photo = publicUrl;
        await TeamRosterService.saveTeam(team);

        if (previousPending?.startsWith('/uploads/')) {
            unlinkUpload(previousPending);
        }

        // Send notification to admin (non-blocking)
        sendAdminNotification(`${player.firstName} ${player.lastName}`, team.name);

        logPlayerZoneEvent('photo_upload_success', { teamId });
        res.json({
            message: 'Photo uploaded successfully and is pending approval',
            url: publicUrl
        });

    } catch (error: any) {
        console.error('Photo upload error:', error);
        logPlayerZoneEvent('photo_upload_failed', { reason: 'server_error' });
        if (error instanceof Error && error.message === UPLOADS_DISK_MISCONFIG_MESSAGE) {
            res.status(503).json({ error: UPLOADS_DISK_MISCONFIG_MESSAGE });
            return;
        }
        res.status(500).json({
            error: 'Server error',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
        // Try cleanup
        if (req.file && fs.existsSync(req.file.path)) {
            try { fs.unlinkSync(req.file.path); } catch (e) { }
        }
    }
};
