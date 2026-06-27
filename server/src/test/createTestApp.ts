import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { registerMockRoutes } from '../mock/registerMockRoutes';
import { errorHandler } from '../middleware/errorHandler';
import { getAllowedOrigins, requireApiOrigin } from '../middleware/requireApiOrigin';

/** Express app in mock mode — no Postgres or Redis required. */
export function createTestApp(): express.Express {
  const app = express();
  app.set('trust proxy', 1);
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );
  const allowedOrigins = getAllowedOrigins();
  app.use(cors({ origin: allowedOrigins, credentials: true }));
  app.use(cookieParser());
  app.use(requireApiOrigin(allowedOrigins));
  app.use(express.json({ limit: '1mb' }));
  registerMockRoutes(app);
  app.use(errorHandler);
  return app;
}
