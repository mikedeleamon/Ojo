import { Router, Request, Response } from 'express';
import axios from 'axios';

const router = Router();

const accu = axios.create({ baseURL: process.env.ACCUWEATHER_BASE_URL ?? 'https://dataservice.accuweather.com' });
const key = () => process.env.ACCUWEATHER_API_KEY!;

router.get('/city', async (req: Request, res: Response): Promise<void> => {
  try {
    const { q } = req.query;
    if (!q) { res.status(400).json({ error: 'q is required' }); return; }
    const { data } = await accu.get('/locations/v1/cities/search', {
      params: { apikey: key(), q },
    });
    res.json(data?.[0] ?? null);
  } catch (err) {
    console.error('[weather] city lookup error:', err);
    res.status(500).json({ error: 'Weather service unavailable' });
  }
});

router.get('/current/:cityKey', async (req: Request, res: Response): Promise<void> => {
  try {
    const { cityKey } = req.params;
    const { data } = await accu.get(`/currentconditions/v1/${cityKey}`, {
      params: { apikey: key(), details: req.query.details ?? true },
    });
    res.json(data);
  } catch (err) {
    console.error('[weather] current conditions error:', err);
    res.status(500).json({ error: 'Weather service unavailable' });
  }
});

router.get('/forecast/:cityKey', async (req: Request, res: Response): Promise<void> => {
  try {
    const { cityKey } = req.params;
    const { data } = await accu.get(`/forecasts/v1/hourly/12hour/${cityKey}`, {
      params: { apikey: key(), details: true },
    });
    res.json(data);
  } catch (err) {
    console.error('[weather] forecast error:', err);
    res.status(500).json({ error: 'Weather service unavailable' });
  }
});

export default router;
