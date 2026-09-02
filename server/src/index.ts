import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: path.join(__dirname, '../../.env') });

// Must stay here: after dotenv (it reads SENTRY_DSN) and before express,
// mongoose, and the routes, so Sentry can instrument them as they load.
// tsconfig targets commonjs, so this emitted require() runs in source order.
import './instrument';

import * as Sentry from '@sentry/node';
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
import tripsRoutes from './routes/trips';
import tripFitRoutes from './routes/tripfit';
import shareRoutes from './routes/share';
import resetRoutes from './routes/reset';
import { requireAuth, requireAgeVerified, AuthRequest } from './middleware/auth';
import { startNotificationService } from './services/notificationService';
import { weatherStats, resetWeatherStats } from './lib/weatherKit';

const app = express();
app.disable('x-powered-by');
// Railway (and most PaaS) put a reverse proxy in front of the app, so the real
// client IP arrives in X-Forwarded-For. Trust the first proxy hop so
// express-rate-limit keys on the actual client IP instead of lumping every
// user into a single shared bucket (which would throttle legitimate traffic).
app.set('trust proxy', 1);
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
    // Railway injects these at build time from the triggering commit. Ground
    // truth for "what did Railway actually build," independent of whatever
    // the dashboard's deployment list claims — added while chasing a deploy
    // that looked ACTIVE on a fresh commit but kept serving old route
    // behavior. undefined (not Railway, or an older build pre-dating this
    // field) prints as null rather than throwing.
    gitCommit: process.env.RAILWAY_GIT_COMMIT_SHA ?? null,
    gitCommitMessage: process.env.RAILWAY_GIT_COMMIT_MESSAGE ?? null,
    uptimeSeconds: Math.round(process.uptime()),
    db: DB_STATE[mongoose.connection.readyState] ?? 'unknown',
    dbName: mongoose.connection.name ?? 'unknown',
    memory: {
      rssMb: Math.round(mem.rss / 1024 / 1024),
      heapUsedMb: Math.round(mem.heapUsed / 1024 / 1024),
    },
    // Read-only peek at the WeatherKit counters. Deliberately does NOT reset
    // them — that's owned by the periodic logger, and resetting here would
    // corrupt the per-interval numbers whenever a monitor polls /health.
    weather: weatherStats(),
    timestamp: new Date().toISOString(),
  });
});

// ─── CORS ─────────────────────────────────────────────────────────────────────
// CORS is a browser-only mechanism. Native mobile clients (our primary caller),
// curl, and server-to-server requests send NO Origin header and must always be
// allowed — they are not subject to the same-origin policy at all. Only browser
// requests that DO carry an Origin header are checked against the allowlist.
//
// ALLOWED_ORIGIN (optional) is the web origin permitted in production, e.g.
// https://www.ojoapp.io. Localhost origins are permitted only outside prod.
const allowedOrigin = process.env.ALLOWED_ORIGIN;
app.use(cors({
  origin: (origin, cb) => {
    // No Origin header → native app / curl / server-to-server. CORS does not
    // apply; always allow. (This is what unblocks the iOS/Android app.)
    if (!origin) return cb(null, true);
    // Browser request with an Origin: enforce the allowlist.
    if (allowedOrigin && origin === allowedOrigin) return cb(null, true);
    if (!IS_PROD && /^http:\/\/localhost(:\d+)?$/.test(origin)) return cb(null, true);
    return cb(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));

// ─── Rate limiting ────────────────────────────────────────────────────────────
// Two families of limiter, and the difference matters more than the numbers.
//
// PRE-AUTH routes (/api/auth, and the public /s and /r landing pages) are keyed
// by IP, because there is no account yet to key on.
//
// AUTHENTICATED routes are keyed by USER. IP is the wrong key for a mobile app:
// carriers put very large numbers of subscribers behind a single CGNAT egress
// address, so an IP-keyed budget is silently shared between strangers on the
// same network. One heavy user — or one coffee shop, office, or university —
// could exhaust the allowance for everyone behind that address, and the
// resulting 429s are close to undebuggable from the outside. Keying on the
// authenticated user makes each number mean what it appears to mean: a budget
// per account, per window.
//
// This is what makes it safe to set the authenticated ceilings generously
// below, which an IP-keyed limiter could not be.
const keyByUser = (req: Request): string => (req as AuthRequest).userId ?? req.ip ?? 'unknown';

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

// Viewing one city costs THREE requests today — WeatherHUD fetches /current,
// /hourly and /daily in a Promise.all — so the old 30/min ceiling was really
// "ten city switches a minute", which the Locations screen can exhaust just by
// being scrolled through at a normal pace.
//
// 120/min is ~40 city views per minute, comfortably past the rate a person can
// tap. It is affordable because these requests are nearly free to serve: every
// one of them is answered from the coalesced L1/L2 bundle cache in
// lib/weatherKit.ts, snapped onto a shared coordinate grid, and only a genuine
// cache miss costs a billable WeatherKit call. The thing that protects the
// upstream bill is the 30-minute cache TTL, not this limiter — this limiter
// exists to bound server CPU, and 120 cached slices a minute is not a load.
const weatherLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 120,
  keyGenerator: keyByUser,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});

// 600 per 15 min ≈ 40/min sustained. The old 200 worked out at ~13/min shared
// across every route under it, which a closet sync of any size can spend in a
// burst — reconciling a large wardrobe issues one request per article.
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 600,
  keyGenerator: keyByUser,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});

/**
 * IP-keyed limiter for the public landing pages, which have no user to key on.
 * Unchanged in spirit from the old generalLimiter: these routes do no database
 * work, so this is about bounding abuse volume rather than protecting a lookup.
 */
const publicLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});

// ─── Body parsing ─────────────────────────────────────────────────────────────
// A 10mb ceiling used to apply to EVERY route, which meant an unauthenticated
// caller could push 10MB at /api/auth/login (50x per 15 min per IP, and failed
// auth is the only thing that burns that quota) — a lot of parser work for a
// request whose legitimate body is a couple of hundred bytes.
//
// Only one endpoint has any business receiving a large body: the base64 image
// upload. It gets the big parser; everything else gets a limit sized for JSON
// settings payloads. Matched on an explicit path pattern rather than mounting
// inside the router, because the first json() to run is the one that enforces a
// limit — a large parser mounted later never gets the chance to say yes.
const UPLOAD_PATH = /^\/api\/closets\/[^/]+\/upload-image\/?$/;
const uploadJson = express.json({ limit: '10mb' });
const standardJson = express.json({ limit: '100kb' });
app.use((req, res, next) =>
  UPLOAD_PATH.test(req.path) ? uploadJson(req, res, next) : standardJson(req, res, next));

// ─── Routes ───────────────────────────────────────────────────────────────────
// /api/auth/refresh has its own (looser) limiter applied inside auth.ts;
// everything else under /api/auth (login, signup, forgot-password,
// reset-password) goes through the tighter authLimiter that only counts
// failed requests so a legitimate sign-in never burns quota.
app.use('/api/auth', (req, res, next) => {
  if (req.path === '/refresh') return refreshLimiter(req, res, next);
  return authLimiter(req, res, next);
}, authRoutes);
// Everything that stores or returns personal data sits behind the minimum-age
// gate. requireAuth is mounted here so requireAgeVerified has a resolved
// account to read; it is idempotent, so the routers that also mount it
// internally don't pay for a second lookup.
//
// /api/user and /api/auth are intentionally NOT gated — an unverified user
// still needs to reach POST /api/auth/verify-age to escape the state, and to
// view or delete their account if they'd rather not supply a date of birth.
const gated = [requireAuth, requireAgeVerified];

//
// ORDERING: the limiter is mounted AFTER the auth middleware on every
// authenticated router, not before it. keyByUser reads `req.userId`, which
// requireAuth is what sets — with the old ordering (limiter first) that field
// was always undefined and every one of these limiters would silently fall back
// to keying by IP, which is the exact behaviour being fixed.
//
// Putting auth first costs nothing against an unauthenticated flood: requireAuth
// rejects a missing or malformed Authorization header outright, and a bad
// signature fails in verifyToken. Only a validly-signed token reaches the
// database lookup, so there is no cheap way to make this path expensive.
//
// requireAuth is idempotent (it returns early when req.userId is already set),
// so the routers that also mount it internally don't pay for a second lookup.
app.use('/api/weather',       ...gated, weatherLimiter, weatherRoutes);
// /api/user takes requireAuth but NOT the age gate — an unverified account must
// still be able to read its profile or delete itself (see the note above).
app.use('/api/user',          requireAuth, generalLimiter, userRoutes);
app.use('/api/closets',       ...gated, generalLimiter, closetRoutes);
app.use('/api/notifications', ...gated, generalLimiter, notificationRoutes);
app.use('/api/history',       ...gated, generalLimiter, historyRoutes);
app.use('/api/trips',         ...gated, generalLimiter, tripsRoutes);
app.use('/api/tripfit',       ...gated, generalLimiter, tripFitRoutes);
// Public pages: no user to key on, so these stay IP-keyed.
app.use('/s',                 publicLimiter, shareRoutes);
// Public https landing page for the password-reset email. Rate limited like the
// other public pages; it does no database work, so this is about abuse volume
// rather than protecting a lookup.
app.use('/r',                 publicLimiter, resetRoutes);

// ─── Global error handler ─────────────────────────────────────────────────────
// Sentry's handler goes first: it reports the error and calls next(), so ours
// still runs and still owns the response shape clients see. No-ops when
// SENTRY_DSN is unset.
Sentry.setupExpressErrorHandler(app);

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

// ─── Memory + WeatherKit telemetry ────────────────────────────────────────────
// Periodic log line so Railway's log view shows real RSS/heap growth over time.
// This is the data to base tier-upgrade decisions on: sustained RSS climbing
// toward your instance's RAM ceiling (or OOM restarts) is the true upgrade
// signal, not raw user count. Interval is unref'd so it never keeps the process
// alive on its own.
//
// The [weather] line rides the same cadence. `upstream` is the only counter that
// costs money (WeatherKit bills per HTTP request); `hits` and `coalesced` are
// requests that were served without one. Counters reset after each emit, so the
// numbers are per-interval, not cumulative.
function startMemoryLogging(intervalMs = 15 * 60 * 1000): void {
  const log = () => {
    const mem = process.memoryUsage();
    console.log(
      `[mem] rss=${Math.round(mem.rss / 1024 / 1024)}MB ` +
      `heapUsed=${Math.round(mem.heapUsed / 1024 / 1024)}MB ` +
      `uptime=${Math.round(process.uptime())}s`
    );

    const w = weatherStats();
    console.log(
      `[weather] upstream=${w.upstreamCalls} l1=${w.l1Hits} l2=${w.l2Hits} ` +
      `coalesced=${w.coalesced} windowMins=${Math.round(intervalMs / 60000)}`
    );
    resetWeatherStats();
  };
  log(); // emit once at boot for a baseline
  setInterval(log, intervalMs).unref();
}

connectDB().then(() => {
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  startNotificationService();
  startMemoryLogging();
}).catch(async (err) => {
  console.error('Failed to connect to MongoDB:', err);
  // "The API never came up" is the one alert worth waking up for, and it's the
  // one Sentry would otherwise miss: this rejection is caught, so it never
  // reaches the unhandled-rejection integration. flush() before exiting or the
  // event dies with the process.
  Sentry.captureException(err, { tags: { phase: 'boot' } });
  await Sentry.flush(2000).catch(() => {});
  process.exit(1);
});
