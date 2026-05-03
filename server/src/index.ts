import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: path.join(__dirname, '../../.env') });

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { connectDB } from './db';
import authRoutes from './routes/auth';
import userRoutes from './routes/user';
import closetRoutes from './routes/closets';
import weatherRoutes from './routes/weather';
import notificationRoutes from './routes/notifications';
import { startNotificationService } from './services/notificationService';

const app = express();
const PORT = process.env.PORT ?? 4000;

// ─── CORS ─────────────────────────────────────────────────────────────────────
// In production set ALLOWED_ORIGIN to the hosted server/CDN URL.
// In development it falls back to allowing any localhost origin.
const allowedOrigin = process.env.ALLOWED_ORIGIN;
app.use(cors({
  origin: allowedOrigin
    ? allowedOrigin
    : (origin, cb) => {
        // Allow requests with no origin (mobile apps) or any localhost port
        if (!origin || /^http:\/\/localhost(:\d+)?$/.test(origin)) {
          cb(null, true);
        } else {
          cb(new Error('Not allowed by CORS'));
        }
      },
  credentials: true,
}));

// ─── Rate limiting ────────────────────────────────────────────────────────────
// Tight limit on auth to slow brute-force; looser on other routes.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
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
app.use('/api/auth',          authLimiter,    authRoutes);
app.use('/api/weather',       weatherLimiter, weatherRoutes);
app.use('/api/user',          generalLimiter, userRoutes);
app.use('/api/closets',       generalLimiter, closetRoutes);
app.use('/api/notifications', generalLimiter, notificationRoutes);

// ─── Global error handler ─────────────────────────────────────────────────────
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

connectDB().then(() => {
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  startNotificationService();
}).catch((err) => {
  console.error('Failed to connect to MongoDB:', err);
  process.exit(1);
});
