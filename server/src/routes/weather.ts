import { Router, Response } from 'express';
import { AxiosError } from 'axios';
import { lookupCity, getCurrent, getHourlyForecast, get5DayForecast, get10DayForecast } from '../lib/accuWeather';
import { requireAuth, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(requireAuth);

// AccuWeather city keys are numeric strings, typically 3–8 digits.
// Rejecting non-matching inputs prevents arbitrary path segments from being
// forwarded to AccuWeather.
const CITY_KEY_RE = /^[0-9]{3,8}$/;

function isValidCityKey(value: string): boolean {
  return CITY_KEY_RE.test(value);
}

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

router.get('/city', async (req: AuthRequest, res: Response): Promise<void> => {
  const { q } = req.query;
  if (!q) {
    res.status(400).json({ error: 'q is required' });
    return;
  }
  try {
    res.json(await lookupCity(String(q)));
  } catch (err) {
    handleAccuError(err, res, 'city lookup');
  }
});

router.get('/current/:cityKey', async (req: AuthRequest, res: Response): Promise<void> => {
  if (!isValidCityKey(req.params.cityKey)) {
    res.status(400).json({ error: 'Invalid cityKey' });
    return;
  }
  try {
    const details = req.query.details === undefined ? true : Boolean(req.query.details);
    res.json(await getCurrent(req.params.cityKey, details));
  } catch (err) {
    handleAccuError(err, res, 'current conditions');
  }
});

router.get('/forecast/:cityKey', async (req: AuthRequest, res: Response): Promise<void> => {
  if (!isValidCityKey(req.params.cityKey)) {
    res.status(400).json({ error: 'Invalid cityKey' });
    return;
  }
  try {
    res.json(await getHourlyForecast(req.params.cityKey));
  } catch (err) {
    handleAccuError(err, res, 'forecast');
  }
});

router.get('/forecast/daily/:cityKey', async (req: AuthRequest, res: Response): Promise<void> => {
  if (!isValidCityKey(req.params.cityKey)) {
    res.status(400).json({ error: 'Invalid cityKey' });
    return;
  }
  try {
    res.json(await get5DayForecast(req.params.cityKey));
  } catch (err) {
    handleAccuError(err, res, 'daily forecast');
  }
});

router.get('/forecast/daily10/:cityKey', async (req: AuthRequest, res: Response): Promise<void> => {
  if (!isValidCityKey(req.params.cityKey)) {
    res.status(400).json({ error: 'Invalid cityKey' });
    return;
  }
  try {
    res.json(await get10DayForecast(req.params.cityKey));
  } catch (err) {
    handleAccuError(err, res, 'daily10 forecast');
  }
});

export default router;
