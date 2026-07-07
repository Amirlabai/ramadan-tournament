import express from 'express';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import type { Express } from 'express';
import cookieParser from 'cookie-parser';
import { createTestApp } from '../test/createTestApp';
import { config } from '../config/env';
import { PLAYER_COOKIE, SESSION_COOKIE } from '../utils/authCookie';
import { requirePlatformAdmin } from './auth';
import matchRoutes from '../routes/matches';

const validSessionId = '11111111-1111-1111-1111-111111111111';
const matchPayload = { homeTeamId: 1, awayTeamId: 2, date: '2026-03-01T20:00:00Z' };

function createMatchesConcealApp(): Express {
  const app = express();
  app.use(cookieParser());
  app.use(express.json());
  app.use('/api/matches', matchRoutes);
  return app;
}

describe('auth concealment (404 for forbidden admin resources)', () => {
  let app: Express;
  let matchesApp: Express;

  beforeAll(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'debug').mockImplementation(() => {});
    app = createTestApp();
    matchesApp = createMatchesConcealApp();
  });

  it('returns 404 for unauthenticated admin API probe', async () => {
    const res = await request(app).get('/api/admin/banned-words');
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Not found');
  });

  it('returns 404 for authenticated non-admin on admin API', async () => {
    const token = jwt.sign({ userId: 'regular-user' }, config.jwtSecret);
    const res = await request(app)
      .get('/api/admin/banned-words')
      .set('Cookie', `${SESSION_COOKIE}=${token}`);

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Not found');
  });

  it('returns 404 for player JWT on admin API', async () => {
    const token = jwt.sign(
      { userId: 'player-1', isPlayer: true, memberId: 1, teamId: 1 },
      config.jwtSecret
    );
    const res = await request(app)
      .get('/api/admin/banned-words')
      .set('Cookie', `${PLAYER_COOKIE}=${token}`);

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Not found');
  });

  it('returns 404 for expired JWT on admin API', async () => {
    const token = jwt.sign({ userId: 'regular-user' }, config.jwtSecret, { expiresIn: '-1s' });
    const res = await request(app)
      .get('/api/admin/banned-words')
      .set('Cookie', `${SESSION_COOKIE}=${token}`);

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Not found');
  });

  it('returns 404 for mutating request with session cookie but no Origin or Referer', async () => {
    const token = jwt.sign({ userId: 'regular-user' }, config.jwtSecret);
    const res = await request(app)
      .post('/api/analytics/events')
      .set('Cookie', `${SESSION_COOKIE}=${token}`)
      .send({
        sessionId: validSessionId,
        events: [{ eventName: 'page_view', category: 'browse' }],
      });

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Not found');
  });

  it('returns 404 for unauthenticated match admin mutation probe', async () => {
    const res = await request(matchesApp).post('/api/matches').send(matchPayload);

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Not found');
  });

  it('returns 404 for authenticated non-admin on match admin mutation', async () => {
    const token = jwt.sign({ userId: 'regular-user' }, config.jwtSecret);
    const res = await request(matchesApp)
      .post('/api/matches')
      .set('Cookie', `${SESSION_COOKIE}=${token}`)
      .send(matchPayload);

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Not found');
  });

  it('returns 404 for player JWT on match admin mutation', async () => {
    const token = jwt.sign(
      { userId: 'player-1', isPlayer: true, memberId: 1, teamId: 1 },
      config.jwtSecret
    );
    const res = await request(matchesApp)
      .post('/api/matches')
      .set('Cookie', `${PLAYER_COOKIE}=${token}`)
      .send(matchPayload);

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Not found');
  });

  it('returns 401 for unauthenticated session check on /api/auth/me', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('נדרשת התחברות');
  });

  it('allows platform admin through requirePlatformAdmin', async () => {
    const adminApp = express();
    adminApp.use(cookieParser());
    adminApp.get('/api/admin/probe', requirePlatformAdmin, (_req, res) => {
      res.json({ ok: true });
    });

    const password = config.adminPassword || 'admin123';
    const loginRes = await request(app)
      .post('/api/auth/login')
      .set('Origin', 'http://localhost:5173')
      .send({ username: config.adminUsername, password });

    const cookie = loginRes.headers['set-cookie'];
    expect(loginRes.status).toBe(200);

    const res = await request(adminApp)
      .get('/api/admin/probe')
      .set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });
});
