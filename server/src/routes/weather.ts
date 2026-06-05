import { Router, Response } from 'express';
import { AxiosError } from 'axios';
import { getCurrent, getHourly, getDaily } from '../lib/weatherKit';
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

router.get('/hourly', async (req: AuthRequest, res: Response): Promise<void> => {
  const coords = parseCoords(req);
  if (!coords) { res.status(400).json({ error: 'lat and lon required' }); return; }
  try {
    res.json(await getHourly(coords.lat, coords.lon));
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
