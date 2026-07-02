import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { getAllowedOrigins, requireApiOrigin } from '../middleware/requireApiOrigin';
import analyticsRoutes from '../routes/analytics';
import { ingestClientEvents } from '../controllers/analyticsController';
import { errorHandler } from '../middleware/errorHandler';

const logSpy = vi.fn();

vi.mock('../services/AnalyticsService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/AnalyticsService')>();
  return {
    ...actual,
    AnalyticsService: {
      log: (...args: unknown[]) => logSpy(...args),
    },
  };
});

function createAnalyticsTestApp() {
  const app = express();
  const allowedOrigins = getAllowedOrigins();
  app.use(cors({ origin: allowedOrigins, credentials: true }));
  app.use(cookieParser());
  app.use(requireApiOrigin(allowedOrigins));
  app.use(express.json({ limit: '1mb' }));
  app.use('/api/analytics', analyticsRoutes);
  app.use(errorHandler);
  return app;
}

function createStrictRateLimitApp() {
  const app = express();
  const allowedOrigins = getAllowedOrigins();
  app.use(cors({ origin: allowedOrigins, credentials: true }));
  app.use(cookieParser());
  app.use(requireApiOrigin(allowedOrigins));
  app.use(express.json({ limit: '1mb' }));
  app.post(
    '/api/analytics/events',
    rateLimit({ windowMs: 60_000, max: 2, standardHeaders: true, legacyHeaders: false }),
    ingestClientEvents
  );
  app.use(errorHandler);
  return app;
}

const validSessionId = '11111111-1111-1111-1111-111111111111';
const origin = getAllowedOrigins()[0];

describe('POST /api/analytics/events', () => {
  beforeEach(() => {
    logSpy.mockClear();
  });

  it('returns 204 for a valid batch', async () => {
    const app = createAnalyticsTestApp();
    const res = await request(app)
      .post('/api/analytics/events')
      .set('Origin', origin)
      .send({
        sessionId: validSessionId,
        events: [
          {
            eventName: 'page_view',
            category: 'browse',
            path: '/teams',
          },
        ],
      });

    expect(res.status).toBe(204);
    expect(logSpy).toHaveBeenCalledTimes(1);
    expect(logSpy.mock.calls[0][0]).toMatchObject({
      eventName: 'page_view',
      category: 'browse',
      source: 'client',
      sessionId: validSessionId,
    });
  });

  it('returns 204 and accepts only valid events in a mixed batch', async () => {
    const app = createAnalyticsTestApp();
    const res = await request(app)
      .post('/api/analytics/events')
      .set('Origin', origin)
      .send({
        sessionId: validSessionId,
        events: [
          { eventName: 'page_view', category: 'browse', path: '/teams' },
          { eventName: 'not_real', category: 'browse' },
          { category: 'browse' },
        ],
      });

    expect(res.status).toBe(204);
    expect(logSpy).toHaveBeenCalledTimes(1);
    expect(logSpy.mock.calls[0][0]).toMatchObject({
      eventName: 'page_view',
      source: 'client',
    });
  });

  it('returns 404 for disallowed origin', async () => {
    const app = createAnalyticsTestApp();
    const res = await request(app)
      .post('/api/analytics/events')
      .set('Origin', 'https://evil.example')
      .send({
        sessionId: validSessionId,
        events: [{ eventName: 'page_view', category: 'browse' }],
      });

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Not found');
    expect(logSpy).not.toHaveBeenCalled();
  });

  it('returns 429 when rate limited', async () => {
    const app = createStrictRateLimitApp();
    const payload = {
      sessionId: validSessionId,
      events: [{ eventName: 'page_view', category: 'browse' }],
    };

    await request(app).post('/api/analytics/events').set('Origin', origin).send(payload);
    await request(app).post('/api/analytics/events').set('Origin', origin).send(payload);
    const res = await request(app).post('/api/analytics/events').set('Origin', origin).send(payload);

    expect(res.status).toBe(429);
  });

  it('returns 400 for invalid sessionId', async () => {
    const app = createAnalyticsTestApp();
    const res = await request(app)
      .post('/api/analytics/events')
      .set('Origin', origin)
      .send({
        sessionId: 'bad',
        events: [{ eventName: 'page_view', category: 'browse' }],
      });

    expect(res.status).toBe(400);
    expect(logSpy).not.toHaveBeenCalled();
  });

  it('returns 400 when no events are accepted', async () => {
    const app = createAnalyticsTestApp();
    const res = await request(app)
      .post('/api/analytics/events')
      .set('Origin', origin)
      .send({
        sessionId: validSessionId,
        events: [{ eventName: 'not_real', category: 'browse' }],
      });

    expect(res.status).toBe(400);
    expect(logSpy).not.toHaveBeenCalled();
  });

  it('returns 400 when batch exceeds 25 events', async () => {
    const app = createAnalyticsTestApp();
    const events = Array.from({ length: 26 }, () => ({
      eventName: 'page_view',
      category: 'browse',
    }));

    const res = await request(app)
      .post('/api/analytics/events')
      .set('Origin', origin)
      .send({ sessionId: validSessionId, events });

    expect(res.status).toBe(400);
    expect(logSpy).not.toHaveBeenCalled();
  });
});
