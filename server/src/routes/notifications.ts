import { Router, Request, Response } from 'express';
import { requireAuth, AuthRequest } from '../middleware/auth';
import User from '../models/User';
import { isValidTimeZone } from '../lib/timeZone';

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
