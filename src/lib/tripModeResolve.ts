/**
 * tripModeResolve.ts
 * ──────────────────
 * Works out what Trip Mode should show today — which trip, which day of it,
 * and the outfit to surface — from saved plans, closets and (only when a trip
 * covers today) a location fix.
 *
 * Shared by useTripMode on the home screen and by the background refresh
 * (lib/background/refresh.ts). Without the background caller the widget's
 * trip outfit could be overwritten by an ordinary one whenever Ojo refreshed
 * in the background mid-trip, so both paths go through this one function.
 *
 * The date ∩ proximity decisions themselves are pure and live in lib/tripMode;
 * this adds the weather and closet I/O around them.
 */

import api from '../api/client';
import { authHeaders } from './auth';
import { reportTripPresence } from './tripPresence';
import { setTripNudgePresence } from './notifications';
import {
  selectActiveTrip,
  todayDayIndex,
  findDaySnapshot,
  computeDrift,
  computeForecastDrift,
  toLocalISODate,
  DEFAULT_TRIP_MODE_RADIUS_MI,
} from './tripMode';
import {
  rehydratePlans,
  buildTripWeather,
  activeOutfit,
  daysUntil,
  planArticleIds,
  isInForecastWindow,
} from '../views/TripFit/shared';
import { generateOutfits } from './outfitEngine';
import type { LatLon } from './geo';
import type {
  Closet,
  ClothingArticle,
  CurrentWeather,
  DailyForecast,
  SavedTripFitPlan,
  Settings,
} from '../types';
import type { OutfitResult } from './outfit/types';

export interface ResolvedTripMode {
  active: boolean;
  trip: SavedTripFitPlan | null;
  /** True only when live GPS confirmed the user is at/near the trip city. */
  locationConfirmed: boolean;
  distanceMi: number | null;
  dayIndex: number;
  total: number;
  outfit: OutfitResult | null;
  /** Where the outfit came from — a logged plan day, or generated live. */
  source: 'logged' | 'generated' | null;
  driftNote: string | null;
  closetId: string;
  closetName: string;
}

export const INACTIVE_TRIP_MODE: ResolvedTripMode = {
  active: false,
  trip: null,
  locationConfirmed: false,
  distanceMi: null,
  dayIndex: 0,
  total: 0,
  outfit: null,
  source: null,
  driftNote: null,
  closetId: '',
  closetName: '',
};

/**
 * What a resolution established about where the device is:
 *   - a trip id: GPS put it at that trip's destination;
 *   - null: there is nothing to be present at (Trip Mode off, no trip today,
 *     or GPS put it at none of the trip cities);
 *   - undefined: no GPS-backed answer, so any standing confirmation is left
 *     to expire on the server's schedule rather than replaced by a guess.
 */
export type TripPresenceVerdict = string | null | undefined;

export interface TripModeResolution {
  state: ResolvedTripMode;
  presence: TripPresenceVerdict;
}

export interface ResolveTripModeInput {
  plans: SavedTripFitPlan[];
  closets: Closet[];
  settings: Settings;
  /** Called only when a trip's dates cover today, so users who aren't mid-trip
   *  never trigger a location request from this feature. */
  getGps: () => Promise<LatLon | null>;
  todayISO?: string;
}

export async function resolveTripMode({
  plans,
  closets,
  settings,
  getGps,
  todayISO = toLocalISODate(),
}: ResolveTripModeInput): Promise<TripModeResolution> {
  const enabled = settings.tripModeEnabled !== false; // default on
  const radiusMi = settings.tripModeRadiusMi ?? DEFAULT_TRIP_MODE_RADIUS_MI;

  // Trip Mode off is the user saying don't treat me as travelling: withdraw
  // any standing confirmation so neither the server nor the morning nudges
  // keep acting on it.
  if (!enabled) return { state: INACTIVE_TRIP_MODE, presence: null };

  // Cheap pre-check with no GPS: bail (and skip the location request) unless a
  // trip's date window covers today. Nothing is running, so there is nothing
  // to be present at.
  if (!selectActiveTrip(plans, todayISO, null, radiusMi)) {
    return { state: INACTIVE_TRIP_MODE, presence: null };
  }

  const gps = await getGps();
  const sel = selectActiveTrip(plans, todayISO, gps, radiusMi);
  if (!sel) {
    // Only GPS can produce this: the date pre-check above already passed, so a
    // trip covers today and the fix put the user at none of their trip
    // cities. That is a real answer — notifications about that city stop.
    return { state: INACTIVE_TRIP_MODE, presence: null };
  }

  const { trip, locationConfirmed, distanceMi } = sel;
  // Report only a GPS-backed verdict. Without a fix, `sel` is the date-only
  // fallback — enough to show the card the user asked for, not enough to
  // vouch for their whereabouts to the server.
  const presence: TripPresenceVerdict = locationConfirmed ? trip.id : undefined;
  const { index, total } = todayDayIndex(trip, todayISO);

  const closet =
    closets.find((c) => c._id === trip.closetId) ??
    closets.find((c) => c.isPreferred) ??
    closets[0] ??
    null;
  const articles: ClothingArticle[] = closet?.articles ?? [];

  let outfit: OutfitResult | null = null;
  let source: 'logged' | 'generated' | null = null;
  let driftNote: string | null = null;

  const daySnap = findDaySnapshot(trip, todayISO);

  if (daySnap) {
    // Logged path: show the outfit TripFit saved for today.
    const dayPlans = rehydratePlans(trip, articles);
    const dp = dayPlans.find((p) => p.day.date === todayISO);
    outfit = dp ? activeOutfit(dp) : null;
    source = 'logged';
    // Compare against live weather for a drift flag (best-effort).
    try {
      const { data } = await api.get<CurrentWeather>('/api/weather/current', {
        params: { lat: trip.lat, lon: trip.lon },
        ...authHeaders(),
      });
      if (data) driftNote = computeDrift(daySnap, data);
    } catch {
      /* drift is optional — ignore weather failures */
    }
  } else {
    // Gap-fill path: no logged outfit (pending trip) — build one live.
    source = 'generated';
    try {
      const { data } = await api.get<DailyForecast[]>('/api/weather/daily', {
        params: { lat: trip.lat, lon: trip.lon },
        ...authHeaders(),
      });
      const days = data ?? [];
      const today =
        days.find((d) => d.date === todayISO) ??
        days.find((d) => d.date >= todayISO) ??
        days[0];
      if (today) {
        const { results } = generateOutfits(
          articles,
          buildTripWeather(today),
          { ...settings, occasion: trip.occasion },
          new Set(),
          5,
        );
        outfit = results[0] ?? null;
      }
    } catch {
      /* leave outfit null — card shows a graceful empty state */
    }
  }

  return {
    state: {
      active: true,
      trip,
      locationConfirmed,
      distanceMi,
      dayIndex: index,
      total,
      outfit,
      source,
      driftNote,
      closetId: closet?._id ?? trip.closetId,
      closetName: closet?.name ?? 'Trip',
    },
    presence,
  };
}

/**
 * Send a verdict to its two consumers: the server's notification passes, and
 * this device's Trip Mode morning nudges, whose mornings after the first wait
 * for a confirmation (lib/notifications.ts · setTripNudgePresence).
 */
export const applyTripPresence = (
  verdict: TripPresenceVerdict,
  plans: SavedTripFitPlan[],
): void => {
  if (verdict === undefined) return;
  reportTripPresence(verdict).catch(() => {});
  setTripNudgePresence(verdict, plans).catch(() => {});
};

// ─── Upcoming trip (Trip Countdown widget) ────────────────────────────────────

export interface UpcomingTripBase {
  plan: SavedTripFitPlan;
  /** Whole days from today to the trip's start date (always > 0). */
  daysUntil: number;
  /** Unique packable article count across the trip's planned days (0 while pending). */
  totalItems: number;
  packedItems: number;
}

/** Soonest saved trip that hasn't started yet. A pure function of plans + today. */
export const nextUpcomingTrip = (
  plans: SavedTripFitPlan[],
  settings: Pick<Settings, 'tripModeEnabled'>,
): UpcomingTripBase | null => {
  if (settings.tripModeEnabled === false) return null;
  const next = plans
    .map((plan) => ({ plan, days: daysUntil(plan.startDate) }))
    .filter(({ days }) => days > 0)
    .sort((a, b) => a.days - b.days)[0];
  if (!next) return null;
  return {
    plan: next.plan,
    daysUntil: next.days,
    totalItems: planArticleIds(next.plan).length,
    packedItems: next.plan.checkedIds.length,
  };
};

/** Only a planned trip inside the forecast window has a saved forecast to drift from. */
export const upcomingDriftApplies = (plan: SavedTripFitPlan | null | undefined): boolean =>
  !!plan && plan.days.length > 0 && isInForecastWindow(plan.startDate);

/**
 * Re-fetch the destination's forecast and compare the arrival day against the
 * one saved with the plan. Null when there's nothing to say; throws on a
 * network failure so a caller can keep its last answer.
 */
export const fetchUpcomingDrift = async (plan: SavedTripFitPlan): Promise<string | null> => {
  if (!upcomingDriftApplies(plan)) return null;
  const arrival = plan.days.find((d) => d.date === plan.startDate) ?? plan.days[0];
  const { data } = await api.get<DailyForecast[]>('/api/weather/daily', {
    params: { lat: plan.lat, lon: plan.lon },
    ...authHeaders(),
  });
  const fresh = (data ?? []).find((d) => d.date === arrival.date);
  return fresh ? computeForecastDrift(arrival, fresh) : null;
};
