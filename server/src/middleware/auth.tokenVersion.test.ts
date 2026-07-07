import express from 'express';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { authenticate } from './auth';
import { SESSION_COOKIE } from '../utils/authCookie';

const mockFindById = vi.fn();

vi.mock('../models/User', () => ({
  User: {
    findById: (...args: unknown[]) => mockFindById(...args),
  },
}));

vi.mock('../config/env', () => ({
  config: {
    jwtSecret: 'test-token-version-secret',
    mockDevData: false,
  },
}));

describe('authenticate tokenVersion', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when JWT tokenVersion is stale after password reset', async () => {
    const app = express();
    app.use(cookieParser());
    app.get('/api/protected', authenticate, (_req, res) => {
      res.json({ ok: true });
    });

    const userId = 'user-stale-session';
    const token = jwt.sign({ userId, tokenVersion: 0 }, 'test-token-version-secret');
    mockFindById.mockResolvedValue({ id: userId, tokenVersion: 1, role: 'User' });

    const res = await request(app)
      .get('/api/protected')
      .set('Cookie', `${SESSION_COOKIE}=${token}`);

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('ההתחברות פגה או אינה תקינה');
    expect(mockFindById).toHaveBeenCalledWith(userId);
  });

  it('allows request when JWT tokenVersion matches user record', async () => {
    const app = express();
    app.use(cookieParser());
    app.get('/api/protected', authenticate, (_req, res) => {
      res.json({ ok: true });
    });

    const userId = 'user-valid-session';
    const token = jwt.sign({ userId, tokenVersion: 2 }, 'test-token-version-secret');
    mockFindById.mockResolvedValue({ id: userId, tokenVersion: 2, role: 'User' });

    const res = await request(app)
      .get('/api/protected')
      .set('Cookie', `${SESSION_COOKIE}=${token}`);

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });
});
