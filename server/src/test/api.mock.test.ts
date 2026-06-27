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
});
