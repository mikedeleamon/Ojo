import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: path.join(__dirname, '../../.env') });

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import mongoose from 'mongoose';
import { connectDB } from './db';
import authRoutes from './routes/auth';
import userRoutes from './routes/user';
import closetRoutes from './routes/closets';
import weatherRoutes from './routes/weather';
import notificationRoutes from './routes/notifications';
import historyRoutes from './routes/history';
import preferencesRoutes from './routes/preferences';
import tripsRoutes from './routes/trips';
import { startNotificationService } from './services/notificationService';

const app = express();
app.disable('x-powered-by');
const PORT = process.env.PORT ?? 4000;
const IS_PROD = process.env.NODE_ENV === 'production';

// ─── Health check ─────────────────────────────────────────────────────────────
// Declared before CORS + rate limiters so it is never throttled or origin-gated.
// Used by Railway's healthcheck, uptime monitors, and App Review (a reviewer
// hitting a dead server = rejection). Always returns 200 while the process is
// alive; DB reachability is reported in the body rather than failing the check,
// so a transient Mongo blip doesn't take the whole instance out of rotation.
const DB_STATE = ['disconnected', 'connected', 'connecting', 'disconnecting'];
app.get('/health', (_req: Request, res: Response) => {
  const mem = process.memoryUsage();
  res.json({
    status: 'ok',
    uptimeSeconds: Math.round(process.uptime()),
    db: DB_STATE[mongoose.connection.readyState] ?? 'unknown',
    memory: {
      rssMb: Math.round(mem.rss / 1024 / 1024),
      heapUsedMb: Math.round(mem.heapUsed / 1024 / 1024),
    },
    timestamp: new Date().toISOString(),
  });
});

// ─── CORS ─────────────────────────────────────────────────────────────────────
// In production ALLOWED_ORIGIN must be set. The permissive localhost fallback
// is gated behind NODE_ENV !== 'production' so a missing env var in prod fails
// closed rather than silently allowing all no-origin callers.
const allowedOrigin = process.env.ALLOWED_ORIGIN;
app.use(cors({
  origin: allowedOrigin
    ? allowedOrigin
    : (origin, cb) => {
        if (IS_PROD) {
          cb(new Error('Not allowed by CORS'));
          return;
        }
        // Dev only: allow requests with no origin (mobile apps) or any localhost port
        if (!origin || /^http:\/\/localhost(:\d+)?$/.test(origin)) {
          cb(null, true);
        } else {
          cb(new Error('Not allowed by CORS'));
        }
      },
  credentials: true,
}));

// ─── Rate limiting ────────────────────────────────────────────────────────────
// Tight limit on auth to slow brute-force, but only failed attempts count so
// legitimate sign-ins never burn quota. Refresh has its own (looser) limiter
// since the client may call it on every cold start.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // 2xx responses don't count toward the limit
  message: { error: 'Too many requests, please try again later.' },
});

const refreshLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});

const weatherLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});

const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});

// ─── Body parsing ─────────────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));

// ─── Routes ───────────────────────────────────────────────────────────────────
// /api/auth/refresh has its own (looser) limiter applied inside auth.ts;
// everything else under /api/auth (login, signup, forgot-password,
// reset-password) goes through the tighter authLimiter that only counts
// failed requests so a legitimate sign-in never burns quota.
app.use('/api/auth', (req, res, next) => {
  if (req.path === '/refresh') return refreshLimiter(req, res, next);
  return authLimiter(req, res, next);
}, authRoutes);
app.use('/api/weather',       weatherLimiter, weatherRoutes);
app.use('/api/user',          generalLimiter, userRoutes);
app.use('/api/closets',       generalLimiter, closetRoutes);
app.use('/api/notifications', generalLimiter, notificationRoutes);
app.use('/api/history',       generalLimiter, historyRoutes);
app.use('/api/preferences',   generalLimiter, preferencesRoutes);
app.use('/api/trips',         generalLimiter, tripsRoutes);

// ─── Global error handler ─────────────────────────────────────────────────────
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

// ─── Memory telemetry ─────────────────────────────────────────────────────────
// Periodic log line so Railway's log view shows real RSS/heap growth over time.
// This is the data to base tier-upgrade decisions on: sustained RSS climbing
// toward your instance's RAM ceiling (or OOM restarts) is the true upgrade
// signal, not raw user count. Interval is unref'd so it never keeps the process
// alive on its own.
function startMemoryLogging(intervalMs = 15 * 60 * 1000): void {
  const log = () => {
    const mem = process.memoryUsage();
    console.log(
      `[mem] rss=${Math.round(mem.rss / 1024 / 1024)}MB ` +
      `heapUsed=${Math.round(mem.heapUsed / 1024 / 1024)}MB ` +
      `uptime=${Math.round(process.uptime())}s`
    );
  };
  log(); // emit once at boot for a baseline
  setInterval(log, intervalMs).unref();
}

connectDB().then(() => {
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  startNotificationService();
  startMemoryLogging();
}).catch((err) => {
  console.error('Failed to connect to MongoDB:', err);
  process.exit(1);
});
