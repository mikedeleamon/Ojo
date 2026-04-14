import express, { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import axios from 'axios';
import dotenv from 'dotenv';
import path from 'path';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

import User from '../models/User';

dotenv.config();

const app = express();

const API_KEY  = process.env.ACCUWEATHER_API_KEY || '';
const AW_BASE  = process.env.ACCUWEATHER_BASE_URL || 'https://dataservice.accuweather.com';
const JWT_SECRET = process.env.JWT_SECRET || 'ojo-dev-secret-change-in-production';
const MONGO_URI  = process.env.MONGO_URI || '';

const originsEnv = process.env.CORS_ORIGINS || 'http://localhost:3000,http://localhost:3001';
const origins = originsEnv.split(',').map((s) => s.trim()).filter(Boolean);

app.use(cors({ origin: origins }));
app.use(express.json());

// ─── MongoDB ──────────────────────────────────────────────────────────────────
if (!MONGO_URI) {
  console.warn('[Ojo] Warning: MONGO_URI not set. DB routes will fail.');
} else {
  mongoose
    .connect(MONGO_URI)
    .then(() => console.log('[Ojo] Connected to MongoDB'))
    .catch((err) => console.warn('[Ojo] MongoDB unavailable:', err.message));
}

// ─── AccuWeather proxy guard ──────────────────────────────────────────────────
if (!API_KEY) {
  console.warn('[Ojo] Warning: ACCUWEATHER_API_KEY not set. Weather routes will return 500.');
}

const requireAccuKey = (_req: Request, res: Response, next: NextFunction) => {
  if (!API_KEY) return res.status(500).json({ error: 'Server misconfigured: ACCUWEATHER_API_KEY not set' });
  next();
};

app.use('/api/weather', requireAccuKey);

// ─── JWT auth middleware ──────────────────────────────────────────────────────
interface AuthRequest extends Request {
  userId?: string;
}

const requireAuth = (req: AuthRequest, res: Response, next: NextFunction) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header' });
  }
  try {
    const payload = jwt.verify(header.slice(7), JWT_SECRET) as { userId: string };
    req.userId = payload.userId;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

// ─── Auth routes ──────────────────────────────────────────────────────────────

// POST /api/auth/signup
app.post('/api/auth/signup', async (req: Request, res: Response) => {
  try {
    const { firstName, lastName, username, email, password, birthday } = req.body;

    if (!firstName || !lastName || !email || !password || !birthday) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(409).json({ error: 'An account with this email already exists' });
    }

    const hashed = await bcrypt.hash(password, 12);
    const user = await User.create({
      firstName, lastName, username, email, birthday,
      password: hashed,
    });

    const token = jwt.sign({ userId: user._id.toString() }, JWT_SECRET, { expiresIn: '7d' });

    res.status(201).json({
      token,
      user: {
        id:        user._id,
        firstName: user.firstName,
        lastName:  user.lastName,
        email:     user.email,
      },
      settings: user.settings,
    });
  } catch (err: any) {
    console.error('[Ojo] Signup failed:', err.message);
    res.status(500).json({ error: 'Signup failed', detail: err.message });
  }
});

// POST /api/auth/login
app.post('/api/auth/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = jwt.sign({ userId: user._id.toString() }, JWT_SECRET, { expiresIn: '7d' });

    res.json({
      token,
      user: {
        id:        user._id,
        firstName: user.firstName,
        lastName:  user.lastName,
        email:     user.email,
      },
      settings: user.settings,
    });
  } catch (err: any) {
    console.error('[Ojo] Login failed:', err.message);
    res.status(500).json({ error: 'Login failed', detail: err.message });
  }
});

// ─── User settings routes (JWT protected) ────────────────────────────────────

// GET /api/user/settings
app.get('/api/user/settings', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const user = await User.findById(req.userId).select('settings');
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user.settings);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to load settings', detail: err.message });
  }
});

// PUT /api/user/settings
app.put('/api/user/settings', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.userId,
      { $set: { settings: req.body } },
      { new: true, runValidators: true }
    ).select('settings');

    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user.settings);
  } catch (err: any) {
    console.error('[Ojo] Save settings failed:', err.message);
    res.status(500).json({ error: 'Failed to save settings', detail: err.message });
  }
});

// ─── User profile routes (JWT protected) ─────────────────────────────────────

// PUT /api/user/profile — update username and/or email
app.put('/api/user/profile', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { username, email } = req.body;
    if (!username && !email) {
      return res.status(400).json({ error: 'Provide at least one field to update' });
    }

    // Check email uniqueness if being changed
    if (email) {
      const conflict = await User.findOne({ email, _id: { $ne: req.userId } });
      if (conflict) return res.status(409).json({ error: 'Email is already in use' });
    }

    const update: Record<string, string> = {};
    if (username) update.username = username;
    if (email)    update.email    = email;

    const user = await User.findByIdAndUpdate(
      req.userId,
      { $set: update },
      { new: true, runValidators: true }
    ).select('firstName lastName email username');

    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ id: user._id, firstName: user.firstName, lastName: user.lastName, email: user.email, username: user.username });
  } catch (err: any) {
    console.error('[Ojo] Profile update failed:', err.message);
    res.status(500).json({ error: 'Profile update failed', detail: err.message });
  }
});

// PUT /api/user/password — set a new password (old password not required)
app.put('/api/user/password', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { newPassword } = req.body;
    if (!newPassword || newPassword.length < 8) {
      return res.status(400).json({ error: 'New password must be at least 8 characters' });
    }
    const hashed = await bcrypt.hash(newPassword, 12);
    await User.findByIdAndUpdate(req.userId, { $set: { password: hashed } });
    res.json({ message: 'Password updated successfully' });
  } catch (err: any) {
    console.error('[Ojo] Password update failed:', err.message);
    res.status(500).json({ error: 'Password update failed', detail: err.message });
  }
});

// GET /api/user/me — current user info
app.get('/api/user/me', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const user = await User.findById(req.userId).select('firstName lastName email username');
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ id: user._id, firstName: user.firstName, lastName: user.lastName, email: user.email, username: user.username });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to load user', detail: err.message });
  }
});

// ─── AccuWeather proxy routes ─────────────────────────────────────────────────
type CacheEntry = { data: any; expires: number };
const CITY_CACHE = new Map<string, CacheEntry>();
const CITY_CACHE_TTL = Number(process.env.CITY_CACHE_TTL_SECONDS || 600);

app.get('/api/weather/city', async (req: Request, res: Response) => {
  try {
    const q = String(req.query.q || '');
    const now = Date.now();
    const cached = CITY_CACHE.get(q);
    if (cached && cached.expires > now) return res.json(cached.data);

    const { data } = await axios.get(`${AW_BASE}/locations/v1/cities/geoposition/search`, {
      params: { apikey: API_KEY, q },
      timeout: 5000,
    });
    CITY_CACHE.set(q, { data, expires: now + CITY_CACHE_TTL * 1000 });
    res.json(data);
  } catch (err: any) {
    console.error('[Ojo] City lookup failed:', err.message);
    res.status(502).json({ error: 'City lookup failed', detail: err.message });
  }
});

app.get('/api/weather/current/:cityKey', async (req: Request, res: Response) => {
  try {
    const { data } = await axios.get(`${AW_BASE}/currentconditions/v1/${req.params.cityKey}`, {
      params: { apikey: API_KEY, details: true },
    });
    res.json(data);
  } catch (err: any) {
    console.error('[Ojo] Current weather failed:', err.message);
    res.status(502).json({ error: 'Current weather failed', detail: err.message });
  }
});

app.get('/api/weather/forecast/:cityKey', async (req: Request, res: Response) => {
  try {
    const { data } = await axios.get(`${AW_BASE}/forecasts/v1/hourly/12hour/${req.params.cityKey}`, {
      params: { apikey: API_KEY },
    });
    res.json(data);
  } catch (err: any) {
    console.error('[Ojo] Forecast failed:', err.message);
    res.status(502).json({ error: 'Forecast failed', detail: err.message });
  }
});

// ─── Health check ─────────────────────────────────────────────────────────────
app.get('/health', async (_req: Request, res: Response) => {
  const status: any = { uptime: process.uptime() };

  status.accuweather = { configured: !!API_KEY };
  if (API_KEY) {
    try {
      const r = await axios.get(`${AW_BASE}/locations/v1/cities/geoposition/search`, {
        params: { apikey: API_KEY, q: '40.7128,-74.0060' },
        timeout: 4000,
      });
      status.accuweather.ok = true;
      status.accuweather.sample = { key: r.data?.Key ?? null };
    } catch (e: any) {
      status.accuweather.ok = false;
      status.accuweather.error = e.message;
    }
  }

  status.mongodb = {
    configured: !!MONGO_URI,
    state: mongoose.connection.readyState, // 0 disconnected, 1 connected
  };

  res.json(status);
});

// ─── Serve React production build ────────────────────────────────────────────
const BUILD_DIR = path.join(__dirname, '../../build');
app.use(express.static(BUILD_DIR));
app.get('*', (_req: Request, res: Response) => {
  res.sendFile(path.join(BUILD_DIR, 'index.html'));
});

// ─── Start ────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`[Ojo] Server running on http://localhost:${PORT}`));
