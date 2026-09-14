/**
 * Which city the server should talk about when it pushes weather.
 *
 * The problem this solves: every server-sent weather notification read
 * `user.settings.location`, the user's *home* city, with no idea that the user
 * had a saved trip running. Someone in Ocho Rios for three days got "Rain is
 * moving into Arlington. Grab a jacket if you're heading out." — accurate about
 * a place 1,500 miles away, and useless to the person holding the phone.
 *
 * A trip qualifies on two counts, and needs both:
 *
 *   1. DATES. Its range covers the user's own local date.
 *   2. PRESENCE. The device has confirmed, from a GPS fix inside Trip Mode's
 *      radius of that city, that it is actually there (`user.tripPresence`,
 *      posted by src/hooks/useTripMode.ts).
 *
 * Dates alone were not enough. A date range says the user *planned* to be
 * somewhere, not that they went, so a trip saved and then cancelled would have
 * moved every weather notification to a city they never reached for the length
 * of its range — trading a wrong city for a different wrong city. The device is
 * the only thing that knows where it is, so it is the thing that gets asked.
 *
 * The cost of requiring confirmation is that a user who never opens the app
 * during their trip keeps getting home-city weather, because nothing ever
 * confirmed they left. That is the safe direction to fail: it is the old
 * behaviour, for someone not using the app, rather than confident copy about a
 * city nobody can vouch for.
 *
 * Confirmations expire. The client re-posts every few hours while Trip Mode
 * resolves, and clears immediately when GPS puts the user near none of their
 * trip cities — but a phone that goes quiet (home early, airplane mode, battery
 * dead) posts nothing at all, so an unrefreshed confirmation stops counting on
 * its own after TRIP_PRESENCE_TTL_MS.
 */

import TripFitPlan, { ITripFitPlan } from '../models/TripFitPlan';
import { isValidTimeZone, localDateISO } from './timeZone';

/** Anything with a trip's date range — keeps the selection testable. */
export interface DateRange {
  startDate: string;   // ISO yyyy-mm-dd
  endDate:   string;   // ISO yyyy-mm-dd
}

/** The place a notification should describe, and where it came from. */
export interface WeatherLocation {
  city: string;
  lat:  number;
  lon:  number;
  /** The trip's clientId when this is a trip city; absent for the home city. */
  tripId?: string;
}

/** True when `todayISO` falls within [startDate, endDate], inclusive. */
const coversToday = (plan: DateRange, todayISO: string): boolean =>
  plan.startDate <= todayISO && todayISO <= plan.endDate;

/**
 * The trip covering `todayISO`, or null. Overlapping trips resolve to the
 * soonest-starting one — the same tie-break the client's GPS-less fallback uses,
 * so both sides name the same city on a day two saved trips overlap.
 */
export const selectActiveTrip = <T extends DateRange>(
  plans: T[],
  todayISO: string,
): T | null => {
  const overlapping = plans
    .filter((p) => coversToday(p, todayISO))
    .sort((a, b) => a.startDate.localeCompare(b.startDate));
  return overlapping[0] ?? null;
};

/**
 * How long a device's presence confirmation stays good for.
 *
 * The client re-posts every few hours while a trip is being confirmed, so this
 * only has to outlast a normal gap in app usage — an evening confirmation
 * should still vouch for the next morning's notification. Two days leaves room
 * for several missed refreshes while still bounding how long a trip cut short
 * in silence can keep steering copy.
 */
export const TRIP_PRESENCE_TTL_MS = 48 * 60 * 60 * 1_000;

/** Does this user's stored confirmation vouch for `tripId`, right now? */
export const confirmsTrip = (
  presence: { tripId?: string; confirmedAt?: Date } | null | undefined,
  tripId: string,
  at: Date = new Date(),
): boolean => {
  if (!presence?.tripId || !presence.confirmedAt) return false;
  if (presence.tripId !== tripId) return false;
  const age = at.getTime() - new Date(presence.confirmedAt).getTime();
  // A confirmation dated in the future is a clock problem, not evidence.
  return age >= 0 && age < TRIP_PRESENCE_TTL_MS;
};

/** Shift an ISO yyyy-mm-dd date by whole days. */
const shiftISO = (iso: string, days: number): string => {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

/**
 * Today's date for `user`, in their own zone.
 *
 * Accounts predating `settings.timeZone` fall back to the UTC date. The error
 * that introduces is bounded to the opening and closing hours of a trip — the
 * worst case is the far side of the date line treating the first or last day as
 * not-a-trip-day — and those accounts are the same ones already falling back to
 * a stored UTC hour for scheduling.
 */
export const userToday = (
  user: { settings?: { timeZone?: string } },
  at: Date = new Date(),
): string => {
  const tz = user.settings?.timeZone;
  return localDateISO(isValidTimeZone(tz) ? tz : 'UTC', at);
};

/**
 * The trip each user is confirmed to be on, keyed by user id — one query for
 * everyone rather than one per user, since these run inside an hourly cron over
 * every user in the current hour bucket.
 *
 * The query widens the window by a day on each side because "today" is a
 * different date for a user in Auckland than one in Honolulu; the exact,
 * per-user date is applied by `selectActiveTrip`, and the device's own
 * confirmation by `confirmsTrip`.
 */
export const loadConfirmedTrips = async (
  users: {
    _id: unknown;
    settings?: { timeZone?: string };
    tripPresence?: { tripId?: string; confirmedAt?: Date };
  }[],
  at: Date = new Date(),
): Promise<Map<string, ITripFitPlan>> => {
  const byUser = new Map<string, ITripFitPlan>();
  if (users.length === 0) return byUser;

  const utcToday = localDateISO('UTC', at);
  const plans = await TripFitPlan.find({
    userId:    { $in: users.map((u) => u._id) },
    startDate: { $lte: shiftISO(utcToday, 1) },
    endDate:   { $gte: shiftISO(utcToday, -1) },
  }).lean<ITripFitPlan[]>();
  if (plans.length === 0) return byUser;

  const plansByUser = new Map<string, ITripFitPlan[]>();
  for (const plan of plans) {
    const key = String(plan.userId);
    const list = plansByUser.get(key);
    if (list) list.push(plan);
    else plansByUser.set(key, [plan]);
  }

  for (const user of users) {
    const key = String(user._id);
    const candidates = plansByUser.get(key);
    if (!candidates) continue;
    const active = selectActiveTrip(candidates, userToday(user, at));
    // Dates put the user's trip today; only the device can say they are on it.
    if (active && confirmsTrip(user.tripPresence, active.clientId, at)) {
      byUser.set(key, active);
    }
  }
  return byUser;
};

/**
 * Where this user's weather should come from: their trip city while a trip is
 * running, their home city otherwise. Null when neither has usable coordinates
 * — the client geocodes `location` and PATCHes lat/lon up, so users on old
 * clients are skipped until they re-save their location.
 */
export const resolveWeatherLocation = (
  user: { settings?: { location?: string; lat?: number; lon?: number } },
  trip?: Pick<ITripFitPlan, 'clientId' | 'destination' | 'lat' | 'lon'> | null,
): WeatherLocation | null => {
  if (trip && typeof trip.lat === 'number' && typeof trip.lon === 'number' && trip.destination) {
    return { city: trip.destination, lat: trip.lat, lon: trip.lon, tripId: trip.clientId };
  }
  const { location, lat, lon } = user.settings ?? {};
  if (!location || typeof lat !== 'number' || typeof lon !== 'number') return null;
  return { city: location, lat, lon };
};

/**
 * Identifies the place a morning snapshot was taken, so the afternoon check can
 * tell whether its baseline is still about the same city.
 *
 * Two decimal places is ~1km: fine enough that a real move invalidates the
 * baseline, coarse enough that re-geocoding the same city doesn't.
 */
export const locationKey = (lat: number, lon: number): string =>
  `${lat.toFixed(2)},${lon.toFixed(2)}`;
