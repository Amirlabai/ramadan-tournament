import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { Team } from '../models/Team';
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

export const authenticate = async (req: Request, res: Response): Promise<void> => {
    try {
        const { personalId, birthYear } = req.body;

        if (!personalId || !birthYear) {
            res.status(400).json({ error: 'Personal ID and Birth Year are required' });
            return;
        }

        let normalizedId: string;
        let birthYearNum: number;
        try {
            normalizedId = normalizePersonalId(String(personalId));
            birthYearNum = parseBirthYear(birthYear);
        } catch {
            res.status(401).json({ error: 'Player not found or invalid credentials' });
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
            return;
        }

        const team = await Team.findOne({ id: playerRow.teamId });
        if (!team) {
            res.status(401).json({ error: 'Player not found or invalid credentials' });
            return;
        }

        const player = team.players.find((p) => p.memberId === playerRow.memberId);

        if (!player) {
            res.status(401).json({ error: 'Player data inconsistency' });
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
                memberId: player.memberId,
                firstName: player.firstName,
                lastName: player.lastName,
                teamId: team.id,
                teamName: team.name,
                head_photo: player.head_photo
            },
        };
        if (config.nodeEnv !== 'production') {
            body.token = token;
        }
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
            return;
        }

        const team = await Team.findOne({ id: teamId });

        if (!team) {
            res.status(404).json({ error: 'Player not found' });
            fs.unlinkSync(req.file.path);
            return;
        }

        const playerIndex = team.players.findIndex((p) => p.memberId === memberId);
        if (playerIndex === -1) {
            res.status(404).json({ error: 'Player not found in team' });
            fs.unlinkSync(req.file.path);
            return;
        }

        const player = team.players[playerIndex];

        // Move file to final destination
        // We want to store it in 'uploads/players' or similar.
        // The multer configuration determines where it is initially (tmp).

        const uploadsDir = path.join(process.cwd(), 'uploads', 'players');
        if (!fs.existsSync(uploadsDir)) {
            fs.mkdirSync(uploadsDir, { recursive: true });
        }

        // Use copyFileSync + unlinkSync instead of renameSync.
        // renameSync fails with EXDEV on Render because /tmp and /uploads are on different file systems.
        const fileExt = path.extname(req.file.originalname);
        const fileName = `player_${player.memberId}_${Date.now()}${fileExt}`;
        const finalPath = path.join(uploadsDir, fileName);

        fs.copyFileSync(req.file.path, finalPath);
        fs.unlinkSync(req.file.path);

        // Update DB
        // Path relative to server root or public URL?
        // If we serve 'uploads' directory at '/uploads', then URL is '/uploads/players/filename'
        const publicUrl = `/uploads/players/${fileName}`;

        // If there was an old photo, maybe delete it to save space? 
        // For now, keep it simple.

        // Update DB - save to pending_head_photo
        team.players[playerIndex].pending_head_photo = publicUrl;
        await team.save();

        // Send notification to admin (non-blocking)
        sendAdminNotification(`${player.firstName} ${player.lastName}`, team.name);

        res.json({
            message: 'Photo uploaded successfully and is pending approval',
            url: publicUrl
        });

    } catch (error: any) {
        console.error('Photo upload error:', error);
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
