import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { connectDatabase } from './config/database';
import { config, worldCupStandalone } from './config/env';
import { errorHandler } from './middleware/errorHandler';

// Routes
import authRoutes from './routes/auth';
import teamRoutes from './routes/teams';
import matchRoutes from './routes/matches';
import newsRoutes from './routes/news';
import statsRoutes from './routes/stats';
import adminRoutes from './routes/admin';
import commentRoutes from './routes/comments';
import seasonsRoutes from './routes/seasons';
import { pingRedis } from './config/redis';
import playerRoutes from './routes/player';
import voteRoutes from './routes/votes';
import archiveRoutes from './routes/archive';
import statsGirlsRoutes from './routes/statsGirls';
import worldcupRoutes from './routes/worldcup';
import { setGirlsDivision } from './middleware/tournamentDivision';
import path from 'path';

const app = express();

// Trust proxy (Render/Vercel)
app.set('trust proxy', 1);

// Security headers
app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' }
}));

// CORS
app.use(cors({
    origin: [
        'http://localhost:5173',
        'http://localhost:3000',
        'https://ramadan-tournament-client.vercel.app'
    ],
    credentials: true
}));
app.use(express.json({ limit: '1mb' }));

app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));
// Fallback: also serve public/ for any files written there historically
app.use(express.static(path.join(process.cwd(), 'public')));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
});
app.use('/api/auth', limiter);
app.use('/api/players', limiter); // Rate limit player auth too

import userRoutes from './routes/users';
import { registerMockRoutes } from './mock/registerMockRoutes';

type ApiMode = 'mock' | 'full' | 'worldcup-only';

function mountWorldCupOnlyRoutes(): void {
    app.get('/api/health', (_req, res) => {
        res.json({
            status: 'ok',
            mode: 'worldcup-only',
            database: 'skipped',
            redis: config.redisUrl ? 'optional' : 'memory-cache',
            timestamp: new Date().toISOString(),
        });
    });
    app.use('/api/worldcup', worldcupRoutes);
}

function mountApiRoutes(mode: ApiMode): void {
    if (mode === 'mock') {
        registerMockRoutes(app);
        return;
    }

    if (mode === 'worldcup-only') {
        mountWorldCupOnlyRoutes();
        return;
    }

    app.get('/api/health', async (req, res) => {
        const redisOk = process.env.REDIS_URL ? await pingRedis() : null;
        res.json({
            status: 'ok',
            database: 'postgres',
            redis: redisOk === null ? 'disabled' : redisOk ? 'ok' : 'error',
            timestamp: new Date().toISOString(),
        });
    });

    app.use('/api/auth', authRoutes);
    app.use('/api/users', userRoutes);
    app.use('/api/teams', teamRoutes);
    app.use('/api/teams-girls', setGirlsDivision, teamRoutes);
    app.use('/api/matches', matchRoutes);
    app.use('/api/news', newsRoutes);
    app.use('/api/news-girls', setGirlsDivision, newsRoutes);
    app.use('/api/stats', statsRoutes);
    app.use('/api/stats-girls', statsGirlsRoutes);
    app.use('/api/admin', adminRoutes);
    app.use('/api/comments', commentRoutes);
    app.use('/api/seasons', seasonsRoutes);
    app.use('/api/players', playerRoutes);
    app.use('/api/votes', voteRoutes);
    app.use('/api/votes-girls', setGirlsDivision, voteRoutes);
    app.use('/api/archive', archiveRoutes);
    if (config.worldCupEnabled) {
        app.use('/api/worldcup', worldcupRoutes);
    }
}

// Start server
const startServer = async () => {
    try {
        let apiMode: ApiMode = 'full';

        if (config.mockDevData) {
            apiMode = 'mock';
        } else if (worldCupStandalone) {
            apiMode = 'worldcup-only';
        } else {
            try {
                await connectDatabase();
            } catch (dbError) {
                if (config.worldCupEnabled) {
                    console.warn(
                        'Postgres unavailable — starting World Cup only mode:',
                        dbError instanceof Error ? dbError.message : dbError,
                    );
                    apiMode = 'worldcup-only';
                } else {
                    throw dbError;
                }
            }
        }

        console.log(
            `API mode: ${apiMode} (WORLD_CUP_ENABLED=${config.worldCupEnabled}, WORLD_CUP_ONLY=${config.worldCupOnly}, DATABASE_URL=${config.databaseUrl ? 'set' : 'unset'})`,
        );

        mountApiRoutes(apiMode);
        app.use(errorHandler);

        app.listen(config.port, () => {
            console.log(`Server running on port ${config.port}`);
            const mode =
                apiMode === 'mock'
                    ? ' (mock data)'
                    : apiMode === 'worldcup-only'
                      ? ' (world cup only — no Postgres)'
                      : '';
            console.log(`Environment: ${config.nodeEnv}${mode}`);
        });
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
};

startServer();

