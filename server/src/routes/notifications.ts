import { Router, Request, Response } from 'express';
import { requireAuth, AuthRequest } from '../middleware/auth';
import User from '../models/User';
import { isValidTimeZone } from '../lib/timeZone';
import { coarsen } from '../lib/coarseLocation';

const router = Router();

/**
 * Numeric coercion that accepts 0.
 *
 * `Number(v) || fallback` treats every falsy-but-valid value as missing. An
 * hour of 0 — UTC midnight, which is exactly what 9am in Tokyo converts to —
 * was silently rewritten to 12, moving that user's morning window twelve hours
 * and showing them the wrong hour back on the next load. Same trap for a
 * temp-swing threshold of 0.
 */
const num = (v: unknown, fallback: number): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

/**
 * Whole-hour clock value, 0–23.
 *
 * Also the server-side backstop for the fractional hours older clients wrote
 * (see localHourToUTC in src/lib/notifications.ts — a sub-hour timezone offset
 * used to produce e.g. 2.5). runMorningCheck matches this field against an
 * integer getUTCHours(), so a non-integer here matches no hour at all and the
 * notification silently never fires. Rounding on write heals those accounts the
 * next time they save.
 */
const hourOfDay = (v: unknown, fallback: number): number => {
  const n = Math.round(num(v, fallback));
  return n >= 0 && n <= 23 ? n : fallback;
};

/** Whole day-of-week, 0 (Sun) – 6 (Sat). */
const dayOfWeek = (v: unknown, fallback: number): number => {
  const n = Math.round(num(v, fallback));
  return n >= 0 && n <= 6 ? n : fallback;
};

/**
 * An IANA zone name we're willing to store, or undefined.
 *
 * Validated at the edge rather than at read time: an unrecognised name makes
 * Intl throw, and the place that reads this is a cron loop where one throw
 * would abort the pass for every other user too.
 */
const timeZoneOrUndefined = (v: unknown): string | undefined =>
  isValidTimeZone(v) ? v : undefined;

// Register or update push token
router.post('/token', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { pushToken, timeZone } = req.body;
    if (!pushToken || typeof pushToken !== 'string') {
      res.status(400).json({ error: 'pushToken is required' });
      return;
    }

    // The device's current zone rides along with the token because this route
    // is called on every cold start (AuthContext), while the settings screen
    // may be visited once and never again. That cadence is what keeps a
    // traveller's notifications on their new local clock, and it's a dotted
    // $set so it can't clobber the rest of `settings`.
    const tz = timeZoneOrUndefined(timeZone);
    await User.findByIdAndUpdate(req.userId, {
      $set: { pushToken, ...(tz ? { 'settings.timeZone': tz } : {}) },
    });
    res.json({ success: true });
  } catch (err) {
    console.error('[notifications] token save error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /trip-presence — the device reporting whether it is at a saved trip.
 *
 * `{ tripId }` confirms the device's GPS put it within Trip Mode's radius of
 * that trip's city; `{ tripId: null }` says GPS was available and put it near
 * none of them. Nothing is posted when GPS is unavailable, so the last known
 * answer ages out on its own rather than being overwritten by a guess.
 *
 * This is what lets the notification passes talk about the trip city (see
 * lib/activeTrip.ts). Deliberately just an id: the destination is already on
 * the plan, so confirming presence needs no coordinates to leave the device.
 *
 * An id that matches no plan of this user's is inert rather than rejected — the
 * gate resolves it against their real trips, so the worst a bogus one does is
 * fail to confirm anything. That keeps a plan the client saved but hasn't
 * synced yet from being refused here and then silently failing to confirm once
 * it lands.
 */
router.post('/trip-presence', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { tripId } = req.body;
    const confirmed =
      typeof tripId === 'string' && tripId.length > 0 && tripId.length <= 200
        ? tripId
        : null;

    await User.findByIdAndUpdate(
      req.userId,
      confirmed
        ? { $set: { tripPresence: { tripId: confirmed, confirmedAt: new Date() } } }
        : { $unset: { tripPresence: '' } },
    );
    res.json({ success: true });
  } catch (err) {
    console.error('[notifications] trip presence save error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/notifications/device-location — where the phone is now.
 *
 * Body: `{ lat, lon, city? }` to report, or `{ lat: null }` to clear. The
 * notification passes prefer a fresh report over the home city
 * (lib/activeTrip.ts · resolveWeatherLocation), which is what keeps a closet
 * gap nudge or weather alert describing the city the user is actually in.
 *
 * The client already rounds to ~1 km before sending (src/lib/coarseLocation.ts);
 * rounding again here keeps the stored value coarse for any client that
 * doesn't, so the privacy label's "Coarse Location" holds regardless.
 */
router.post('/device-location', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { lat, lon, city } = req.body ?? {};
    if (lat === null || lon === null) {
      await User.findByIdAndUpdate(req.userId, { $unset: { deviceLocation: '' } });
      res.json({ success: true });
      return;
    }
    const valid =
      typeof lat === 'number' && Number.isFinite(lat) && lat >= -90 && lat <= 90 &&
      typeof lon === 'number' && Number.isFinite(lon) && lon >= -180 && lon <= 180;
    if (!valid) {
      res.status(400).json({ error: 'lat and lon must be valid coordinates' });
      return;
    }
    // A bare "lat,lng" is what the app's geocoder falls back to when it can't
    // name a place; storing it would put coordinates into notification copy.
    const trimmed = typeof city === 'string' ? city.trim() : '';
    const isCoordinates = /^-?\d+(?:\.\d+)?\s*,\s*-?\d+(?:\.\d+)?$/.test(trimmed);
    const name = isCoordinates ? '' : trimmed.slice(0, 120);
    await User.findByIdAndUpdate(req.userId, {
      $set: {
        deviceLocation: {
          lat: coarsen(lat),
          lon: coarsen(lon),
          ...(name ? { city: name } : {}),
          reportedAt: new Date(),
        },
      },
    });
    res.json({ success: true });
  } catch (err) {
    console.error('[notifications] device location save error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get notification settings
router.get('/settings', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await User.findById(req.userId).select('notificationSettings');
    if (!user) { res.status(404).json({ error: 'User not found' }); return; }
    res.json(user.notificationSettings);
  } catch (err) {
    console.error('[notifications] settings get error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update notification settings
router.put('/settings', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const {
      morningBriefEnabled,
      morningBriefHourUTC,
      morningBriefHourLocal,
      timeZone,
      weatherChangeEnabled,
      tempSwingEnabled,
      tempSwingThresholdF,
      closetGapEnabled,
      weeklyRecapEnabled,
      weeklyRecapDay,
      sameDayNudgeEnabled,
    } = req.body;

    const utcHour = hourOfDay(morningBriefHourUTC, 12);
    // The local hour is the durable value and the UTC one is its DST-perishable
    // cache (see lib/timeZone.ts). Older clients send only the UTC hour; for
    // those, leaving this undefined is correct — it keeps them on the legacy
    // path rather than inventing a local hour from an offset we don't know.
    const localHour =
      morningBriefHourLocal === undefined || morningBriefHourLocal === null
        ? undefined
        : hourOfDay(morningBriefHourLocal, utcHour);
    const tz = timeZoneOrUndefined(timeZone);

    await User.findByIdAndUpdate(req.userId, {
      $set: {
        notificationSettings: {
          morningBriefEnabled:  Boolean(morningBriefEnabled),
          morningBriefHourUTC:  utcHour,
          ...(localHour === undefined ? {} : { morningBriefHourLocal: localHour }),
          weatherChangeEnabled: Boolean(weatherChangeEnabled),
          tempSwingEnabled:     Boolean(tempSwingEnabled),
          tempSwingThresholdF:  num(tempSwingThresholdF, 20),
          closetGapEnabled:     Boolean(closetGapEnabled),
          weeklyRecapEnabled:   Boolean(weeklyRecapEnabled),
          weeklyRecapDay:       dayOfWeek(weeklyRecapDay, 0),
          sameDayNudgeEnabled:  Boolean(sameDayNudgeEnabled),
        },
        ...(tz ? { 'settings.timeZone': tz } : {}),
      },
    });
    res.json({ success: true });
  } catch (err) {
    console.error('[notifications] settings update error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
