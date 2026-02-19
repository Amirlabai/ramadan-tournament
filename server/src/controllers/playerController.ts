
import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { Team, IPlayer } from '../models/Team';
import { config } from '../config/env';
import { AuthRequest } from '../middleware/auth';
import fs from 'fs';
import path from 'path';

export const authenticate = async (req: Request, res: Response): Promise<void> => {
    try {
        const { personalId, birthYear } = req.body;

        if (!personalId || !birthYear) {
            res.status(400).json({ error: 'Personal ID and Birth Year are required' });
            return;
        }

        // Find matches in any team
        // We need to use findOne with elemMatch on players array
        // However, personalId is select: false, so we need to explicitly select it?
        // Actually, queries on unselected fields work in Mongoose, but the field won't be in the result unless selected.
        // But here we need to find it first.

        // Let's try to find the team first.
        const team = await Team.findOne({
            players: {
                $elemMatch: {
                    personalId: personalId,
                    birthYear: parseInt(birthYear)
                }
            }
        }).select('+players.personalId'); // We need to verify it matching exactly if multiple?

        // Actually $elemMatch in query is enough to find the document.
        // But we need to identify WHICH player it is in the array.

        if (!team) {
            res.status(401).json({ error: 'Player not found or invalid credentials' });
            return;
        }

        // Find the specific player
        const player = team.players.find(p => p.personalId === personalId && p.birthYear === parseInt(birthYear));

        if (!player) {
            res.status(401).json({ error: 'Player data inconsistency' });
            return;
        }

        // Generate JWT
        const token = jwt.sign(
            {
                userId: player.personalId, // Using personalId as identifier for players
                memberId: player.memberId,
                teamId: team.id,
                isPlayer: true
            },
            config.jwtSecret,
            { expiresIn: '24h' }
        );

        res.json({
            token,
            player: {
                memberId: player.memberId,
                firstName: player.firstName,
                lastName: player.lastName,
                teamId: team.id,
                teamName: team.name,
                head_photo: player.head_photo
            }
        });

    } catch (error) {
        console.error('Player auth error:', error);
        res.status(500).json({ error: 'Server error' });
    }
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

        const personalId = req.userId;
        if (!personalId) {
            res.status(401).json({ error: 'Authentication required' });
            return;
        }

        // Find the team and player
        const team = await Team.findOne({
            "players.personalId": personalId
        }).select('+players.personalId');

        if (!team) {
            res.status(404).json({ error: 'Player not found' });
            // Clean up file if not found?
            fs.unlinkSync(req.file.path);
            return;
        }

        const playerIndex = team.players.findIndex(p => p.personalId === personalId);
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

        // Rename/Move file
        const fileExt = path.extname(req.file.originalname);
        const fileName = `player_${player.memberId}_${Date.now()}${fileExt}`;
        const finalPath = path.join(uploadsDir, fileName);

        fs.renameSync(req.file.path, finalPath);

        // Update DB
        // Path relative to server root or public URL?
        // If we serve 'uploads' directory at '/uploads', then URL is '/uploads/players/filename'
        const publicUrl = `/uploads/players/${fileName}`;

        // If there was an old photo, maybe delete it to save space? 
        // For now, keep it simple.

        // Update DB - save to pending_head_photo
        team.players[playerIndex].pending_head_photo = publicUrl;
        await team.save();

        res.json({
            message: 'Photo uploaded successfully and is pending approval',
            url: publicUrl
        });

    } catch (error) {
        console.error('Photo upload error:', error);
        res.status(500).json({ error: 'Server error' });
        // Try cleanup
        if (req.file && fs.existsSync(req.file.path)) {
            try { fs.unlinkSync(req.file.path); } catch (e) { }
        }
    }
};
