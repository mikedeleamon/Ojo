import express, { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import axios from 'axios';
import dotenv from 'dotenv';
import path from 'path';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';

import User from '../models/User';
import Closet from '../models/Closet';

dotenv.config();

const app = express();

const API_KEY  = process.env.ACCUWEATHER_API_KEY || '';
const AW_BASE  = process.env.ACCUWEATHER_BASE_URL || 'https://dataservice.accuweather.com';
const MONGO_URI  = process.env.MONGO_URI || '';

// ─── JWT secret — hard-fail at startup if not set in production ───────────────
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET && process.env.NODE_ENV === 'production') {
  console.error('[Ojo] FATAL: JWT_SECRET env var is required in production.');
  process.exit(1);
}
const JWT_SECRET_RESOLVED = JWT_SECRET || 'ojo-dev-secret-change-in-production';

const originsEnv = process.env.CORS_ORIGINS || 'http://localhost:3000,http://localhost:3001,http://localhost:4000';
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

// ─── Rate limiting ────────────────────────────────────────────────────────────
// Tight limit on auth endpoints to prevent brute-force attacks
const authLimiter = rateLimit({
  windowMs:         15 * 60 * 1000, // 15 minutes
  max:              20,              // 20 attempts per window per IP
  standardHeaders:  true,
  legacyHeaders:    false,
  message:          { error: 'Too many attempts. Please try again in 15 minutes.' },
});

// General API limit — prevents scraping and abuse
const apiLimiter = rateLimit({
  windowMs:         15 * 60 * 1000,
  max:              300,
  standardHeaders:  true,
  legacyHeaders:    false,
  message:          { error: 'Too many requests. Please slow down.' },
});

app.use('/api/auth', authLimiter);
app.use('/api',      apiLimiter);

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
    const payload = jwt.verify(header.slice(7), JWT_SECRET_RESOLVED) as { userId: string };
    req.userId = payload.userId;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

// ─── Auth helpers ─────────────────────────────────────────────────────────────

/** Returns age in fractional years from a birthday string or Date. */
const getAge = (birthday: string | Date): number => {
  const dob = new Date(birthday);
  if (isNaN(dob.getTime())) return -1;
  return (Date.now() - dob.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
};

// ─── Auth routes ──────────────────────────────────────────────────────────────

// POST /api/auth/signup
app.post('/api/auth/signup', async (req: Request, res: Response) => {
  try {
    const { firstName, lastName, username, email, password, birthday } = req.body;

    if (!firstName || !lastName || !email || !password || !birthday) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    // COPPA — users must be 13 or older
    const age = getAge(birthday);
    if (age < 0) {
      return res.status(400).json({ error: 'Please enter a valid date of birth.' });
    }
    if (age < 13) {
      return res.status(400).json({ error: 'You must be 13 or older to use Ojo.' });
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

    const token = jwt.sign({ userId: user._id.toString() }, JWT_SECRET_RESOLVED, { expiresIn: '7d' });

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

// POST /api/auth/login — accepts email address OR @username
app.post('/api/auth/login', async (req: Request, res: Response) => {
  try {
    const { identifier, password } = req.body;
    if (!identifier || !password) {
      return res.status(400).json({ error: 'Email/username and password are required.' });
    }

    const isEmail = /\S+@\S+\.\S+/.test(identifier.trim());
    const user = isEmail
      ? await User.findOne({ email: identifier.toLowerCase().trim() })
      : await User.findOne({ username: identifier.trim() });

    if (!user) return res.status(401).json({ error: 'Invalid credentials.' });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ error: 'Invalid credentials.' });

    const token = jwt.sign({ userId: user._id.toString() }, JWT_SECRET_RESOLVED, { expiresIn: '7d' });

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

// ─── User profile routes (JWT protected) ─────────────────────────────────────

// GET /api/user/me
app.get('/api/user/me', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const user = await User.findById(req.userId).select('firstName lastName username email');
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ firstName: user.firstName, lastName: user.lastName, username: user.username ?? '', email: user.email });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to load profile', detail: err.message });
  }
});

// PUT /api/user/profile — update username and/or email
app.put('/api/user/profile', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { username, email } = req.body;
    if (!username && !email) {
      return res.status(400).json({ error: 'Provide at least one field to update' });
    }

    if (email) {
      const conflict = await User.findOne({ email, _id: { $ne: req.userId } });
      if (conflict) return res.status(409).json({ error: 'That email is already in use.' });
    }

    const user = await User.findByIdAndUpdate(
      req.userId,
      { $set: { ...(username !== undefined && { username }), ...(email && { email }) } },
      { new: true, runValidators: true }
    ).select('firstName lastName username email');

    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ firstName: user.firstName, lastName: user.lastName, username: user.username ?? '', email: user.email });
  } catch (err: any) {
    console.error('[Ojo] Profile update failed:', err.message);
    res.status(500).json({ error: 'Profile update failed', detail: err.message });
  }
});

// PUT /api/user/password — requires current password verification
app.put('/api/user/password', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword) {
      return res.status(400).json({ error: 'Current password is required.' });
    }
    if (!newPassword || newPassword.length < 8) {
      return res.status(400).json({ error: 'New password must be at least 8 characters.' });
    }

    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ error: 'User not found.' });

    const match = await bcrypt.compare(currentPassword, user.password);
    if (!match) return res.status(401).json({ error: 'Current password is incorrect.' });

    user.password = await bcrypt.hash(newPassword, 12);
    await user.save();

    res.json({ message: 'Password updated.' });
  } catch (err: any) {
    console.error('[Ojo] Password update failed:', err.message);
    res.status(500).json({ error: 'Password update failed', detail: err.message });
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

// DELETE /api/user/me — permanently delete account and all closets
app.delete('/api/user/me', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    await Closet.deleteMany({ userId: req.userId });
    const deleted = await User.findByIdAndDelete(req.userId);
    if (!deleted) return res.status(404).json({ error: 'User not found.' });
    res.json({ message: 'Account deleted.' });
  } catch (err: any) {
    console.error('[Ojo] Account deletion failed:', err.message);
    res.status(500).json({ error: 'Could not delete account.', detail: err.message });
  }
});

// GET /api/user/export — GDPR data export
app.get('/api/user/export', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const user    = await User.findById(req.userId).select('-password');
    const closets = await Closet.find({ userId: req.userId });

    if (!user) return res.status(404).json({ error: 'User not found.' });

    const exportData = {
      exportedAt: new Date().toISOString(),
      account: {
        id:        user._id,
        firstName: user.firstName,
        lastName:  user.lastName,
        email:     user.email,
        username:  user.username,
        birthday:  user.birthday,
        createdAt: (user as any).createdAt,
      },
      settings: user.settings,
      closets:  closets.map(c => ({
        id:          c._id,
        name:        c.name,
        isPreferred: c.isPreferred,
        articles:    c.articles,
        createdAt:   (c as any).createdAt,
      })),
    };

    res.setHeader('Content-Disposition', 'attachment; filename="ojo-data-export.json"');
    res.setHeader('Content-Type', 'application/json');
    res.json(exportData);
  } catch (err: any) {
    console.error('[Ojo] Data export failed:', err.message);
    res.status(500).json({ error: 'Data export failed.', detail: err.message });
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
      status.accuweather.ok     = true;
      status.accuweather.sample = { key: r.data?.Key ?? null };
    } catch (e: any) {
      status.accuweather.ok    = false;
      status.accuweather.error = e.message;
    }
  }

  status.mongodb = {
    configured: !!MONGO_URI,
    state: mongoose.connection.readyState,
  };

  res.json(status);
});

// ─── Closet routes (JWT protected) ───────────────────────────────────────────

app.post('/api/closets', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { name } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Closet name is required.' });
    const closet = await Closet.create({ name: name.trim(), userId: req.userId, articles: [] });
    res.status(201).json(closet);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to create closet', detail: err.message });
  }
});

app.get('/api/closets', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const closets = await Closet.find({ userId: req.userId }).sort({ createdAt: -1 });
    res.json(closets);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch closets', detail: err.message });
  }
});

app.put('/api/closets/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { name } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Closet name is required.' });
    const closet = await Closet.findOneAndUpdate(
      { _id: req.params.id, userId: req.userId },
      { $set: { name: name.trim() } },
      { new: true }
    );
    if (!closet) return res.status(404).json({ error: 'Closet not found.' });
    res.json(closet);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to update closet', detail: err.message });
  }
});

app.put('/api/closets/:id/preferred', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    await Closet.updateMany({ userId: req.userId }, { $set: { isPreferred: false } });
    const closet = await Closet.findOneAndUpdate(
      { _id: req.params.id, userId: req.userId },
      { $set: { isPreferred: true } },
      { new: true }
    );
    if (!closet) return res.status(404).json({ error: 'Closet not found.' });
    res.json(closet);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to set preferred closet.', detail: err.message });
  }
});

app.delete('/api/closets/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const closet = await Closet.findOneAndDelete({ _id: req.params.id, userId: req.userId });
    if (!closet) return res.status(404).json({ error: 'Closet not found.' });
    res.json({ message: 'Closet deleted.' });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to delete closet', detail: err.message });
  }
});

app.post('/api/closets/:id/articles', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const closet = await Closet.findOne({ _id: req.params.id, userId: req.userId });
    if (!closet) return res.status(404).json({ error: 'Closet not found.' });

    const { clothingType, ...rest } = req.body;
    if (!clothingType) return res.status(400).json({ error: 'clothingType is required.' });

    closet.articles.push({ clothingType, ...rest } as any);
    await closet.save();
    res.status(201).json(closet);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to add article', detail: err.message });
  }
});

app.delete('/api/closets/:closetId/articles/:articleId', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const closet = await Closet.findOne({ _id: req.params.closetId, userId: req.userId });
    if (!closet) return res.status(404).json({ error: 'Closet not found.' });

    const before = closet.articles.length;
    closet.articles = closet.articles.filter(
      (a) => a._id?.toString() !== req.params.articleId
    ) as any;
    if (closet.articles.length === before) return res.status(404).json({ error: 'Article not found.' });

    await closet.save();
    res.json(closet);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to remove article', detail: err.message });
  }
});

app.put('/api/closets/:closetId/articles/:articleId', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const closet = await Closet.findOne({ _id: req.params.closetId, userId: req.userId });
    if (!closet) return res.status(404).json({ error: 'Closet not found.' });

    const article = closet.articles.find((a) => a._id?.toString() === req.params.articleId);
    if (!article) return res.status(404).json({ error: 'Article not found.' });

    const { clothingType, name, topOrBottom, clothingCategory, fabricType, color,
            isAccessory, isWristWear, isAnkleWear, merchant, imageUrl } = req.body;

    if (clothingType  !== undefined) (article as any).clothingType      = clothingType;
    if (name          !== undefined) (article as any).name               = name;
    if (topOrBottom   !== undefined) (article as any).topOrBottom        = topOrBottom;
    if (clothingCategory !== undefined) (article as any).clothingCategory = clothingCategory;
    if (fabricType    !== undefined) (article as any).fabricType         = fabricType;
    if (color         !== undefined) (article as any).color              = color;
    if (isAccessory   !== undefined) (article as any).isAccessory        = isAccessory;
    if (isWristWear   !== undefined) (article as any).isWristWear        = isWristWear;
    if (isAnkleWear   !== undefined) (article as any).isAnkleWear        = isAnkleWear;
    if (merchant      !== undefined) (article as any).merchant           = merchant;
    if (imageUrl      !== undefined) (article as any).imageUrl           = imageUrl;

    await closet.save();
    res.json(closet);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to update article', detail: err.message });
  }
});

// ─── Serve React production build ────────────────────────────────────────────
const BUILD_DIR = path.join(__dirname, '../../build');
app.use(express.static(BUILD_DIR));
app.get('*', (_req: Request, res: Response) => {
  const indexPath = path.join(BUILD_DIR, 'index.html');
  res.sendFile(indexPath, (err) => {
    if (err) {
      res.status(200).send(`<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><title>Ojo</title>
<style>body{background:#0F172A;color:rgba(255,255,255,0.8);font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;text-align:center}div{max-width:400px;padding:32px}code{background:rgba(255,255,255,0.1);padding:2px 6px;border-radius:4px;font-size:0.85em}</style>
</head>
<body><div>
  <p style="font-size:1.1rem;font-weight:500">Build not found</p>
  <p style="opacity:0.6;margin-top:8px">Run <code>npm run build</code> to compile the React app, then restart the server.</p>
</div></body>
</html>`);
    }
  });
});

// ─── Start ────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`[Ojo] Server running on http://localhost:${PORT}`));
