import { Express, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/env';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';
import { setAuthCookie, authJsonBody } from '../utils/authCookie';
import {
  MOCK_SEASON_ID,
  formatMatchForApi,
  formatTeamForApi,
  getMockStore,
} from './dataLoader';
import {
  getPlayerStats,
  getStandings,
  getStatsMaps,
  getTopScorers,
} from './mockStats';
import worldcupRoutes from '../routes/worldcup';

const MOCK_ADMIN_ID = 'mock-dev-admin';

function mockAdminUser() {
  return {
    id: MOCK_ADMIN_ID,
    username: config.adminUsername,
    displayName: 'Mock Admin',
    role: 'admin' as const,
    email: 'mock@localhost',
    avatarUrl: undefined,
    mappedPlayerInfo: null,
    playerProfile: null,
    activeDivision: 'boys',
    tournamentRegistration: { boys: null, girls: null },
  };
}

function enrichMatch(match: ReturnType<typeof formatMatchForApi>, teamMap: Map<number, { name: string; logoUrl: string; logoPosition: string }>) {
  const t1 = teamMap.get(match.team1Id);
  const t2 = teamMap.get(match.team2Id);
  return {
    ...match,
    team1Name: t1?.name || `קבוצה ${match.team1Id}`,
    team1LogoUrl: t1?.logoUrl,
    team1LogoPosition: t1?.logoPosition,
    team2Name: t2?.name || `קבוצה ${match.team2Id}`,
    team2LogoUrl: t2?.logoUrl,
    team2LogoPosition: t2?.logoPosition,
  };
}

function buildDashboard() {
  const { teams, matches } = getMockStore();
  const { statsMap } = getStatsMaps();
  const topScorers = getTopScorers();
  const teamMap = new Map(
    teams.map((t) => [t.id, { name: t.name, logoUrl: t.logoUrl, logoPosition: t.logoPosition }])
  );

  const now = new Date();
  const upcoming = matches
    .filter((m) => m.date >= now)
    .sort((a, b) => a.date.getTime() - b.date.getTime());
  const nextDate = upcoming[0]?.date;

  let nextMatches: ReturnType<typeof enrichMatch>[] = [];
  if (nextDate) {
    const dayKey = nextDate.toISOString().slice(0, 10);
    nextMatches = matches
      .filter((m) => m.date.toISOString().slice(0, 10) === dayKey)
      .sort((a, b) => a.date.getTime() - b.date.getTime())
      .map((m) => enrichMatch(formatMatchForApi(m), teamMap));
  }

  const recentMatches = matches
    .filter((m) => m.score1 !== null && m.score2 !== null)
    .sort((a, b) => b.date.getTime() - a.date.getTime())
    .slice(0, 5)
    .map((m) => enrichMatch(formatMatchForApi(m), teamMap));

  const unplayedGroup = matches.filter(
    (m) => m.phase === 'group' && (m.score1 === null || m.score2 === null)
  ).length;
  const playoffMatches =
    unplayedGroup === 0
      ? matches
          .filter((m) => m.phase === 'knockout')
          .sort((a, b) => a.id - b.id)
          .map((m) => enrichMatch(formatMatchForApi(m), teamMap))
      : [];

  return {
    topScorers: topScorers.slice(0, 3),
    nextMatches,
    recentMatches,
    playoffMatches,
    teams: teams.map((t) => ({
      id: t.id,
      name: t.name,
      logoUrl: t.logoUrl,
      logoPosition: t.logoPosition,
    })),
  };
}

export function registerMockRoutes(app: Express): void {
  console.log('MOCK_DEV_DATA=1 — API serves read-only data from data/*.json (no Postgres)');

  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      database: 'mock',
      redis: 'disabled',
      timestamp: new Date().toISOString(),
    });
  });

  app.get('/api/seasons/active', (req, res) => {
    const division = req.query.division === 'girls' ? 'girls' : 'boys';
    if (division === 'girls') {
      res.status(404).json({ error: 'No active season found' });
      return;
    }
    res.json({
      seasonId: MOCK_SEASON_ID,
      yearMonth: '2026-02',
      division: 'boys',
      scoringMode: 'football',
      displayName: 'טורניר כדורגל רמדאן 2026 (mock)',
      isActive: true,
    });
  });

  const teamsHandler = (_req: Request, res: Response) => {
    const { teams, statsMap } = getStatsMaps();
    res.json(teams.map((t) => formatTeamForApi(t, statsMap)));
  };

  const teamByIdHandler = (req: Request, res: Response) => {
    const id = parseInt(req.params.id, 10);
    const { teams, statsMap } = getStatsMaps();
    const team = teams.find((t) => t.id === id);
    if (!team) {
      res.status(404).json({ error: 'Team not found' });
      return;
    }
    res.json(formatTeamForApi(team, statsMap));
  };

  app.get('/api/teams', teamsHandler);
  app.get('/api/teams/:id', teamByIdHandler);
  app.get('/api/teams-girls', (_req, res) => res.json([]));
  app.get('/api/teams-girls/:id', (_req, res) => res.status(404).json({ error: 'Team not found' }));

  app.get('/api/matches', (_req, res) => {
    const { matches } = getMockStore();
    const sorted = [...matches].sort((a, b) => b.date.getTime() - a.date.getTime());
    res.json(sorted.map(formatMatchForApi));
  });

  app.get('/api/news', (_req, res) => {
    const { news } = getMockStore();
    res.json([...news].sort((a, b) => b.date.getTime() - a.date.getTime()));
  });
  app.get('/api/news-girls', (_req, res) => res.json([]));

  app.get('/api/stats/standings', (_req, res) => res.json(getStandings()));
  app.get('/api/stats/top-scorers', (_req, res) => res.json(getTopScorers()));
  app.get('/api/stats/player-stats', (_req, res) => res.json(getPlayerStats()));
  app.get('/api/stats/dashboard', (_req, res) => res.json(buildDashboard()));
  app.get('/api/stats', (_req, res) => res.json(buildDashboard()));
  app.get('/api/stats/playoffs', (_req, res) => {
    const dashboard = buildDashboard();
    res.json(dashboard.playoffMatches);
  });

  const noGirlsSeason = (_req: Request, res: Response) => {
    res.status(404).json({ error: 'no_active_girls_season', message: 'אין עונה פעילה לטורניר בנות' });
  };
  app.get('/api/stats-girls', noGirlsSeason);
  app.get('/api/stats-girls/standings', noGirlsSeason);
  app.get('/api/stats-girls/dashboard', noGirlsSeason);

  app.get('/api/comments/:matchId', (_req, res) => res.json([]));
  app.get('/api/votes/results', (_req, res) => res.json({}));
  app.get('/api/archive', (_req, res) => res.json([]));

  if (config.worldCupEnabled) {
    app.use('/api/worldcup', worldcupRoutes);
  }

  app.post('/api/auth/login', (req, res) => {
    const { username, email, password } = req.body;
    const name = username || email;
    const expectedPassword = config.adminPassword || 'admin123';
    if (name === config.adminUsername && password === expectedPassword) {
      const token = jwt.sign(
        { userId: MOCK_ADMIN_ID, role: 'admin' },
        config.jwtSecret,
        { expiresIn: '7d' }
      );
      setAuthCookie(res, token);
      res.json(authJsonBody(mockAdminUser(), token));
      return;
    }
    res.status(401).json({ error: 'Invalid credentials' });
  });

  app.get('/api/auth/me', authenticate, (req: AuthRequest, res) => {
    if (req.userId === MOCK_ADMIN_ID) {
      res.json(mockAdminUser());
      return;
    }
    res.status(401).json({ error: 'User not found' });
  });

  app.get('/api/admin/banned-words', authenticate, authorize(['Admin', 'admin']), (_req, res) => {
    res.json([]);
  });
  app.get('/api/admin/comments', authenticate, authorize(['Admin', 'admin']), (_req, res) => {
    res.json([]);
  });
  app.get('/api/admin/photos/pending', authenticate, authorize(['Admin', 'admin']), (_req, res) => {
    res.json([]);
  });
  app.get('/api/admin/workflows', authenticate, authorize(['Admin', 'admin']), (_req, res) => {
    res.json({
      creationRequests: [],
      joinRequests: [],
      transferRequests: [],
      invoicePending: [],
    });
  });

  app.use('/api', (req, res) => {
    if (req.method === 'GET') {
      res.status(404).json({ error: 'Not available in mock dev mode', path: req.originalUrl });
      return;
    }
    res.status(503).json({
      error: 'Writes disabled in mock dev mode',
      hint: 'Set MOCK_DEV_DATA=0 and DATABASE_URL when Postgres is available',
    });
  });
}
