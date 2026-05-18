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
    token: string | null;
    loading: boolean;
    login: (token: string, user: User) => void;
    logout: () => void;
    refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
    const [loading, setLoading] = useState(true);

    const refreshUser = async () => {
        if (!token) {
            setLoading(false);
            return;
        }
        try {
            const response = await authAPI.getCurrentUser();
            setUser({
                id: response.data.id ?? response.data._id,
                username: response.data.username,
                email: response.data.email,
                displayName: response.data.displayName,
                role: response.data.role,
                avatarUrl: response.data.avatarUrl,
                mappedPlayerInfo: response.data.mappedPlayerInfo,
                playerProfile: response.data.playerProfile,
                activeDivision: response.data.activeDivision,
                tournamentRegistration: response.data.tournamentRegistration,
            });
        } catch (error) {
            console.error('Failed to fetch user:', error);
            logout();
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        refreshUser();
    }, [token]);

    const login = (newToken: string, newUser: User) => {
        localStorage.setItem('token', newToken);
        setToken(newToken);
        setUser(newUser);
    };

    const logout = () => {
        localStorage.removeItem('token');
        setToken(null);
        setUser(null);
    };

    return (
        <AuthContext.Provider value={{ user, token, loading, login, logout, refreshUser }}>
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
