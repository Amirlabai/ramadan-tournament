import { prisma } from '../lib/prisma';
import { SeasonService } from '../services/SeasonService';

export class MatchGoalsValidationError extends Error {
    readonly code = 'MATCH_GOALS_INVALID' as const;
    readonly kind: 'scorer' | 'own_goal';

    constructor(message: string, kind: 'scorer' | 'own_goal' = 'scorer') {
        super(message);
        this.name = 'MatchGoalsValidationError';
        this.kind = kind;
    }
}

export interface GoalInput {
    memberId?: number | null;
    minute?: number | null;
    isOwnGoal?: boolean;
    creditedTeamId?: number | null;
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

function isOwnGoalRow(goal: GoalInput): boolean {
    return goal.isOwnGoal === true;
}

export async function validateMatchGoals(
    team1Id: number,
    team2Id: number,
    goals: GoalInput[],
): Promise<void> {
    if (!goals.length) return;

    const { allowed } = await loadRosterSets(team1Id, team2Id);
    const matchTeamIds = new Set([team1Id, team2Id]);

    for (const g of goals) {
        if (isOwnGoalRow(g)) {
            if (g.creditedTeamId == null || !matchTeamIds.has(g.creditedTeamId)) {
                throw new MatchGoalsValidationError(
                    `Own goal creditedTeamId must be one of the match teams`,
                    'own_goal',
                );
            }
            if (g.memberId != null && !allowed.has(g.memberId)) {
                throw new MatchGoalsValidationError(
                    `Goal scorer ${g.memberId} is not on either match team`,
                );
            }
            continue;
        }

        if (g.memberId == null || !allowed.has(g.memberId)) {
            throw new MatchGoalsValidationError(
                `Goal scorer ${g.memberId} is not on either match team`,
            );
        }
    }
}

/** Authoritative scores from goal rows — own goals credit creditedTeamId. */
export async function deriveScoresFromGoals(
    team1Id: number,
    team2Id: number,
    goals: GoalInput[],
): Promise<{ score1: number; score2: number }> {
    if (!goals.length) {
        return { score1: 0, score2: 0 };
    }

    const { team1Ids, team2Ids, allowed } = await loadRosterSets(team1Id, team2Id);
    let score1 = 0;
    let score2 = 0;

    for (const g of goals) {
        if (isOwnGoalRow(g)) {
            if (g.creditedTeamId === team1Id) score1++;
            else if (g.creditedTeamId === team2Id) score2++;
            else {
                throw new MatchGoalsValidationError(
                    `Own goal creditedTeamId must be one of the match teams`,
                    'own_goal',
                );
            }
            continue;
        }

        if (g.memberId == null || !allowed.has(g.memberId)) {
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

export function isValidTechnicalWinner(
    team1Id: number,
    team2Id: number,
    technicalWinnerTeamId: number | null | undefined,
): boolean {
    if (technicalWinnerTeamId == null) return true;
    return technicalWinnerTeamId === team1Id || technicalWinnerTeamId === team2Id;
}
