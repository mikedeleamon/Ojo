/**
 * tripMode.ts — pure Trip Mode selection logic (no I/O).
 *
 * Trip Mode surfaces the outfit TripFit already logged for *today* when the user
 * is in (or near) a saved trip's destination during its date window. The pure
 * functions here decide *which* trip is active and *what* today looks like, given
 * data the caller has already loaded (plans, GPS, the day's live weather). The
 * GPS / weather / closet I/O lives in useTripMode; keeping this layer pure makes
 * the date∩proximity rules unit-testable without mocking native modules.
 */

import type { CurrentWeather, SavedTripFitPlan, TripFitDaySnapshot } from '../types';
import { haversineMi, type LatLon } from './geo';

/** Default "nearby" radius, in miles. Configurable via settings.tripModeRadiusMi. */
export const DEFAULT_TRIP_MODE_RADIUS_MI = 30;

/** A live current-weather reading diverges from the logged plan by at least this. */
const DRIFT_TEMP_THRESHOLD_F = 12;

const MS_DAY = 86_400_000;

/** Local yyyy-mm-dd for a Date, using local calendar components (not UTC). */
export const toLocalISODate = (d: Date = new Date()): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`;

/** Whole calendar days between two ISO yyyy-mm-dd dates (b − a). */
const isoDayDiff = (a: string, b: string): number => {
  const da = new Date(a + 'T12:00:00').getTime();
  const db = new Date(b + 'T12:00:00').getTime();
  return Math.round((db - da) / MS_DAY);
};

/** True when `todayISO` falls within [startDate, endDate] (inclusive). */
const coversToday = (plan: SavedTripFitPlan, todayISO: string): boolean =>
  plan.startDate <= todayISO && todayISO <= plan.endDate;

export interface ActiveTripSelection {
  trip: SavedTripFitPlan;
  /** True only when live GPS confirmed the user is within radius of the trip. */
  locationConfirmed: boolean;
  /** Distance to the trip city in miles, when GPS was available; else null. */
  distanceMi: number | null;
}

/**
 * Pick the trip Trip Mode should surface today, or null if none apply.
 *
 * - With GPS: prefer the *nearest* overlapping trip within `radiusMi` and mark it
 *   location-confirmed. If GPS is available but the user isn't near any trip city,
 *   fall back to the soonest-starting overlapping trip as an unconfirmed,
 *   date-only prompt.
 * - Without GPS: return the soonest-starting overlapping trip, unconfirmed.
 */
export const selectActiveTrip = (
  plans: SavedTripFitPlan[],
  todayISO: string,
  gps: LatLon | null,
  radiusMi: number = DEFAULT_TRIP_MODE_RADIUS_MI,
): ActiveTripSelection | null => {
  const overlapping = plans
    .filter((p) => coversToday(p, todayISO))
    .sort((a, b) => a.startDate.localeCompare(b.startDate));

  if (overlapping.length === 0) return null;

  if (gps) {
    let nearest: SavedTripFitPlan | null = null;
    let nearestMi = Infinity;
    for (const trip of overlapping) {
      const d = haversineMi(gps, { lat: trip.lat, lon: trip.lon });
      if (d < nearestMi) {
        nearestMi = d;
        nearest = trip;
      }
    }
    if (nearest && nearestMi <= radiusMi) {
      return { trip: nearest, locationConfirmed: true, distanceMi: nearestMi };
    }
    // GPS available but user isn't near any trip city → date-only soft prompt.
    return {
      trip: overlapping[0],
      locationConfirmed: false,
      distanceMi: Number.isFinite(nearestMi) ? nearestMi : null,
    };
  }

  // No GPS → unconfirmed date-only prompt for the soonest overlapping trip.
  return { trip: overlapping[0], locationConfirmed: false, distanceMi: null };
};

/** "Day {index} of {total}" position of today within the trip (1-based). */
export const todayDayIndex = (
  trip: SavedTripFitPlan,
  todayISO: string,
): { index: number; total: number } => {
  const total = Math.max(1, isoDayDiff(trip.startDate, trip.endDate) + 1);
  const index = Math.min(
    total,
    Math.max(1, isoDayDiff(trip.startDate, todayISO) + 1),
  );
  return { index, total };
};

/** The logged day snapshot for `todayISO`, if the trip has one with an outfit. */
export const findDaySnapshot = (
  trip: SavedTripFitPlan,
  todayISO: string,
): TripFitDaySnapshot | null => {
  const day = trip.days.find((d) => d.date === todayISO);
  return day && day.articleIds.length > 0 ? day : null;
};

/**
 * Compare the logged forecast for a day against the actual current weather and
 * return a short, actionable drift note — or null when they roughly agree.
 * Precipitation onset is flagged first (most actionable), then temperature.
 */
export const computeDrift = (
  day: TripFitDaySnapshot,
  live: CurrentWeather,
): string | null => {
  const liveTempF = Math.round(live.Temperature.Imperial.Value);
  const plannedMid = (day.minTempF + day.maxTempF) / 2;
  const diff = liveTempF - plannedMid;

  if (live.HasPrecipitation && !day.hasPrecipitation) {
    return 'Rain moved in since you planned — grab a layer or umbrella.';
  }
  if (diff >= DRIFT_TEMP_THRESHOLD_F) {
    return `Warmer than planned (now ${liveTempF}°F) — consider lighter layers.`;
  }
  if (diff <= -DRIFT_TEMP_THRESHOLD_F) {
    return `Colder than planned (now ${liveTempF}°F) — add a warm layer.`;
  }
  if (!live.HasPrecipitation && day.hasPrecipitation) {
    return 'Drier than forecast — you may not need rain gear today.';
  }
  return null;
};
