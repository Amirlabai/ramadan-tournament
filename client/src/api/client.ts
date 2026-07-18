import axios from 'axios';
import type { Match, TopScorer } from '../types';
import type { TournamentSlug } from '../utils/tournamentPaths';
import { apiBaseUrl } from '../utils/apiBase';
import { getAuthToken } from '../utils/authToken';

export type { TournamentSlug } from '../utils/tournamentPaths';

const API_URL = apiBaseUrl();

const api = axios.create({
    baseURL: `${API_URL}/api`,
    withCredentials: true,
});

api.interceptors.request.use((config) => {
    const token = getAuthToken();
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

/** Player zone only — no platform Bearer (avoids rt_auth_token masking rt_player). */
const playerApi = axios.create({
    baseURL: `${API_URL}/api`,
    withCredentials: true,
});

const teamsPath = (slug: TournamentSlug) => (slug === 'girls' ? '/teams-girls' : '/teams');
const newsPath = (slug: TournamentSlug) => (slug === 'girls' ? '/news-girls' : '/news');

export const seasonsAPI = {
    getActive: (division: TournamentSlug = 'boys') =>
        api.get('/seasons/active', { params: { division } }),
};

export const teamsAPI = {
    getAll: (slug: TournamentSlug = 'boys') => api.get(teamsPath(slug)),
    getById: (id: number, slug: TournamentSlug = 'boys') => api.get(`${teamsPath(slug)}/${id}`),
    hasClaimablePlayers: (slug: TournamentSlug = 'boys') =>
        api.get<{ hasClaimablePlayers: boolean }>(`${teamsPath(slug)}/has-claimable-players`),
    getAvailablePlayers: (teamId: number, slug: TournamentSlug = 'boys') =>
        api.get(`${teamsPath(slug)}/${teamId}/available-players`),
    getRequests: (id: number, slug: TournamentSlug = 'boys') =>
        api.get(`${teamsPath(slug)}/${id}/requests`),
    approveRequest: (id: number, userId: string, status: 'approved' | 'rejected', slug: TournamentSlug = 'boys') =>
        api.post(`${teamsPath(slug)}/${id}/requests`, { userId, status }),
    updateMetadata: (id: number, data: {
        name?: string;
        description?: string;
        logoPosition?: 'left' | 'right' | 'none';
    }, slug: TournamentSlug = 'boys') =>
        api.patch(`${teamsPath(slug)}/${id}/metadata`, data),
    uploadLogo: (id: number, formData: FormData, slug: TournamentSlug = 'boys') =>
        api.post(`${teamsPath(slug)}/${id}/logo`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        }),
    deleteLogo: (id: number, slug: TournamentSlug = 'boys') => api.delete(`${teamsPath(slug)}/${id}/logo`),
    addPlayer: (teamId: number, data: {
        firstName: string; lastName?: string; nickname?: string;
        number: number; position?: string; isCaptain?: boolean; birthYear?: number;
    }, slug: TournamentSlug = 'boys') => api.post(`${teamsPath(slug)}/${teamId}/players`, data),
    deletePlayer: (teamId: number, memberId: number, slug: TournamentSlug = 'boys') =>
        api.delete(`${teamsPath(slug)}/${teamId}/players/${memberId}`),
    deletePlayerPhoto: (teamId: number, memberId: number, slug: TournamentSlug = 'boys') =>
        api.delete(`${teamsPath(slug)}/${teamId}/players/${memberId}/photo`),
    updateManagedPlayer: (
        teamId: number,
        memberId: number,
        data: {
            firstName?: string;
            lastName?: string;
            nickname?: string;
            number?: number;
            position?: string;
            bio?: string;
        },
        slug: TournamentSlug = 'boys'
    ) => api.patch(`${teamsPath(slug)}/${teamId}/players/${memberId}`, data),
    uploadManagedPlayerPhoto: (
        teamId: number,
        memberId: number,
        formData: FormData,
        slug: TournamentSlug = 'boys'
    ) =>
        api.post(`${teamsPath(slug)}/${teamId}/players/${memberId}/photo`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
        }),
    deleteManagedPlayerPhoto: (teamId: number, memberId: number, slug: TournamentSlug = 'boys') =>
        api.delete(`${teamsPath(slug)}/${teamId}/players/${memberId}/photo`),
    movePlayer: (teamId: number, memberId: number, targetTeamId: number, slug: TournamentSlug = 'boys') =>
        api.patch(`${teamsPath(slug)}/${teamId}/players/${memberId}/move`, { targetTeamId }),
};


export const matchesAPI = {
    getAll: () => api.get('/matches'),
    create: (data: any) => api.post('/matches', data),
    update: (id: number, data: any) => api.put(`/matches/${id}`, data),
    delete: (id: number) => api.delete(`/matches/${id}`),
    syncPlayoffs: () => api.post('/matches/sync-playoffs'),
};

export type MatchStatsSidePair = { a: number; b: number };

export type MatchStatsResponse = {
    matchId: number;
    bucket: number;
    status: 'live' | 'finished' | 'upcoming';
    stats: {
        possession: MatchStatsSidePair;
        shots: MatchStatsSidePair;
        shotsOnTarget: MatchStatsSidePair;
        shotsOffTarget: MatchStatsSidePair;
        corners: MatchStatsSidePair;
        fouls: MatchStatsSidePair;
        offsides: MatchStatsSidePair;
        saves: MatchStatsSidePair;
    };
    winChance: MatchStatsSidePair;
};

export const matchStatsAPI = {
    get: (id: number) => api.get<MatchStatsResponse>(`/match-stats/${id}`),
    regenerate: (id: number) => api.post<MatchStatsResponse>(`/match-stats/${id}/regenerate`),
};

export const statsGirlsAPI = {
    getDashboard: () => api.get('/stats-girls'),
    getStandings: () => api.get('/stats-girls/standings'),
};

export const newsAPI = {
    getAll: (slug: TournamentSlug = 'boys') => api.get(newsPath(slug)),
    create: (data: any, slug: TournamentSlug = 'boys') => api.post(newsPath(slug), data),
    update: (id: number, data: any, slug: TournamentSlug = 'boys') => api.put(`${newsPath(slug)}/${id}`, data),
    delete: (id: number, slug: TournamentSlug = 'boys') => api.delete(`${newsPath(slug)}/${id}`),
};

export const statsAPI = {
    getStandings: () => api.get('/stats/standings'),
    getTopScorers: () => api.get<TopScorer[]>('/stats/top-scorers'),
    getPlayerStats: () => api.get('/stats/player-stats'),
    getPlayoffs: () => api.get<Match[]>('/stats/playoffs'),
    getDashboard: () => api.get('/stats/dashboard'),
};

export const worldcupAPI = {
    getMeta: () => api.get('/worldcup/meta'),
    getMatches: () => api.get<Match[]>('/worldcup/matches'),
    getTeams: () => api.get('/worldcup/teams'),
    getStandings: () => api.get('/worldcup/stats/standings'),
    getTopScorers: () => api.get<TopScorer[]>('/worldcup/stats/top-scorers'),
    getDashboard: () => api.get('/worldcup/stats/dashboard'),
    getKnockout: () => api.get<Match[]>('/worldcup/stats/knockout'),
};

export const authAPI = {
    login: (credentials: any) =>
        api.post('/auth/login', credentials),
    register: (data: any) =>
        api.post('/auth/register', data),
    googleLogin: (token: string) =>
        api.post('/auth/google', { token }),
    logout: () => api.post('/auth/logout'),
    getCurrentUser: () => api.get('/auth/me'),
    verifyEmail: (email: string, code: string) =>
        api.post('/auth/verify-email', { email, code }),
    resendVerification: (email: string) =>
        api.post('/auth/resend-verification', { email }),
    forgotPassword: (email: string) =>
        api.post('/auth/forgot-password', { email }),
    resetPassword: (token: string, password: string) =>
        api.post('/auth/reset-password', { token, password }),
};

export const usersAPI = {
    getRegistration: (slug: TournamentSlug = 'boys') =>
        api.get('/users/registration', { params: { division: slug } }),
    verifyIdentity: (personalId: string, birthYear: string, slug: TournamentSlug = 'boys') =>
        api.post('/users/verify-identity', { personalId, birthYear }, { params: { division: slug } }),
    cancelRegistrationRequest: (slug: TournamentSlug = 'boys') =>
        api.post('/users/cancel-registration-request', {}, { params: { division: slug } }),
    cancelPlayerMapping: () => api.post('/users/cancel-mapping'),
    uploadAvatar: (formData: FormData) =>
        api.post('/users/avatar', formData),
    deleteAvatar: () =>
        api.delete('/users/avatar'),
    useGoogleAvatar: () =>
        api.post('/users/avatar/use-google'),
    updatePlayerProfile: (data: { firstName?: string; lastName?: string; nickname?: string; number?: number; position?: string }) =>
        api.patch('/users/player-profile', data),
    leaveTeam: (slug: TournamentSlug = 'boys') =>
        api.post('/users/leave-team', {}, { params: { division: slug } }),
};

export const registrationAPI = {
    listAvailableTeams: (slug: TournamentSlug = 'boys') =>
        api.get(`${teamsPath(slug)}/available`),
    listOwnerJoinRequests: (teamId: number, slug: TournamentSlug = 'boys') =>
        api.get(`${teamsPath(slug)}/${teamId}/join-requests-pending`),
    submitJoin: (
        teamId: number,
        slug: TournamentSlug = 'boys',
        body?: { memberId?: number; playerProfile?: Record<string, unknown> }
    ) => api.post(`${teamsPath(slug)}/${teamId}/join-request`, body ?? {}),
    submitCreation: (teamName: string, description: string, slug: TournamentSlug = 'boys') =>
        api.post(`${teamsPath(slug)}/creation-request`, { teamName, description }),
    submitTransfer: (toTeamId: number, slug: TournamentSlug = 'boys') =>
        api.post(`${teamsPath(slug)}/transfer-request`, { toTeamId }),
    ownerReviewJoin: (teamId: number, requestId: string, approve: boolean, slug: TournamentSlug = 'boys') =>
        api.post(`${teamsPath(slug)}/${teamId}/owner-review-join`, { requestId, approve }),
    setSquadRoles: (
        teamId: number,
        roles: { memberId: number; squadRole: string | null }[],
        slug: TournamentSlug = 'boys'
    ) => api.patch(`${teamsPath(slug)}/${teamId}/squad-roles`, { roles }),
    addSelfToRoster: (teamId: number, slug: TournamentSlug = 'boys') =>
        api.post(`${teamsPath(slug)}/${teamId}/roster/add-self`),
};
export const adminAPI = {
    uploadPlayers: (formData: FormData) => api.post('/admin/import-players', formData),
    getBannedWords: () => api.get('/admin/banned-words'),
    addBannedWord: (data: { word: string; language?: string }) => api.post('/admin/banned-words', data),
    removeBannedWord: (id: string) => api.delete(`/admin/banned-words/${id}`),
    getComments: () => api.get('/admin/comments'),
    deleteComment: (id: string) => api.delete(`/admin/comments/${id}`),
    forceDeletePhoto: (teamId: number, memberId: number) => api.post('/admin/photos/delete', { teamId, memberId }),
    getTeamRequests: () => api.get('/admin/team-requests'),
    approveTeamRequest: (userId: string, action: 'approved' | 'rejected') =>
        api.post(`/admin/team-requests/${userId}`, { action }),
    getUserMappings: () => api.get('/admin/user-mappings'),
    updateUserMapping: (userId: string, data: { teamId?: number; status?: string; role?: string }) =>
        api.patch(`/admin/user-mappings/${userId}`, data),
    triggerNewsAutomation: () => api.post('/admin/trigger-automation'),
    listSeasons: () => api.get('/admin/seasons'),
    getGirlsSeasonSummary: () => api.get('/admin/seasons/girls/summary'),
    createGirlsSeason: (data: { yearMonth: string; displayName: string; activate?: boolean }) =>
        api.post('/admin/seasons/girls', data),
    activateSeason: (seasonId: string) => api.post(`/admin/seasons/${seasonId}/activate`),
    addGirlsTeam: (seasonId: string, name: string) =>
        api.post(`/admin/seasons/${seasonId}/teams`, { name }),
    listPointEntries: (seasonId: string) =>
        api.get('/admin/point-entries', { params: { seasonId } }),
    createPointEntry: (data: { seasonId: string; teamId: number; points: number; note?: string }) =>
        api.post('/admin/point-entries', data),
    getGirlsStandings: () => api.get('/stats-girls/standings'),
    getWorkflowQueues: (seasonId?: string) =>
        api.get('/admin/workflows', { params: seasonId ? { seasonId } : {} }),
    getWorkflowPendingCount: () => api.get('/admin/workflows/pending-count'),
    searchIdentityUsers: (seasonId: string, q: string) =>
        api.get('/admin/workflows/user-search', { params: { seasonId, q } }),
    assignIdentity: (userId: string, seasonId: string, personalId: string, birthYear: string) =>
        api.post('/admin/users/identity', { userId, seasonId, personalId, birthYear }),
    reviewCreationRequest: (id: string, approve: boolean) =>
        api.patch(`/admin/requests/creation/${id}`, { approve }),
    reviewJoinRequest: (id: string, approve: boolean) =>
        api.patch(`/admin/requests/join/${id}`, { approve }),
    reviewTransferRequest: (id: string, approve: boolean) =>
        api.patch(`/admin/requests/transfer/${id}`, { approve }),
    searchUsers: (q: string) => api.get('/admin/users', { params: { q } }),
    setUserRole: (userId: string, role: 'admin' | 'user') =>
        api.patch(`/admin/users/${userId}/role`, { role }),
    getCaptainCandidates: (teamId: number, slug: TournamentSlug = 'boys') =>
        api.get(`/admin/teams/${teamId}/captain-candidates`, { params: { division: slug } }),
    setTeamCaptain: (teamId: number, memberId: number, slug: TournamentSlug = 'boys') =>
        api.patch(`/admin/teams/${teamId}/captain`, { memberId, division: slug }),
};

export const commentsAPI = {
    getByMatchId: (matchId: number, opts?: { signal?: AbortSignal }) =>
        api.get(`/comments/${matchId}`, { signal: opts?.signal }),
    create: (data: { matchId: number; author?: string; content: string }) => api.post('/comments', data),
};

export const playerAPI = {
    login: (personalId: string, birthYear: string) => playerApi.post('/players/auth', { personalId, birthYear }),
    logout: () => playerApi.post('/players/logout'),
    uploadPhoto: (formData: FormData) => playerApi.post('/players/upload', formData),
};

const votesBase = (slug: TournamentSlug) => (slug === 'girls' ? '/votes-girls' : '/votes');

export const votesAPI = {
    cast: (playerMemberId: number, category: string = 'mvp', slug: TournamentSlug = 'boys') =>
        api.post(votesBase(slug), { playerMemberId, category }),
    castGirlsTeam: (teamId: number, category: string = 'mvp') =>
        api.post('/votes-girls', { teamId, category }),
    getMyVote: (category: string = 'mvp', slug: TournamentSlug = 'boys') =>
        api.get(`${votesBase(slug)}/my`, { params: { category } }),
    getResults: (category: string = 'mvp', slug: TournamentSlug = 'boys') =>
        api.get(`${votesBase(slug)}/results`, { params: { category } }),
};

export const archiveAPI = {
    getAll: (slug: TournamentSlug = 'boys') =>
        api.get('/archive', { params: { division: slug } }),
    getById: (yearMonth: string, slug: TournamentSlug = 'boys') =>
        api.get(`/archive/${yearMonth}`, { params: { division: slug } }),
    create: (data: {
        yearMonth: string;
        displayName: string;
        winnerId: number;
        mvpId?: number;
        summary?: string;
        division?: TournamentSlug;
    }) => api.post('/archive/create', data),
};
