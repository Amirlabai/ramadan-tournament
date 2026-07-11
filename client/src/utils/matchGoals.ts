import type { Goal, Team } from '../types';

function teamMemberIds(teams: Team[], teamId: number): Set<number> {
    return new Set(teams.find(t => t.id === teamId)?.players.map(p => p.memberId) ?? []);
}

export function isPlayerOnTeam(memberId: number, teamId: number, teams: Team[]): boolean {
    return teamMemberIds(teams, teamId).has(memberId);
}

export type GoalLike = Pick<Goal, 'memberId' | 'minute' | 'isOwnGoal' | 'creditedTeamId'>;

/** Drop scorers that are not on either match team (own goals kept if creditedTeamId is valid). */
export function filterGoalsToTeams(
    goals: GoalLike[],
    team1Id: number,
    team2Id: number,
    teams: Team[],
): Goal[] {
    const team1Ids = teamMemberIds(teams, team1Id);
    const team2Ids = teamMemberIds(teams, team2Id);
    const matchTeams = new Set([team1Id, team2Id]);
    return goals.filter((g) => {
        if (g.isOwnGoal) {
            return g.creditedTeamId != null && matchTeams.has(g.creditedTeamId);
        }
        const mid = g.memberId;
        return mid != null && (team1Ids.has(mid) || team2Ids.has(mid));
    }) as Goal[];
}

/** Count goals per match side — own goals credit creditedTeamId. */
export function syncScoresFromGoals(
    goals: GoalLike[],
    team1Id: number,
    team2Id: number,
    teams: Team[],
): { score1: number; score2: number } {
    const validGoals = filterGoalsToTeams(goals, team1Id, team2Id, teams);
    const team1Ids = teamMemberIds(teams, team1Id);
    const team2Ids = teamMemberIds(teams, team2Id);
    let score1 = 0;
    let score2 = 0;
    for (const g of validGoals) {
        if (g.isOwnGoal) {
            if (g.creditedTeamId === team1Id) score1++;
            else if (g.creditedTeamId === team2Id) score2++;
            continue;
        }
        const mid = g.memberId;
        if (mid != null && team1Ids.has(mid)) score1++;
        else if (mid != null && team2Ids.has(mid)) score2++;
    }
    return { score1, score2 };
}

export function applyGoalsAndScores<T extends {
    goals: Goal[];
    score1: string;
    score2: string;
    team1Id: string;
    team2Id: string;
}>(
    draft: T,
    goals: Goal[],
    teams: Team[],
): T {
    const team1Id = parseInt(draft.team1Id);
    const team2Id = parseInt(draft.team2Id);
    const pruned = filterGoalsToTeams(goals, team1Id, team2Id, teams);
    const scores = syncScoresFromGoals(pruned, team1Id, team2Id, teams);
    return {
        ...draft,
        goals: pruned,
        score1: String(scores.score1),
        score2: String(scores.score2),
    };
}

export function assertPlayerOnTeam(memberId: number, teamId: number, teams: Team[]): void {
    if (!isPlayerOnTeam(memberId, teamId, teams)) {
        throw new Error('השחקן אינו משויך לקבוצה שנבחרה');
    }
}
