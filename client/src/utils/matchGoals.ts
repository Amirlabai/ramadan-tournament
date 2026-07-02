import type { Goal, Team } from '../types';

function teamMemberIds(teams: Team[], teamId: number): Set<number> {
    return new Set(teams.find(t => t.id === teamId)?.players.map(p => p.memberId) ?? []);
}

export function isPlayerOnTeam(memberId: number, teamId: number, teams: Team[]): boolean {
    return teamMemberIds(teams, teamId).has(memberId);
}

/** Drop scorers that are not on either match team. */
export function filterGoalsToTeams(
    goals: Pick<Goal, 'memberId' | 'minute'>[],
    team1Id: number,
    team2Id: number,
    teams: Team[],
): Goal[] {
    const team1Ids = teamMemberIds(teams, team1Id);
    const team2Ids = teamMemberIds(teams, team2Id);
    return goals.filter(
        (g) => team1Ids.has(g.memberId) || team2Ids.has(g.memberId),
    ) as Goal[];
}

/** Count goals per match side from scorer roster membership (invalid scorers excluded). */
export function syncScoresFromGoals(
    goals: Pick<Goal, 'memberId' | 'minute'>[],
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
        if (team1Ids.has(g.memberId)) score1++;
        else if (team2Ids.has(g.memberId)) score2++;
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
