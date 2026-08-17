import { Router, Response } from 'express';
import { AxiosError } from 'axios';
import { getCurrent, getHourly, getDaily, HOURLY_WINDOW_H } from '../lib/weatherKit';
import { requireAuth, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(requireAuth);

// Reject anything that isn't a finite lat/lon in valid range so we never forward
// arbitrary path segments / parameters to WeatherKit.
function parseCoords(req: AuthRequest): { lat: number; lon: number } | null {
  const lat = Number(req.query.lat);
  const lon = Number(req.query.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;
  return { lat, lon };
}

// Surface WeatherKit's status (especially 429 / 401) rather than swallowing it as 500.
function handleWeatherError(err: unknown, res: Response, label: string) {
  const status = (err as AxiosError)?.response?.status;
  console.error(`[weather] ${label} error (${status ?? 'unknown'}):`, err);
  if (status === 429) {
    res.status(429).json({ error: 'Weather API rate limit reached. Try again later.' });
  } else if (status === 401 || status === 403) {
    res.status(502).json({ error: 'Weather service authorisation failed.' });
  } else {
    res.status(500).json({ error: 'Weather service unavailable' });
  }
}

router.get('/current', async (req: AuthRequest, res: Response): Promise<void> => {
  const coords = parseCoords(req);
  if (!coords) { res.status(400).json({ error: 'lat and lon required' }); return; }
  try {
    const data = await getCurrent(coords.lat, coords.lon);
    if (!data) { res.status(502).json({ error: 'Empty weather response' }); return; }
    res.json(data);
  } catch (err) {
    handleWeatherError(err, res, 'current');
  }
});

// `?hours=` opts into the wider window the bundle already carries. It defaults
// to 12 so existing clients — and today's outfit run, which feeds this array
// straight into buildTimeline — see exactly what they saw before. The Morning
// Outfit Brief asks for more so it can build tomorrow morning's timeline.
const DEFAULT_HOURS = 12;

function parseHours(raw: unknown): number {
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1) return DEFAULT_HOURS;
  return Math.min(n, HOURLY_WINDOW_H);
}

router.get('/hourly', async (req: AuthRequest, res: Response): Promise<void> => {
  const coords = parseCoords(req);
  if (!coords) { res.status(400).json({ error: 'lat and lon required' }); return; }
  try {
    const hours = req.query.hours === undefined ? DEFAULT_HOURS : parseHours(req.query.hours);
    res.json(await getHourly(coords.lat, coords.lon, hours));
  } catch (err) {
    handleWeatherError(err, res, 'hourly');
  }
});

router.get('/daily', async (req: AuthRequest, res: Response): Promise<void> => {
  const coords = parseCoords(req);
  if (!coords) { res.status(400).json({ error: 'lat and lon required' }); return; }
  try {
    res.json(await getDaily(coords.lat, coords.lon));
  } catch (err) {
    handleWeatherError(err, res, 'daily');
  }
});

export default router;
