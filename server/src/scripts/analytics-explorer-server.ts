import express, { type Request, type Response, type NextFunction } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { loadServerEnv } from '../config/loadServerEnv';
import { AnalyticsQueryService } from '../services/AnalyticsQueryService';

loadServerEnv();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(__dirname, '../../..');
const uiDistPath = path.join(repoRoot, 'tools', 'analytics-explorer', 'dist');

const HOST = process.env.ANALYTICS_EXPLORER_HOST || '127.0.0.1';
const PORT = parseInt(process.env.ANALYTICS_EXPLORER_PORT || '3847', 10);
const OPEN_BROWSER = process.argv.includes('--open');

function parseDate(value: unknown, fallback: Date): Date {
  if (typeof value !== 'string' || !value) return fallback;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? fallback : d;
}

function defaultRange(): { from: Date; to: Date } {
  const to = new Date();
  const from = new Date(to.getTime() - 7 * 24 * 60 * 60 * 1000);
  return { from, to };
}

function parseRange(req: Request): { from: Date; to: Date } {
  const defaults = defaultRange();
  return {
    from: parseDate(req.query.from, defaults.from),
    to: parseDate(req.query.to, defaults.to),
  };
}

function parseCategories(req: Request): string[] | undefined {
  const raw = req.query.categories;
  if (!raw) return undefined;
  if (typeof raw === 'string') return raw.split(',').map((s) => s.trim()).filter(Boolean);
  if (Array.isArray(raw)) return raw.map(String);
  return undefined;
}

function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    void fn(req, res, next).catch(next);
  };
}

function warnIfProductionDb(): void {
  const url = process.env.DATABASE_URL || '';
  if (url.includes('render.com') || url.includes('onrender.com')) {
    console.warn(
      '[analytics-explorer] Warning: DATABASE_URL appears to be production (Render). Read-only queries only.'
    );
  }
}

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    console.error(
      '[analytics-explorer] DATABASE_URL is required. Set it in server/.env and retry.'
    );
    process.exit(1);
  }

  warnIfProductionDb();

  const app = express();
  app.use(express.json());

  app.get('/api/health', asyncHandler(async (_req, res) => {
    try {
      await AnalyticsQueryService.buildSummary({
        ...defaultRange(),
      });
      res.json({ status: 'ok', database: 'postgres' });
    } catch (err) {
      res.status(500).json({ status: 'error', message: String(err) });
    }
  }));

  app.get('/api/summary', asyncHandler(async (req, res) => {
    const range = parseRange(req);
    const summary = await AnalyticsQueryService.buildSummary({
      ...range,
      categories: parseCategories(req),
    });
    res.json(summary);
  }));

  app.get('/api/process-map', asyncHandler(async (req, res) => {
    const range = parseRange(req);
    const minEdgeSessions = parseInt(String(req.query.minEdgeSessions || '1'), 10) || 1;
    const map = await AnalyticsQueryService.getProcessMap({
      ...range,
      categories: parseCategories(req),
      minEdgeSessions,
    });
    res.json(map);
  }));

  app.get('/api/performance', asyncHandler(async (req, res) => {
    const range = parseRange(req);
    const performance = await AnalyticsQueryService.getPerformanceSummary({
      ...range,
      categories: parseCategories(req),
    });
    res.json(performance);
  }));

  app.get('/api/variants', asyncHandler(async (req, res) => {
    const range = parseRange(req);
    const limit = parseInt(String(req.query.limit || '20'), 10) || 20;
    const variants = await AnalyticsQueryService.getVariants(
      { ...range, categories: parseCategories(req) },
      limit
    );
    res.json({ variants });
  }));

  app.get('/api/events', asyncHandler(async (req, res) => {
    const range = parseRange(req);
    const page = parseInt(String(req.query.page || '1'), 10) || 1;
    const pageSize = parseInt(String(req.query.pageSize || '50'), 10) || 50;
    const result = await AnalyticsQueryService.queryEventLog({
      ...range,
      categories: parseCategories(req),
      page,
      pageSize,
      eventName: typeof req.query.eventName === 'string' ? req.query.eventName : undefined,
      pathPrefix: typeof req.query.pathPrefix === 'string' ? req.query.pathPrefix : undefined,
      sessionId: typeof req.query.sessionId === 'string' ? req.query.sessionId : undefined,
      activityLabel:
        typeof req.query.activityLabel === 'string' ? req.query.activityLabel : undefined,
    });
    res.json(result);
  }));

  app.get('/api/sessions/:sessionId', asyncHandler(async (req, res) => {
    const range = parseRange(req);
    const trace = await AnalyticsQueryService.getSessionTrace(req.params.sessionId, {
      ...range,
      categories: parseCategories(req),
    });
    if (!trace) {
      res.status(404).json({ error: 'Session not found in range' });
      return;
    }
    res.json(trace);
  }));

  app.get('/api/export.csv', asyncHandler(async (req, res) => {
    const range = parseRange(req);
    const csv = await AnalyticsQueryService.exportCsv({
      ...range,
      categories: parseCategories(req),
    });
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="analytics_events.csv"');
    res.send(csv);
  }));

  if (fs.existsSync(uiDistPath)) {
    app.use(express.static(uiDistPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(uiDistPath, 'index.html'));
    });
  } else {
    app.get('/', (_req, res) => {
      res.type('text/plain').send(
        'Analytics explorer UI not built. Run: npm run build --workspace=analytics-explorer\n' +
          'Or use: npm run analytics:explorer:dev'
      );
    });
  }

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    console.error('[analytics-explorer]', err);
    res.status(500).json({ error: 'Internal server error' });
  });

  app.listen(PORT, HOST, () => {
    const url = `http://${HOST}:${PORT}`;
    console.info(`[analytics-explorer] ${url}`);
    if (!fs.existsSync(uiDistPath)) {
      console.info('[analytics-explorer] UI dist missing — API only until built.');
    }
    if (OPEN_BROWSER) {
      import('node:child_process').then(({ exec }) => {
        const cmd =
          process.platform === 'win32' ? `start "" "${url}"` : `open "${url}"`;
        exec(cmd);
      });
    }
  });
}

void main();
