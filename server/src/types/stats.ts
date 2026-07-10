export interface StandingsEntry {
    teamId: number;
    teamName: string;
    played: number;
    won: number;
    drawn: number;
    lost: number;
    goalsFor: number;
    goalsAgainst: number;
    goalDifference: number;
    points: number;
    logoUrl?: string;
}

export interface TopScorer {
    memberId: number;
    playerName: string;
    teamName: string;
    teamId: number;
    position: string;
    goals: number;
    /** Approved roster head photo (`/uploads/...` or empty). */
    head_photo?: string;
    isCaptain?: boolean;
    isTeamOwner?: boolean;
    squadRole?: string | null;
}
