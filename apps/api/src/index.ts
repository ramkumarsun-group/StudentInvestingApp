import './config/env';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { env } from './config/env';
import { logger } from './config/logger';
import { checkDbConnection } from './config/db';
import { checkRedisConnection } from './config/redis';
import apiRoutes from './routes/index';
import './jobs/index';

const app = express();

// ─── Security ─────────────────────────────────────────────────────────────────
app.use(helmet());
app.use(cors({ origin: env.WEB_URL, credentials: true }));
app.use(compression());
app.use(cookieParser());

// Raw body for Stripe webhooks (must be before json parser)
app.use('/api/v1/subscriptions/webhook', express.raw({ type: 'application/json' }));

app.use(express.json({ limit: '10mb' }));

// ─── Rate limiting ────────────────────────────────────────────────────────────
const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later' },
});

const marketLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  message: { error: 'Market data rate limit exceeded' },
});

app.use('/api/v1', globalLimiter);
app.use('/api/v1/market', marketLimiter);

// ─── Health ───────────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ─── API Routes ───────────────────────────────────────────────────────────────
app.use('/api/v1', apiRoutes);

// ─── Error handler ────────────────────────────────────────────────────────────
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error('Unhandled error', { message: err.message, stack: err.stack });
  res.status(500).json({ error: 'Internal server error' });
});

// ─── Startup ──────────────────────────────────────────────────────────────────
async function start() {
  await checkDbConnection();
  logger.info('✅ PostgreSQL connected');

  await checkRedisConnection();
  logger.info('✅ Redis connected');

  app.listen(env.API_PORT, () => {
    logger.info(`🚀 API server running on port ${env.API_PORT}`);
  });
}

start().catch((err) => {
  logger.error('Failed to start server', { err });
  process.exit(1);
});
