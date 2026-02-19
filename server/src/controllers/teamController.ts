import { Request, Response } from 'express';
import { Team } from '../models/Team';

export const getAllTeams = async (req: Request, res: Response): Promise<void> => {
    try {
        const teams = await Team.find().sort({ id: 1 }).select('+players.personalId');

        const sanitizedTeams = teams.map(team => {
            const teamObj = team.toObject();
            teamObj.players = teamObj.players.map((player: any) => {
                const hasPersonalId = !!player.personalId && player.personalId !== '';
                // Remove the actual personalId from the response
                const { personalId, ...playerData } = player;
                return { ...playerData, hasPersonalId };
            });
            return teamObj;
        });

        res.json(sanitizedTeams);
    } catch (error) {
        console.error('Get teams error:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

export const getTeamById = async (req: Request, res: Response): Promise<void> => {
    try {
        const team = await Team.findOne({ id: parseInt(req.params.id) }).select('+players.personalId');

        if (!team) {
            res.status(404).json({ error: 'Team not found' });
            return;
        }

        const teamObj = team.toObject();
        teamObj.players = teamObj.players.map((player: any) => {
            const hasPersonalId = !!player.personalId && player.personalId !== '';
            const { personalId, ...playerData } = player;
            return { ...playerData, hasPersonalId };
        });

        res.json(teamObj);
    } catch (error) {
        console.error('Get team error:', error);
        res.status(500).json({ error: 'Server error' });
    }
};
