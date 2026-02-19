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
}

export interface Team {
    _id: string;
    id: number;
    name: string;
    players: Player[];
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
    team2Name?: string;
    goals: Goal[];
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
    goals: number;
}

export interface DashboardData {
    nextMatches: Match[];
    recentMatches: Match[];
    topScorer: TopScorer | null;
}

export interface User {
    _id: string;
    username: string;
    role: 'admin';
}

export interface AuthResponse {
    token: string;
    user: User;
}
