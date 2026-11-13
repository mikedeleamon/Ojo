/**
 * background/refresh.ts — the home screen's weather → outfit → widget →
 * notifications pass, without the home screen.
 *
 * Before this existed, all of that ran only while Home was on screen, so:
 *   - the widget kept showing the temperature, conditions and outfit from the
 *     last time the app was opened (its hourly refresh re-reads the same file);
 *   - the Morning Outfit Brief, scheduled a week ahead with its copy baked in,
 *     kept describing whatever city the app was last opened in.
 *
 * Two triggers call this (lib/background/tasks.ts):
 *   - `scheduled` — iOS background processing time, whenever iOS grants it;
 *   - `moved`     — the phone left the area it was in (needs "Always" location).
 *
 * Stages run in order of what matters most, because iOS can suspend the app at
 * any point: where the phone is (and telling the server), then the region for
 * the next move, then the widget, then the notifications. Each stage saves its
 * own result, so a cut-off run still leaves the earlier ones done.
 *
 * Every step reuses the code the foreground uses — the same outfit engine,
 * widget input builder, brief builder and Trip Mode resolver — so a background
 * refresh produces what opening the app would have.
 */

import * as Location from 'expo-location';
import { AppState } from 'react-native';
import api from '../../api/client';
import weatherConstants from '../../constants/weatherConstants';
import { authHeaders, getToken, initAuthCache } from '../auth';
import { readCachedSettings } from '../../context/SettingsContext';
import { reverseGeocode } from '../geocoding';
import { generateOutfits } from '../outfitEngine';
import { loadHistory, recentlyWornWithAge } from '../outfitHistory';
import { derivePreferenceProfile } from '../userPreferences';
import { loadLocalPlans } from '../tripStorage';
import {
  applyTripPresence,
  fetchUpcomingDrift,
  nextUpcomingTrip,
  resolveTripMode,
} from '../tripModeResolve';
import { buildWidgetInput, type WidgetOutfitStatus } from '../widget/buildInput';
import { updateWidgetSnapshot } from '../widget/updateWidgetSnapshot';
import { buildTomorrowForWidget } from '../widget/tomorrowOutfit';
import { readWornToday } from '../widget/wornToday';
import { buildBriefDays, briefLocalHour } from '../morningBriefDays';
import { buildSameDayNudgeItems } from '../sameDayNudge';
import { scheduleMorningBriefs, scheduleSameDayNudges } from '../notifications';
import { getBackgroundLocationAccess } from './locationAccess';
import { isSamePlace, readDevicePlace, rememberDevicePlace } from './devicePlace';
import { watchArea } from './geofence';
import type {
  Closet,
  CurrentWeather,
  DailyForecast,
  Forecast,
  NotificationSettings,
} from '../../types';

export type RefreshTrigger = 'scheduled' | 'moved';
export type RefreshOutcome = 'updated' | 'skipped' | 'failed';

/** How long to wait for a fresh fix before settling for the last known one. */
const FIX_TIMEOUT_MS = 10_000;
/** A last-known position older than this says nothing about where the phone is now. */
const LAST_KNOWN_MAX_AGE_MS = 15 * 60_000;

/** The exact device position, when "Always" lets the app ask for it in the background. */
const backgroundFix = async (): Promise<{ lat: number; lon: number } | null> => {
  if ((await getBackgroundLocationAccess()) !== 'always') return null;
  try {
    const fresh = await Promise.race([
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), FIX_TIMEOUT_MS)),
    ]);
    if (fresh) return { lat: fresh.coords.latitude, lon: fresh.coords.longitude };
  } catch {
    /* fall through to the last known position */
  }
  try {
    const last = await Location.getLastKnownPositionAsync({ maxAge: LAST_KNOWN_MAX_AGE_MS });
    if (last) return { lat: last.coords.latitude, lon: last.coords.longitude };
  } catch {
    /* no position at all */
  }
  return null;
};

let inFlight: Promise<RefreshOutcome> | null = null;

/**
 * Refresh the widget and notifications for where the phone is now.
 *
 * `fix` is a position the trigger already has (none today — geofence events
 * carry the region, not the device), else one is requested here. Concurrent
 * calls share one run.
 */
export function runBackgroundRefresh(input: {
  trigger: RefreshTrigger;
  fix?: { lat: number; lon: number } | null;
}): Promise<RefreshOutcome> {
  if (!inFlight) {
    inFlight = refresh(input)
      .catch((err): RefreshOutcome => {
        console.warn('[Ojo] background refresh failed:', err);
        return 'failed';
      })
      .finally(() => {
        inFlight = null;
      });
  }
  return inFlight;
}

async function refresh({
  trigger,
  fix: givenFix,
}: {
  trigger: RefreshTrigger;
  fix?: { lat: number; lon: number } | null;
}): Promise<RefreshOutcome> {
  // With the app on screen, Home is already doing all of this from live state;
  // a second writer would only race it.
  if (AppState.currentState === 'active') return 'skipped';

  // ── 1. Who and what ────────────────────────────────────────────────────────
  // A cold background launch hasn't run AuthProvider yet. Only fill an empty
  // cache: if the keychain is unreadable (locked phone) a re-read would come
  // back empty and blank the token of an app that is merely suspended.
  if (!getToken()) await initAuthCache();
  if (!getToken()) return 'skipped';
  const settings = await readCachedSettings();
  if (!settings) return 'skipped';

  // ── 2. Where the phone is ──────────────────────────────────────────────────
  const fix = givenFix ?? (await backgroundFix());
  const remembered = await readDevicePlace();
  let place: { lat: number; lon: number; name?: string } | null = null;

  if (fix) {
    const knownName =
      remembered?.name && isSamePlace(remembered, fix) ? remembered.name : undefined;
    const name = knownName ?? (await reverseGeocode(fix.lat, fix.lon)) ?? undefined;
    // Stores it for the next run without a fix, and tells the server, whose
    // weather alerts and closet-gap nudges then describe this place.
    place = await rememberDevicePlace({ ...fix, name });
    // Re-centre on the exact fix so the next move is measured from here.
    await watchArea(fix);
  } else if (remembered) {
    // No "Always" permission (or no fix): keep the last known place current
    // in time, even though it can't follow a move.
    place = remembered;
  } else if (typeof settings.lat === 'number' && typeof settings.lon === 'number') {
    place = { lat: settings.lat, lon: settings.lon, name: settings.location || undefined };
  }
  if (!place) return 'skipped';
  const city = place.name;

  // ── 3. Weather, closets, history ───────────────────────────────────────────
  const params = { params: { lat: place.lat, lon: place.lon }, ...authHeaders() };
  const [wRes, fRes, dRes, cRes] = await Promise.all([
    api.get<CurrentWeather>(weatherConstants.GET_CURRENT, params),
    api.get<Forecast[]>(weatherConstants.GET_HOURLY, params),
    api.get<DailyForecast[]>(weatherConstants.GET_DAILY, params),
    api.get<Closet[]>('/api/closets', authHeaders()),
  ]);
  const weather = wRes.data;
  if (!weather) return 'failed';
  const forecasts = fRes.data ?? [];
  const daily = dRes.data ?? [];
  const closets = cRes.data ?? [];
  const preferred = closets.find((c) => c.isPreferred) ?? null;

  const [worn, history, plans, wornToday] = await Promise.all([
    recentlyWornWithAge(7).catch(() => new Map<string, number>()),
    loadHistory().catch(() => []),
    loadLocalPlans().catch(() => []),
    readWornToday(),
  ]);
  const profile = derivePreferenceProfile(closets, history);
  const effectiveSettings = { ...settings, occasion: settings.occasion ?? 'everyday' };

  // ── 4. Today's outfits — same call and topK rule as OutfitSuggestion ──────
  let outfits: ReturnType<typeof generateOutfits>['results'] = [];
  let status: WidgetOutfitStatus = 'no_preferred';
  if (preferred) {
    const topK = Math.max(3, Math.min(5, (effectiveSettings.clothingStyles?.length ?? 0) + 1));
    const gen = generateOutfits(
      preferred.articles,
      weather,
      effectiveSettings,
      worn,
      topK,
      profile,
      forecasts,
    );
    outfits = gen.results;
    status = gen.status as WidgetOutfitStatus;
  }

  // ── 5. Trip Mode ───────────────────────────────────────────────────────────
  const { state: trip, presence } = await resolveTripMode({
    plans,
    closets,
    settings,
    // A remembered place is not a sighting; only a live fix can confirm a trip.
    getGps: async () => fix,
  });
  applyTripPresence(presence, plans);

  const upcomingBase = nextUpcomingTrip(plans, settings);
  const upcomingNote = upcomingBase
    ? await fetchUpcomingDrift(upcomingBase.plan).catch(() => null)
    : null;

  // ── 6. Widget ──────────────────────────────────────────────────────────────
  await updateWidgetSnapshot(
    buildWidgetInput({
      todayOutfits: outfits,
      wornOutfit: wornToday,
      outfitStatus: status,
      closetCount: closets.length,
      weather,
      settings,
      daily,
      city,
      trip: {
        active: trip.active,
        plan: trip.trip,
        outfit: trip.outfit,
        dayIndex: trip.dayIndex,
        total: trip.total,
        driftNote: trip.driftNote,
        locationConfirmed: trip.locationConfirmed,
      },
      upcoming: upcomingBase ? { ...upcomingBase, driftNote: upcomingNote } : null,
      tomorrow: buildTomorrowForWidget({
        daily,
        articles: preferred?.articles ?? null,
        settings: effectiveSettings,
        worn,
        profile,
      }),
    }),
  );

  // ── 7. Notifications ───────────────────────────────────────────────────────
  let ns: NotificationSettings | null = null;
  try {
    ns = (await api.get<NotificationSettings>('/api/notifications/settings', authHeaders())).data;
  } catch {
    ns = null; // leave the existing schedule alone
  }
  if (ns?.morningBriefEnabled) {
    const days = await buildBriefDays({
      daily,
      // Same as the home screen: no preferred closet still gets weather copy.
      articles: preferred?.articles ?? [],
      settings: effectiveSettings,
      worn,
      profile,
      city,
      lat: place.lat,
      lon: place.lon,
      ns,
    });
    if (days && days.length > 0) {
      await scheduleMorningBriefs({ enabled: true, localHour: briefLocalHour(ns), days });
    }
  }
  // Mirrors useSameDayNudgeScheduler: a day with no timeline leaves the set
  // alone; a day with one replaces it, even with nothing, so a change the new
  // forecast no longer shows stops being announced.
  if (ns?.sameDayNudgeEnabled && outfits[0]?.layering?.timeline?.length) {
    await scheduleSameDayNudges(buildSameDayNudgeItems(outfits[0], city, new Date()));
  }

  if (__DEV__) console.log(`[Ojo] background refresh (${trigger}) updated ${city ?? 'last place'}`);
  return 'updated';
}
