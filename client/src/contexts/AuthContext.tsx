import React, { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { authAPI } from '../api/client';

export type UserRole = 'Admin' | 'Captain' | 'Player' | 'User' | 'admin';

export interface MappedPlayerInfo {
    teamId: number;
    teamName?: string;
    memberId: number;
    playerName?: string;
    status: 'pending' | 'approved' | 'rejected';
}

export interface TournamentRegistrationSummary {
    seasonId: string;
    division: string;
    status: string;
    activeDivision?: string | null;
    onRoster?: { teamId: number; memberId: number } | null;
    ownedTeamId?: number | null;
}

export interface User {
    id: string;
    username?: string;
    email?: string;
    displayName: string;
    role: UserRole;
    avatarUrl?: string;
    mappedPlayerInfo?: MappedPlayerInfo;
    playerProfile?: any;
    activeDivision?: string | null;
    tournamentRegistration?: {
        boys: TournamentRegistrationSummary | null;
        girls: TournamentRegistrationSummary | null;
    };
}

interface AuthContextType {
    user: User | null;
    loading: boolean;
    login: (user: User) => void;
    logout: () => Promise<void>;
    refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function mapUser(data: Record<string, unknown>): User {
    return {
        id: (data.id ?? data._id) as string,
        username: data.username as string | undefined,
        email: data.email as string | undefined,
        displayName: data.displayName as string,
        role: data.role as UserRole,
        avatarUrl: data.avatarUrl as string | undefined,
        mappedPlayerInfo: data.mappedPlayerInfo as MappedPlayerInfo | undefined,
        playerProfile: data.playerProfile,
        activeDivision: data.activeDivision as string | null | undefined,
        tournamentRegistration: data.tournamentRegistration as User['tournamentRegistration'],
    };
}

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    const refreshUser = async () => {
        try {
            const response = await authAPI.getCurrentUser();
            setUser(mapUser(response.data));
        } catch {
            setUser(null);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        refreshUser();
    }, []);

    const login = (newUser: User) => {
        setUser(newUser);
    };

    const logout = async () => {
        try {
            await authAPI.logout();
        } catch {
            /* cookie may already be cleared */
        }
        setUser(null);
    };

    return (
        <AuthContext.Provider value={{ user, loading, login, logout, refreshUser }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
