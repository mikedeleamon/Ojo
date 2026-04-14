import express, { Request, Response } from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import axios from 'axios';
import dotenv from 'dotenv';
import path from 'path';

import User from '../models/User';
import Settings from '../models/Settings';

// Load environment variables from a .env file (if present)
dotenv.config();

const app = express();
const API_KEY = process.env.ACCUWEATHER_API_KEY || '';
const AW_BASE = process.env.ACCUWEATHER_BASE_URL || 'https://dataservice.accuweather.com';

// CORS origins can be provided as a comma-separated list in CORS_ORIGINS
const originsEnv = process.env.CORS_ORIGINS || 'http://localhost:3001,http://localhost:3002';
const origins = originsEnv.split(',').map((s) => s.trim()).filter(Boolean);

app.use(cors({ origin: origins }));
app.use(express.json());

// Fail fast for missing AccuWeather API key: return a clear 500 error instead of
// forwarding requests and receiving a 401 from the third-party service.
if (!API_KEY) {
  console.warn('[Ojo] Warning: ACCUWEATHER_API_KEY is not set on the server. Weather proxy routes will return 500.');
}

const requireAccuKey = (req: Request, res: Response, next: any) => {
  if (!API_KEY) {
    return res.status(500).json({ error: 'Server misconfigured: ACCUWEATHER_API_KEY not set' });
  }
  return next();
};

// Apply the key requirement to weather routes
app.use('/api/weather', requireAccuKey);

// Simple in-memory cache for city lookups to reduce AccuWeather requests in dev
type CacheEntry = { data: any; expires: number };
const CITY_CACHE = new Map<string, CacheEntry>();
const CITY_CACHE_TTL = Number(process.env.CITY_CACHE_TTL_SECONDS || 600); // seconds

// ─── MongoDB ──────────────────────────────────────────────────────────────────
const MONGO_URI = process.env.MONGO_URI || '';

if (!MONGO_URI) {
  console.warn('[Ojo] Warning: MONGO_URI not set. Running without DB connection.');
} else {
  mongoose
    .connect(MONGO_URI)
    .then(() => console.log('[Ojo] Connected to MongoDB'))
    .catch((err) =>
      console.warn('[Ojo] MongoDB unavailable — running without DB:', err.message)
    );
}

// ─── AccuWeather proxy routes ─────────────────────────────────────────────────
// These run server-side so CORS never applies.

app.get('/api/weather/city', async (req: Request, res: Response) => {
  try {
    const q = String(req.query.q || '');

    // Check cache first
    const now = Date.now();
    const cached = CITY_CACHE.get(q);
    if (cached && cached.expires > now) {
      return res.json(cached.data);
    }

    const { data } = await axios.get(`${AW_BASE}/locations/v1/cities/geoposition/search`, {
      params: { apikey: API_KEY, q },
      timeout: 5000,
    });

    // Store in cache
    CITY_CACHE.set(q, { data, expires: now + CITY_CACHE_TTL * 1000 });

    res.json(data);
  } catch (err: any) {
    console.error('[Ojo] City lookup failed:', err.message || err);
    res.status(502).json({ error: 'City lookup failed', detail: err.message || String(err) });
  }
});

app.get('/api/weather/current/:cityKey', async (req: Request, res: Response) => {
  try {
    const { data } = await axios.get(
      `${AW_BASE}/currentconditions/v1/${req.params.cityKey}`,
      { params: { apikey: API_KEY, details: true } }
    );
    res.json(data);
  } catch (err: any) {
    console.error('[Ojo] Current weather failed:', err.message);
    res.status(502).json({ error: 'Current weather failed', detail: err.message });
  }
});

app.get('/api/weather/forecast/:cityKey', async (req: Request, res: Response) => {
  try {
    const { data } = await axios.get(
      `${AW_BASE}/forecasts/v1/hourly/12hour/${req.params.cityKey}`,
      { params: { apikey: API_KEY } }
    );
    res.json(data);
  } catch (err: any) {
    console.error('[Ojo] Forecast failed:', err.message);
    res.status(502).json({ error: 'Forecast failed', detail: err.message });
  }
});

// Health check: verifies server config, AccuWeather auth, and MongoDB connection state
app.get('/health', async (req: Request, res: Response) => {
  const status: any = { uptime: process.uptime() };

  status.accuweather = { configured: !!API_KEY };
  if (API_KEY) {
    try {
      // quick test using a known coordinate (NYC) to verify auth and reachability
      const r = await axios.get(`${AW_BASE}/locations/v1/cities/geoposition/search`, {
        params: { apikey: API_KEY, q: '40.7128,-74.0060' },
        timeout: 4000,
      });
      status.accuweather.ok = true;
      status.accuweather.sample = { key: r.data?.Key ?? null };
    } catch (e: any) {
      status.accuweather.ok = false;
      status.accuweather.error = e.message || String(e);
    }
  }

  status.mongodb = { configured: !!MONGO_URI };
  try {
    status.mongodb.state = mongoose.connection.readyState; // 0 disconnected, 1 connected
  } catch (e: any) {
    status.mongodb.error = e.message || String(e);
  }

  res.json(status);
});

// ─── User routes ──────────────────────────────────────────────────────────────
app.post('/add-user', async (req: Request, res: Response) => {
  const user = new User(req.body);
  try {
    const newUser = await user.save();
    res.status(201).json(newUser);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

// ─── Settings routes ──────────────────────────────────────────────────────────
app.post('/save-settings', async (req: Request, res: Response) => {
  try {
    const updated = await Settings.findOneAndUpdate(
      { userId: req.body.userId },
      req.body,
      { upsert: true, new: true }
    );
    res.status(200).json(updated);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

app.get('/get-settings', async (req: Request, res: Response) => {
  try {
    const settings = await Settings.findOne({ userId: req.query.userId });
    res.json(settings ?? {});
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// ─── Serve React production build ────────────────────────────────────────────
const BUILD_DIR = path.join(__dirname, '../../build');
app.use(express.static(BUILD_DIR));

// SPA fallback — serve index.html for any route not matched above so that
// React Router can handle client-side navigation.
app.get('*', (_req: Request, res: Response) => {
  res.sendFile(path.join(BUILD_DIR, 'index.html'));
});

// ─── Start ────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`[Ojo] Server running on http://localhost:${PORT}`));
