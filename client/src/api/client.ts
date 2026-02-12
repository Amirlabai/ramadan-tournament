import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const api = axios.create({
    baseURL: `${API_URL}/api`,
    headers: {
        'Content-Type': 'application/json',
    },
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
};

export const matchesAPI = {
    getAll: () => api.get('/matches'),
    create: (data: any) => api.post('/matches', data),
    update: (id: number, data: any) => api.put(`/matches/${id}`, data),
    delete: (id: number) => api.delete(`/matches/${id}`),
};

export const newsAPI = {
    getAll: () => api.get('/news'),
    create: (data: any) => api.post('/news', data),
    update: (id: number, data: any) => api.put(`/news/${id}`, data),
    delete: (id: number) => api.delete(`/news/${id}`),
};

export const statsAPI = {
    getStandings: () => api.get('/stats/standings'),
    getTopScorers: () => api.get('/stats/top-scorers'),
    getPlayerStats: () => api.get('/stats/player-stats'),
    getDashboard: () => api.get('/stats/dashboard'),
};

export const authAPI = {
    login: (username: string, password: string) =>
        api.post('/auth/login', { username, password }),
    getCurrentUser: () => api.get('/auth/me'),
};

export const adminAPI = {
    uploadPlayers: (formData: FormData) => api.post('/admin/import-players', formData),
};

export default api;
