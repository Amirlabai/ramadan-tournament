export interface Player {
    memberId: number;
    firstName: string;
    lastName: string;
    nickname: string;
    number: number;
    position: string;
    isCaptain: boolean;
    head_photo?: string;
    pending_head_photo?: string;
    bio?: string;
    hasPersonalId?: boolean;
    birthYear?: number;
    totalGoals?: number;
    gamesPlayed?: number;
}

export interface Team {
    _id: string;
    id: number;
    name: string;
    players: Player[];
    logoUrl?: string;
    logoPosition?: 'left' | 'right' | 'none';
    createdAt: string;
}

export interface Goal {
    memberId: number;
    minute: number;
}

export interface Match {
    _id: string;
    id: number;
    date: string;
    location: string;
    phase: 'group' | 'knockout';
    team1Id: number;
    team2Id: number;
    score1: number;
    score2: number;
    team1Name?: string;
    team1LogoUrl?: string;
    team1LogoPosition?: 'left' | 'right' | 'none';
    team2Name?: string;
    team2LogoUrl?: string;
    team2LogoPosition?: 'left' | 'right' | 'none';
    goals: Goal[];
    commentCount?: number;
    createdAt: string;
}

export interface News {
    _id: string;
    id: number;
    title: string;
    message: string;
    date: string;
    priority: 'normal' | 'high';
    createdAt: string;
}

export interface Standing {
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
}

export interface TopScorer {
    memberId: number;
    playerName: string;
    teamName: string;
    teamId: number;
    goals: number;
}

export interface DashboardData {
    nextMatches: Match[];
    recentMatches: Match[];
    topScorers: TopScorer[];
}

export interface MappedPlayerInfo {
    teamId: number;
    teamName?: string;
    logoUrl?: string;
    logoPosition?: 'left' | 'right' | 'none';
    memberId: number;
    playerName?: string;
    status: 'pending' | 'approved' | 'rejected';
}

export interface User {
    _id: string;
    email: string;
    displayName: string;
    role: 'Admin' | 'Captain' | 'Player' | 'User' | 'admin';
    avatarUrl?: string;
    mappedPlayerInfo?: MappedPlayerInfo;
    playerProfile?: Partial<Player>;
}

export interface AuthResponse {
    token: string;
    user: User;
}
