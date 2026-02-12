import { Request, Response } from 'express';
import { Match } from '../models/Match';
import { AuthRequest } from '../middleware/auth';

// Public: Get all matches
export const getAllMatches = async (req: Request, res: Response): Promise<void> => {
    try {
        const matches = await Match.find().sort({ date: -1 });
        res.json(matches);
    } catch (error) {
        console.error('Get matches error:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

// Admin: Create match
export const createMatch = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const maxMatch = await Match.findOne().sort({ id: -1 });
        const nextId = (maxMatch?.id || 0) + 1;

        const match = new Match({
            ...req.body,
            id: nextId,
            createdBy: req.userId,
        });

        await match.save();
        res.status(201).json(match);
    } catch (error) {
        console.error('Create match error:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

// Admin: Update match
export const updateMatch = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const match = await Match.findOneAndUpdate(
            { id: parseInt(req.params.id) },
            req.body,
            { new: true }
        );

        if (!match) {
            res.status(404).json({ error: 'Match not found' });
            return;
        }

        res.json(match);
    } catch (error) {
        console.error('Update match error:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

// Admin: Delete match
export const deleteMatch = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const match = await Match.findOneAndDelete({ id: parseInt(req.params.id) });

        if (!match) {
            res.status(404).json({ error: 'Match not found' });
            return;
        }

        res.json({ message: 'Match deleted successfully' });
    } catch (error) {
        console.error('Delete match error:', error);
        res.status(500).json({ error: 'Server error' });
    }
};
