import { prisma } from '../lib/prisma';
import { SeasonService } from '../services/SeasonService';

export class MatchGoalsValidationError extends Error {
    readonly code = 'MATCH_GOALS_INVALID' as const;

    constructor(message: string) {
        super(message);
        this.name = 'MatchGoalsValidationError';
    }
}

interface RosterSets {
    team1Ids: Set<number>;
    team2Ids: Set<number>;
    allowed: Set<number>;
}

async function loadRosterSets(team1Id: number, team2Id: number): Promise<RosterSets> {
    const season = await SeasonService.getActiveFootballSeason();
    const players = await prisma.player.findMany({
        where: {
            seasonId: season.id,
            teamId: { in: [team1Id, team2Id] },
            active: true,
        },
        select: { memberId: true, teamId: true },
    });

    const team1Ids = new Set<number>();
    const team2Ids = new Set<number>();
    const allowed = new Set<number>();

    for (const p of players) {
        allowed.add(p.memberId);
        if (p.teamId === team1Id) team1Ids.add(p.memberId);
        else if (p.teamId === team2Id) team2Ids.add(p.memberId);
    }

    return { team1Ids, team2Ids, allowed };
}

export async function validateMatchGoals(
    team1Id: number,
    team2Id: number,
    goals: { memberId: number }[],
): Promise<void> {
    if (!goals.length) return;

    const { allowed } = await loadRosterSets(team1Id, team2Id);

    for (const g of goals) {
        if (!allowed.has(g.memberId)) {
            throw new MatchGoalsValidationError(
                `Goal scorer ${g.memberId} is not on either match team`,
            );
        }
    }
}

/** Authoritative scores from goal rows — rejects scorers outside the match rosters. */
export async function deriveScoresFromGoals(
    team1Id: number,
    team2Id: number,
    goals: { memberId: number }[],
): Promise<{ score1: number; score2: number }> {
    if (!goals.length) {
        return { score1: 0, score2: 0 };
    }

    const { team1Ids, team2Ids, allowed } = await loadRosterSets(team1Id, team2Id);
    let score1 = 0;
    let score2 = 0;

    for (const g of goals) {
        if (!allowed.has(g.memberId)) {
            throw new MatchGoalsValidationError(
                `Goal scorer ${g.memberId} is not on either match team`,
            );
        }
        if (team1Ids.has(g.memberId)) score1++;
        else score2++;
    }

    return { score1, score2 };
}

export function isMatchGoalsValidationError(error: unknown): error is MatchGoalsValidationError {
    return error instanceof MatchGoalsValidationError;
}
