import { beforeAll, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import type express from 'express';
import { createTestApp } from './createTestApp';
import { config } from '../config/env';

describe('mock API (supertest)', () => {
  let app: express.Express;

  beforeAll(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    app = createTestApp();
  });

  it('GET /api/health returns mock status', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.database).toBe('mock');
  });

  it('GET /api/teams returns team list', async () => {
    const res = await request(app).get('/api/teams');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body[0]).toHaveProperty('id');
    expect(res.body[0]).toHaveProperty('name');
  });

  it('GET /api/teams/:id returns 404 for unknown team', async () => {
    const res = await request(app).get('/api/teams/999999');
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Team not found');
  });

  it('POST /api/auth/login rejects invalid credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'wrong', password: 'wrong' });
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Invalid credentials');
  });

  it('POST /api/auth/login accepts mock admin credentials', async () => {
    const password = config.adminPassword || 'admin123';
    const res = await request(app)
      .post('/api/auth/login')
      .set('Origin', 'http://localhost:5173')
      .send({ username: config.adminUsername, password });
    expect(res.status).toBe(200);
    expect(res.body.user.role).toBe('admin');
    expect(res.headers['set-cookie']).toBeDefined();
  });

  it('GET /api/auth/me requires authentication', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  it('GET /api/match-stats/:id returns fabricated stats for a started match', async () => {
    const matchesRes = await request(app).get('/api/matches');
    expect(matchesRes.status).toBe(200);
    const { getMatchDisplayStatus } = await import('@ramadan-tournament/shared');
    const match = matchesRes.body.find(
      (m: { date: string; technicalWinnerTeamId?: number | null }) =>
        getMatchDisplayStatus(m.date, new Date(), m.technicalWinnerTeamId) !== 'upcoming'
        && m.technicalWinnerTeamId == null
    );
    expect(match).toBeTruthy();

    const res = await request(app).get(`/api/match-stats/${match.id}`);
    expect(res.status).toBe(200);
    expect(res.body.stats.possession.a + res.body.stats.possession.b).toBe(100);
    expect(res.body.stats.offsides.a).toBeLessThanOrEqual(2);
    expect(res.body.stats).not.toHaveProperty('yellowCards');
    expect(res.body.winChance.a + res.body.winChance.b).toBe(100);
  });

  it('GET /api/match-stats/:id returns 400 for invalid id', async () => {
    const res = await request(app).get('/api/match-stats/not-a-number');
    expect(res.status).toBe(400);
  });

  it('POST /api/match-stats/:id/regenerate requires admin', async () => {
    const matchesRes = await request(app).get('/api/matches');
    const { getMatchDisplayStatus } = await import('@ramadan-tournament/shared');
    const match = matchesRes.body.find(
      (m: { date: string; technicalWinnerTeamId?: number | null }) =>
        getMatchDisplayStatus(m.date, new Date(), m.technicalWinnerTeamId) !== 'upcoming'
        && m.technicalWinnerTeamId == null
    );
    expect(match).toBeTruthy();

    const denied = await request(app)
      .post(`/api/match-stats/${match.id}/regenerate`)
      .set('Origin', 'http://localhost:5173');
    expect(denied.status).toBe(404);

    const password = config.adminPassword || 'admin123';
    const login = await request(app)
      .post('/api/auth/login')
      .set('Origin', 'http://localhost:5173')
      .send({ username: config.adminUsername, password });
    expect(login.status).toBe(200);

    const ok = await request(app)
      .post(`/api/match-stats/${match.id}/regenerate`)
      .set('Origin', 'http://localhost:5173')
      .set('Cookie', login.headers['set-cookie']);
    expect(ok.status).toBe(200);
    expect(ok.body.stats.possession.a + ok.body.stats.possession.b).toBe(100);
  });
});
