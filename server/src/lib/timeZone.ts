/**
 * IANA time-zone helpers for the notification scheduler.
 *
 * WHY THIS EXISTS
 * ───────────────
 * Notification hours used to be stored only as `morningBriefHourUTC`, computed
 * on the client at save time from `new Date().getTimezoneOffset()`. That offset
 * is a snapshot: it describes the device's offset *on the day the user saved*,
 * not the offset on the day the notification fires. When the clocks change,
 * every stored hour is off by one and stays off until the user happens to
 * re-open the settings screen and save again — which most never do. Twice a
 * year, for the majority of users, every scheduled push moved an hour.
 *
 * The fix is to store the zone itself (`settings.timeZone`, e.g.
 * "Europe/Berlin") plus the hour the user actually picked
 * (`notificationSettings.morningBriefHourLocal`), and re-derive the UTC hour on
 * every cron tick. A zone name carries its own DST rules; a fixed offset does
 * not.
 *
 * `morningBriefHourUTC` is still written and still read as the fallback for
 * accounts that predate `timeZone`, so nothing breaks for users who haven't
 * opened the app since this shipped.
 */

/** Cache of names we've already validated — `supportedValuesOf` isn't cheap. */
const validated = new Map<string, boolean>();

/**
 * True when `tz` is a name this Node build's ICU data recognises.
 *
 * Client-supplied, so it must be treated as untrusted input: an unknown name
 * makes Intl throw a RangeError, which inside a cron loop would abort the whole
 * pass and take every other user's notification down with it.
 */
export function isValidTimeZone(tz: unknown): tz is string {
  if (typeof tz !== 'string' || tz.length === 0 || tz.length > 64) return false;
  const cached = validated.get(tz);
  if (cached !== undefined) return cached;
  let ok = false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    ok = true;
  } catch {
    ok = false;
  }
  validated.set(tz, ok);
  return ok;
}

/**
 * Minutes `tz` is AHEAD of UTC at instant `at`. Tokyo → +540, Los Angeles in
 * summer → -420, Kolkata → +330.
 *
 * NOTE the sign is the opposite of JS's `Date.prototype.getTimezoneOffset()`,
 * which reports minutes *behind* UTC. This direction is the one that reads
 * correctly ("+05:30 is ahead of UTC"), and getting it backwards is the classic
 * way to ship a bug that only appears on one side of the meridian.
 *
 * Derived by formatting `at` in the target zone and re-reading those wall-clock
 * fields as if they were UTC; the difference is the offset. This is the only
 * approach that stays correct across DST transitions and historical rule
 * changes, because ICU applies the zone's real rules for that instant.
 */
export function offsetMinutes(tz: string, at: Date = new Date()): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hourCycle: 'h23', // without this, midnight formats as "24" in some locales
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(at);

  const f = (type: string): number =>
    Number(parts.find(p => p.type === type)?.value ?? '0');

  const wallClockAsUTC = Date.UTC(
    f('year'), f('month') - 1, f('day'), f('hour'), f('minute'), f('second'),
  );
  // Both sides floored to whole seconds so sub-second drift can't leak into a
  // value we're about to divide by 60_000.
  return (wallClockAsUTC - Math.floor(at.getTime() / 1000) * 1000) / 60_000;
}

/**
 * The UTC hour (0–23) at which `localHour` occurs in `tz`, for the DST rules in
 * force at `at`.
 *
 * Rounds the *result*, not the offset. Zones on a sub-hour offset (Kolkata
 * +05:30, Kathmandu +05:45, Adelaide, St John's, Chatham) can't map a whole
 * local hour onto a whole UTC hour, and the cron only fires on the hour, so
 * something has to give. Rounding here matches `localHourToUTC` in
 * src/lib/notifications.ts exactly — verified for every hour in every offset by
 * the parity test in __tests__/timeZone.test.ts — which keeps the value this
 * returns identical to the one the client computed and stored, so healing a
 * drifted `morningBriefHourUTC` never fights the client.
 *
 * Rounding the offset first would NOT agree: Math.round(5.5) is 6 but
 * Math.round(-5.5) is -5, so the two sides would disagree by an hour in exactly
 * the half-hour zones this is meant to handle.
 */
export function utcHourForLocalHour(tz: string, localHour: number, at: Date = new Date()): number {
  const shifted = Math.round((localHour * 60 - offsetMinutes(tz, at)) / 60);
  return ((shifted % 24) + 24) % 24;
}

/** Current wall-clock hour (0–23) in `tz`. */
export function localHourNow(tz: string, at: Date = new Date()): number {
  const h = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hourCycle: 'h23', hour: '2-digit',
  }).formatToParts(at).find(p => p.type === 'hour')?.value;
  return Number(h ?? 0);
}
