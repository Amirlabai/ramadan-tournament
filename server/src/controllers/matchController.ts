import { Request, Response } from 'express';
import { Match, IMatch } from '../models/Match';
import { AuthRequest } from '../middleware/auth';
import { PlayoffService } from '../services/PlayoffService';
import { MatchDataService } from '../services/MatchDataService';
import {
    deriveScoresFromGoals,
    isMatchGoalsValidationError,
    validateMatchGoals,
} from '../utils/matchGoals';

function goalsValidationMessage(): string {
    return 'כובש אינו משויך לאחת מקבוצות המשחק';
}

function mergeMatchUpdate(existing: IMatch, body: Partial<IMatch>) {
    const team1Id = body.team1Id ?? existing.team1Id;
    const team2Id = body.team2Id ?? existing.team2Id;
    const goals = body.goals ?? existing.goals;

    return {
        date: body.date !== undefined
            ? (body.date instanceof Date ? body.date : new Date(body.date))
            : existing.date,
        location: body.location ?? existing.location,
        phase: body.phase ?? existing.phase,
        team1Id,
        team2Id,
        goals,
    };
}

async function applyMergedMatch(existing: IMatch, body: Partial<IMatch>): Promise<IMatch> {
    const merged = mergeMatchUpdate(existing, body);
    await validateMatchGoals(merged.team1Id, merged.team2Id, merged.goals);
    const { score1, score2 } = await deriveScoresFromGoals(
        merged.team1Id,
        merged.team2Id,
        merged.goals,
    );

    existing.date = merged.date;
    existing.location = merged.location;
    existing.phase = merged.phase;
    existing.team1Id = merged.team1Id;
    existing.team2Id = merged.team2Id;
    existing.goals = merged.goals;
    existing.score1 = score1;
    existing.score2 = score2;

    return existing.save();
}

// Public: Get all matches
export const getAllMatches = async (req: Request, res: Response): Promise<void> => {
    try {
        const matches = await MatchDataService.getAllMatchesDocument();
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

        const team1Id = req.body.team1Id;
        const team2Id = req.body.team2Id;
        const goals = req.body.goals ?? [];
        await validateMatchGoals(team1Id, team2Id, goals);
        const { score1, score2 } = await deriveScoresFromGoals(team1Id, team2Id, goals);

        const match = new Match({
            ...req.body,
            goals,
            score1,
            score2,
            id: nextId,
            createdBy: req.userId,
        });

        await match.save();
        res.status(201).json(match);
    } catch (error) {
        if (isMatchGoalsValidationError(error)) {
            res.status(400).json({ error: goalsValidationMessage() });
            return;
        }
        console.error('Create match error:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

// Admin: Update match
export const updateMatch = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const id = parseInt(req.params.id);
        const existing = await Match.findOne({ id });
        if (!existing) {
            res.status(404).json({ error: 'Match not found' });
            return;
        }

        const saved = await applyMergedMatch(existing, req.body);
        res.json(saved);
    } catch (error) {
        if (isMatchGoalsValidationError(error)) {
            res.status(400).json({ error: goalsValidationMessage() });
            return;
        }
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

// Admin: Sync playoff matches
export const syncPlayoffs = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        await PlayoffService.syncPlayoffs();
        res.json({ message: 'Playoff matches synchronized successfully' });
    } catch (error) {
        console.error('Sync playoffs error:', error);
        res.status(500).json({ error: error instanceof Error ? error.message : 'Server error' });
    }
};
