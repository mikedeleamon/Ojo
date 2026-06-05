import { Router, Response } from 'express';
import TripFitPlan, { ITripFitDay } from '../models/TripFitPlan';
import { requireAuth, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(requireAuth);

const MAX_PLANS = 100;

/** Map a stored document to the client `SavedTripFitPlan` shape. */
function toClient(p: any) {
  return {
    id:                  p.clientId,
    name:                p.name ?? undefined,
    destination:         p.destination,
    lat:                 p.lat,
    lon:                 p.lon,
    startDate:           p.startDate,
    endDate:             p.endDate,
    occasion:            p.occasion,
    closetId:            p.closetId ?? '',
    days:                p.days ?? [],
    checkedIds:          p.checkedIds ?? [],
    forecastFetchedAt:   p.forecastFetchedAt ?? undefined,
    sourceAirlineTripId: p.sourceAirlineTripId ?? undefined,
    createdAt:           (p.createdAt instanceof Date ? p.createdAt : new Date(p.createdAt)).toISOString(),
    updatedAt:           (p.updatedAt instanceof Date ? p.updatedAt : new Date(p.updatedAt)).toISOString(),
  };
}

/** GET /api/tripfit — all saved plans for the user, soonest trip first. */
router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const plans = await TripFitPlan
      .find({ userId: req.userId })
      .sort({ startDate: 1 })
      .limit(MAX_PLANS)
      .lean();
    res.json(plans.map(toClient));
  } catch (err) {
    console.error('[tripfit] list error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/tripfit — create or update a plan (idempotent upsert by clientId).
 * The client sends the full plan; we replace the mutable fields wholesale.
 */
router.post('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const {
      id, name, destination, lat, lon, startDate, endDate,
      occasion, closetId, days, checkedIds, forecastFetchedAt, sourceAirlineTripId,
    } = req.body;

    if (!id || !destination || !startDate || !endDate) {
      res.status(400).json({ error: 'id, destination, startDate, and endDate are required' });
      return;
    }
    if (typeof lat !== 'number' || typeof lon !== 'number') {
      res.status(400).json({ error: 'lat and lon must be numbers' });
      return;
    }

    // Defensive: trim the snapshot to expected fields so we never persist
    // arbitrary client payloads into the subdocument array.
    const safeDays: ITripFitDay[] = Array.isArray(days)
      ? days.map((d: any) => ({
          date:             String(d.date),
          minTempF:         Number(d.minTempF),
          maxTempF:         Number(d.maxTempF),
          dayPhrase:        String(d.dayPhrase ?? ''),
          hasPrecipitation: !!d.hasPrecipitation,
          articleIds:       Array.isArray(d.articleIds) ? d.articleIds.map(String) : [],
        }))
      : [];

    const plan = await TripFitPlan.findOneAndUpdate(
      { userId: req.userId, clientId: id },
      {
        $set: {
          name:                name || undefined,
          destination,
          lat,
          lon,
          startDate,
          endDate,
          occasion:            occasion ?? 'everyday',
          closetId:            closetId ?? '',
          days:                safeDays,
          checkedIds:          Array.isArray(checkedIds) ? checkedIds.map(String) : [],
          forecastFetchedAt:   forecastFetchedAt ?? undefined,
          sourceAirlineTripId: sourceAirlineTripId ?? undefined,
        },
        $setOnInsert: { userId: req.userId, clientId: id },
      },
      { upsert: true, new: true },
    );

    res.status(201).json(toClient(plan));
  } catch (err) {
    console.error('[tripfit] upsert error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/** DELETE /api/tripfit/:id — delete a single plan by clientId. */
router.delete('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await TripFitPlan.findOneAndDelete({ userId: req.userId, clientId: req.params.id });
    res.sendStatus(204);
  } catch (err) {
    console.error('[tripfit] delete error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/** DELETE /api/tripfit?confirm=true — clear all plans for the user. */
router.delete('/', async (req: AuthRequest, res: Response): Promise<void> => {
  if (req.query.confirm !== 'true') {
    res.status(400).json({ error: 'Pass ?confirm=true to clear all trip plans' });
    return;
  }
  try {
    await TripFitPlan.deleteMany({ userId: req.userId });
    res.sendStatus(204);
  } catch (err) {
    console.error('[tripfit] clear error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
