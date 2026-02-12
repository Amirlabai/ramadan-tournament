import { Request, Response } from 'express';
import { Team } from '../models/Team';

export const getAllTeams = async (req: Request, res: Response): Promise<void> => {
    try {
        const teams = await Team.find().sort({ id: 1 });
        res.json(teams);
    } catch (error) {
        console.error('Get teams error:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

export const getTeamById = async (req: Request, res: Response): Promise<void> => {
    try {
        const team = await Team.findOne({ id: parseInt(req.params.id) });

        if (!team) {
            res.status(404).json({ error: 'Team not found' });
            return;
        }

        res.json(team);
    } catch (error) {
        console.error('Get team error:', error);
        res.status(500).json({ error: 'Server error' });
    }
};
