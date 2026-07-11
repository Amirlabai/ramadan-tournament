import { Request, Response } from 'express';
import { Match, IMatch, IGoal } from '../models/Match';
import { AuthRequest } from '../middleware/auth';
import { PlayoffService } from '../services/PlayoffService';
import { MatchDataService } from '../services/MatchDataService';
import {
    deriveScoresFromGoals,
    isMatchGoalsValidationError,
    isValidTechnicalWinner,
    validateMatchGoals,
} from '../utils/matchGoals';

function goalsValidationMessage(error?: unknown): string {
    if (isMatchGoalsValidationError(error) && error.kind === 'own_goal') {
        return 'גול עצמי חייב לזכות אחת מקבוצות המשחק';
    }
    return 'כובש אינו משויך לאחת מקבוצות המשחק';
}

function technicalWinnerValidationMessage(): string {
    return 'ניצחון טכני חייב להיות לאחת מקבוצות המשחק';
}

function technicalGoalsConflictMessage(): string {
    return 'לא ניתן לשלוח ניצחון טכני יחד עם שערי משחק';
}

type MatchUpdateBody = Partial<IMatch> & {
    technicalWinnerTeamId?: number | null;
    goals?: IGoal[];
};

class TechnicalGoalsConflictError extends Error {
    readonly code = 'TECHNICAL_GOALS_CONFLICT' as const;
    constructor() {
        super('TECHNICAL_GOALS_CONFLICT');
        this.name = 'TechnicalGoalsConflictError';
    }
}

function mergeMatchUpdate(existing: IMatch, body: MatchUpdateBody) {
    const team1Id = body.team1Id ?? existing.team1Id;
    const team2Id = body.team2Id ?? existing.team2Id;

    const technicalWinnerExplicit = Object.prototype.hasOwnProperty.call(body, 'technicalWinnerTeamId');
    let technicalWinnerTeamId = technicalWinnerExplicit
        ? (body.technicalWinnerTeamId ?? null)
        : (existing.technicalWinnerTeamId ?? null);

    const goalsExplicit = body.goals !== undefined;
    let goals = body.goals ?? existing.goals;

    if (technicalWinnerTeamId != null) {
        // Reject tech win + non-empty goals in the same request
        if (goalsExplicit && Array.isArray(body.goals) && body.goals.length > 0) {
            throw new TechnicalGoalsConflictError();
        }
        // Existing scorers must be cleared explicitly with goals: [] — never wipe silently
        if (
            (existing.goals ?? []).length > 0
            && !(goalsExplicit && Array.isArray(body.goals) && body.goals.length === 0)
        ) {
            throw new TechnicalGoalsConflictError();
        }
        goals = [];
    } else if (goalsExplicit && goals.length > 0) {
        technicalWinnerTeamId = null;
    }

    return {
        date: body.date !== undefined
            ? (body.date instanceof Date ? body.date : new Date(body.date as string))
            : existing.date,
        location: body.location ?? existing.location,
        phase: body.phase ?? existing.phase,
        team1Id,
        team2Id,
        goals,
        technicalWinnerTeamId,
        technicalWinnerExplicit,
        clearingTechnicalWin:
            technicalWinnerExplicit
            && body.technicalWinnerTeamId == null
            && existing.technicalWinnerTeamId != null,
    };
}

async function applyMergedMatch(existing: IMatch, body: MatchUpdateBody): Promise<IMatch> {
    const merged = mergeMatchUpdate(existing, body);

    if (!isValidTechnicalWinner(merged.team1Id, merged.team2Id, merged.technicalWinnerTeamId)) {
        const err = new Error('TECHNICAL_WINNER_INVALID');
        (err as Error & { code: string }).code = 'TECHNICAL_WINNER_INVALID';
        throw err;
    }

    if (merged.technicalWinnerTeamId != null) {
        existing.date = merged.date;
        existing.location = merged.location;
        existing.phase = merged.phase;
        existing.team1Id = merged.team1Id;
        existing.team2Id = merged.team2Id;
        existing.goals = [];
        existing.score1 = 0;
        existing.score2 = 0;
        existing.technicalWinnerTeamId = merged.technicalWinnerTeamId;
        return existing.save();
    }

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
    // Clearing a technical win with no goals → unplayed (null scores), not a 0–0 draw
    if (merged.clearingTechnicalWin && merged.goals.length === 0) {
        existing.score1 = null;
        existing.score2 = null;
    } else {
        existing.score1 = score1;
        existing.score2 = score2;
    }
    existing.technicalWinnerTeamId = null;

    return existing.save();
}

function isTechnicalWinnerError(error: unknown): boolean {
    return error instanceof Error
        && ((error as Error & { code?: string }).code === 'TECHNICAL_WINNER_INVALID'
            || error.message === 'TECHNICAL_WINNER_INVALID');
}

function isTechnicalGoalsConflict(error: unknown): boolean {
    return error instanceof TechnicalGoalsConflictError
        || (error instanceof Error && (error as Error & { code?: string }).code === 'TECHNICAL_GOALS_CONFLICT');
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
        let goals = req.body.goals ?? [];
        let technicalWinnerTeamId = req.body.technicalWinnerTeamId ?? null;

        if (
            technicalWinnerTeamId != null
            && Array.isArray(req.body.goals)
            && req.body.goals.length > 0
        ) {
            res.status(400).json({ error: technicalGoalsConflictMessage() });
            return;
        }

        if (!isValidTechnicalWinner(team1Id, team2Id, technicalWinnerTeamId)) {
            res.status(400).json({ error: technicalWinnerValidationMessage() });
            return;
        }

        let score1: number;
        let score2: number;
        if (technicalWinnerTeamId != null) {
            goals = [];
            score1 = 0;
            score2 = 0;
        } else {
            await validateMatchGoals(team1Id, team2Id, goals);
            ({ score1, score2 } = await deriveScoresFromGoals(team1Id, team2Id, goals));
        }

        const match = new Match({
            ...req.body,
            goals,
            score1,
            score2,
            technicalWinnerTeamId,
            id: nextId,
            createdBy: req.userId,
        });

        await match.save();
        res.status(201).json(match);
    } catch (error) {
        if (isMatchGoalsValidationError(error)) {
            res.status(400).json({ error: goalsValidationMessage(error) });
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
        if (isTechnicalWinnerError(error)) {
            res.status(400).json({ error: technicalWinnerValidationMessage() });
            return;
        }
        if (isTechnicalGoalsConflict(error)) {
            res.status(400).json({ error: technicalGoalsConflictMessage() });
            return;
        }
        if (isMatchGoalsValidationError(error)) {
            res.status(400).json({ error: goalsValidationMessage(error) });
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
