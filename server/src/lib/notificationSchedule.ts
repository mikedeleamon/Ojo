/**
 * Pure scheduling arithmetic for the notification crons.
 *
 * Split out of services/notificationService.ts so it can be tested without
 * standing up mongoose models or a WeatherKit client. Nothing here touches the
 * database or the network — it answers one question: given a user document and
 * the current instant, on which UTC hour should this user's notification fire?
 *
 * See lib/timeZone.ts for why the answer is derived from an IANA zone name
 * rather than a stored offset.
 */

import { isValidTimeZone, utcHourForLocalHour } from './timeZone';

/** The shape of a lean user document that these helpers need. */
export type ScheduledUser = {
  settings?:             { timeZone?: string | null } | null;
  notificationSettings?: {
    morningBriefHourUTC?:   number | null;
    morningBriefHourLocal?: number | null;
  } | null;
};

/**
 * The UTC hour on which this user's "morning window + offsetH" slot falls right
 * now, or null when we can't tell.
 *
 * For accounts that have recorded a zone, this is re-derived from the zone on
 * every tick, so it follows DST — which is the whole point. `morningBriefHourUTC`
 * is only a cache of a computation the client did on the day the user last
 * saved; a zone name carries its own rules and stays correct.
 *
 * Accounts missing EITHER half of the pair fall back to that cached hour. It is
 * frozen at whatever offset was in force when they saved, which is the old
 * (wrong-after-DST) behaviour — kept deliberately, because being an hour off is
 * strictly better than notifying them not at all.
 *
 * They move onto the accurate path the next time they save the notification
 * settings screen, which is the only thing that sends `morningBriefHourLocal`.
 * Registering a push token seeds `settings.timeZone` on every cold start but
 * cannot supply the local hour, so it is not on its own enough to switch a
 * legacy account over. No backfill for that is worth writing today — every
 * server-sent notification here is opt-in and defaults to off, so an account
 * with one enabled has been through that screen already.
 */
export function scheduledUtcHour(user: ScheduledUser, offsetH: number, at: Date): number | null {
  const ns = user.notificationSettings;
  if (!ns) return null;

  const tz    = user.settings?.timeZone;
  const local = ns.morningBriefHourLocal;
  if (typeof local === 'number' && Number.isInteger(local) && isValidTimeZone(tz)) {
    return utcHourForLocalHour(tz, (local + offsetH) % 24, at);
  }

  const stored = ns.morningBriefHourUTC;
  if (typeof stored !== 'number' || !Number.isInteger(stored)) return null;
  return (stored + offsetH) % 24;
}

/**
 * Stored `morningBriefHourUTC` values that could be due at `utcHour`.
 *
 * The stored value is the client's snapshot, so after a DST transition it sits
 * up to an hour away from what `scheduledUtcHour` now computes. Widening the
 * query by ±1 keeps the candidate set at 3/24 of the table while guaranteeing
 * every genuinely-due user is inside it; `scheduledUtcHour` then decides
 * exactly which of them fire.
 */
export function candidateHours(utcHour: number, offsetH: number): number[] {
  const base = utcHour - offsetH;
  return [-1, 0, 1].map(d => (((base + d) % 24) + 24) % 24);
}

/**
 * Repair a `morningBriefHourUTC` that DST has left stale.
 *
 * Not required for correctness — `scheduledUtcHour` already ignores the stale
 * value — but it keeps the ±1 candidate window centred, and it keeps the field
 * honest for anything that reads it directly.
 */
export function healedHour(user: ScheduledUser, at: Date): number | null {
  const truth  = scheduledUtcHour(user, 0, at);
  const stored = user.notificationSettings?.morningBriefHourUTC;
  return truth !== null && truth !== stored ? truth : null;
}
