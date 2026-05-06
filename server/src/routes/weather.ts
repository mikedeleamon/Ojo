import { Router, Request, Response } from 'express';
import axios, { AxiosError } from 'axios';

const router = Router();

const accu = axios.create({ baseURL: process.env.ACCUWEATHER_BASE_URL ?? 'https://dataservice.accuweather.com' });
const key = () => process.env.ACCUWEATHER_API_KEY!;

// ─── Simple TTL cache ─────────────────────────────────────────────────────────
// Avoids burning AccuWeather quota on repeated fetches within the cache window.
// City keys change very rarely; weather/forecast change every 30–60 min.

interface CacheEntry<T> { data: T; expiresAt: number }
const cache = new Map<string, CacheEntry<unknown>>();

function cacheGet<T>(k: string): T | null {
  const entry = cache.get(k) as CacheEntry<T> | undefined;
  if (!entry || Date.now() > entry.expiresAt) { cache.delete(k); return null; }
  return entry.data;
}
function cacheSet<T>(k: string, data: T, ttlMs: number) {
  cache.set(k, { data, expiresAt: Date.now() + ttlMs });
}

const TTL_CITY     = 60 * 60 * 1_000;  // 1 h  — city keys are stable
const TTL_CURRENT  = 30 * 60 * 1_000;  // 30 min
const TTL_FORECAST = 60 * 60 * 1_000;  // 1 h

// ─── Error passthrough ────────────────────────────────────────────────────────
// Surface AccuWeather's status (especially 429) rather than swallowing it as 500.

function handleAccuError(err: unknown, res: Response, label: string) {
  const status = (err as AxiosError)?.response?.status;
  console.error(`[weather] ${label} error (${status ?? 'unknown'}):`, err);
  if (status === 429) {
    res.status(429).json({ error: 'Weather API rate limit reached. Try again later.' });
  } else {
    res.status(500).json({ error: 'Weather service unavailable' });
  }
}

// ─── Routes ───────────────────────────────────────────────────────────────────

router.get('/city', async (req: Request, res: Response): Promise<void> => {
  const { q } = req.query;
  if (!q) { res.status(400).json({ error: 'q is required' }); return; }
  const cacheKey = `city:${String(q).toLowerCase()}`;
  const cached = cacheGet<unknown>(cacheKey);
  if (cached) { res.json(cached); return; }
  try {
    const { data } = await accu.get('/locations/v1/cities/search', {
      params: { apikey: key(), q },
    });
    const result = data?.[0] ?? null;
    if (result) cacheSet(cacheKey, result, TTL_CITY);
    res.json(result);
  } catch (err) {
    handleAccuError(err, res, 'city lookup');
  }
});

router.get('/current/:cityKey', async (req: Request, res: Response): Promise<void> => {
  const { cityKey } = req.params;
  const cacheKey = `current:${cityKey}`;
  const cached = cacheGet<unknown>(cacheKey);
  if (cached) { res.json(cached); return; }
  try {
    const { data } = await accu.get(`/currentconditions/v1/${cityKey}`, {
      params: { apikey: key(), details: req.query.details ?? true },
    });
    if (data) cacheSet(cacheKey, data, TTL_CURRENT);
    res.json(data);
  } catch (err) {
    handleAccuError(err, res, 'current conditions');
  }
});

router.get('/forecast/:cityKey', async (req: Request, res: Response): Promise<void> => {
  const { cityKey } = req.params;
  const cacheKey = `forecast:${cityKey}`;
  const cached = cacheGet<unknown>(cacheKey);
  if (cached) { res.json(cached); return; }
  try {
    const { data } = await accu.get(`/forecasts/v1/hourly/12hour/${cityKey}`, {
      params: { apikey: key(), details: true },
    });
    if (data) cacheSet(cacheKey, data, TTL_FORECAST);
    res.json(data);
  } catch (err) {
    handleAccuError(err, res, 'forecast');
  }
});

export default router;
