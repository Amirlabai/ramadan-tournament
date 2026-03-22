import axios from 'axios';
import type { Match, TopScorer } from '../types';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const api = axios.create({
    baseURL: `${API_URL}/api`,
});

// Add auth token to requests if available
api.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

// API endpoints
export const teamsAPI = {
    getAll: () => api.get('/teams'),
    getById: (id: number) => api.get(`/teams/${id}`),
    getAvailablePlayers: (teamId: number) => api.get(`/teams/${teamId}/available-players`),
    getRequests: (id: number) => api.get(`/teams/${id}/requests`),
    approveRequest: (id: number, userId: string, status: 'approved' | 'rejected') =>
        api.post(`/teams/${id}/requests`, { userId, status }),
    updateMetadata: (id: number, data: { name?: string; logoPosition?: 'left' | 'right' | 'none' }) =>
        api.patch(`/teams/${id}/metadata`, data),
    uploadLogo: (id: number, formData: FormData) =>
        api.post(`/teams/${id}/logo`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        }),
    deleteLogo: (id: number) => api.delete(`/teams/${id}/logo`),
    addPlayer: (teamId: number, data: {
        firstName: string; lastName?: string; nickname?: string;
        number: number; position?: string; isCaptain?: boolean; birthYear?: number;
    }) => api.post(`/teams/${teamId}/players`, data),
    deletePlayer: (teamId: number, memberId: number) =>
        api.delete(`/teams/${teamId}/players/${memberId}`),
    movePlayer: (teamId: number, memberId: number, targetTeamId: number) =>
        api.patch(`/teams/${teamId}/players/${memberId}/move`, { targetTeamId }),
};


export const matchesAPI = {
    getAll: () => api.get('/matches'),
    create: (data: any) => api.post('/matches', data),
    update: (id: number, data: any) => api.put(`/matches/${id}`, data),
    delete: (id: number) => api.delete(`/matches/${id}`),
    syncPlayoffs: () => api.post('/matches/sync-playoffs'),
};

export const newsAPI = {
    getAll: () => api.get('/news'),
    create: (data: any) => api.post('/news', data),
    update: (id: number, data: any) => api.put(`/news/${id}`, data),
    delete: (id: number) => api.delete(`/news/${id}`),
};

export const statsAPI = {
    getStandings: () => api.get('/stats/standings'),
    getTopScorers: () => api.get<TopScorer[]>('/stats/top-scorers'),
    getPlayerStats: () => api.get('/stats/player-stats'),
    getPlayoffs: () => api.get<Match[]>('/stats/playoffs'),
    getDashboard: () => api.get('/stats/dashboard'),
};

export const authAPI = {
    login: (credentials: any) =>
        api.post('/auth/login', credentials),
    register: (data: any) =>
        api.post('/auth/register', data),
    googleLogin: (token: string) =>
        api.post('/auth/google', { token }),
    getCurrentUser: () => api.get('/auth/me'),
    verifyEmail: (email: string, code: string) =>
        api.post('/auth/verify-email', { email, code }),
    resendVerification: (email: string) =>
        api.post('/auth/resend-verification', { email }),
};

export const usersAPI = {
    requestMapping: (data: { teamId: number; memberId?: number; playerProfile?: object }) =>
        api.post('/users/map-player', data),
    uploadAvatar: (formData: FormData) =>
        api.post('/users/avatar', formData),
    deleteAvatar: () =>
        api.delete('/users/avatar'),
    updatePlayerProfile: (data: { firstName?: string; lastName?: string; nickname?: string; number?: number; position?: string }) =>
        api.patch('/users/player-profile', data),
    requestTeam: (teamName: string, description: string) =>
        api.post('/users/request-team', { teamName, description }),
    leaveTeam: () => api.post('/users/leave-team'),
};
export const adminAPI = {
    uploadPlayers: (formData: FormData) => api.post('/admin/import-players', formData),
    getBannedWords: () => api.get('/admin/banned-words'),
    addBannedWord: (data: { word: string; language?: string }) => api.post('/admin/banned-words', data),
    removeBannedWord: (id: string) => api.delete(`/admin/banned-words/${id}`),
    getComments: () => api.get('/admin/comments'),
    deleteComment: (id: string) => api.delete(`/admin/comments/${id}`),
    getPendingPhotos: () => api.get('/admin/photos/pending'),
    approvePhoto: (teamId: number, memberId: number) => api.post('/admin/photos/approve', { teamId, memberId }),
    rejectPhoto: (teamId: number, memberId: number) => api.post('/admin/photos/reject', { teamId, memberId }),
    deletePlayerPhoto: (teamId: number, memberId: number) => api.post('/admin/photos/delete', { teamId, memberId }),
    getTeamRequests: () => api.get('/admin/team-requests'),
    approveTeamRequest: (userId: string, action: 'approved' | 'rejected') =>
        api.post(`/admin/team-requests/${userId}`, { action }),
    getUserMappings: () => api.get('/admin/user-mappings'),
    updateUserMapping: (userId: string, data: { teamId?: number; status?: string; role?: string }) =>
        api.patch(`/admin/user-mappings/${userId}`, data),
    triggerNewsAutomation: () => api.post('/admin/trigger-automation'),
};

export const commentsAPI = {
    getByMatchId: (matchId: number) => api.get(`/comments/${matchId}`),
    create: (data: { matchId: number; author?: string; content: string }) => api.post('/comments', data),
};

export const iftarAPI = {
    getNext: () => api.get('/iftar/next'),
};

export const playerAPI = {
    login: (personalId: string, birthYear: string) => api.post('/players/auth', { personalId, birthYear }),
    uploadPhoto: (formData: FormData) => api.post('/players/upload', formData),
};

export const votesAPI = {
    cast: (playerMemberId: number, category: string = 'mvp') => api.post('/votes', { playerMemberId, category }),
    getMyVote: (category: string = 'mvp') => api.get(`/votes/my?category=${category}`),
    getResults: (category: string = 'mvp') => api.get(`/votes/results?category=${category}`),
};

export const archiveAPI = {
    getAll: () => api.get('/archive'),
    getById: (yearMonth: string) => api.get(`/archive/${yearMonth}`),
    create: (data: { yearMonth: string; displayName: string; winnerId: number; mvpId?: number; summary?: string }) => 
        api.post('/archive/create', data),
};

export default api;
