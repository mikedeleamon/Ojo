/**
 * useMorningBriefScheduler
 * ────────────────────────
 * Keeps the rolling window of Morning Outfit Brief notifications topped up.
 *
 * Runs alongside the widget snapshot sync in OutfitSuggestion, off the same
 * settled data, because that's the one place in the app that holds weather,
 * closet, wear history and preference profile at once. Copy lives in
 * lib/morningBrief.ts; the schedule/cancel primitives live in lib/notifications.ts.
 *
 * ─── Two things worth knowing ───────────────────────────────────────────────
 *
 * 1. It only reschedules while the app is open, on the home screen. That's the
 *    accepted cost of a client-scheduled notification, and BRIEF_WINDOW_DAYS is
 *    the grace period it buys (a week). Nothing here can refresh in the
 *    background — there is no background task in this app.
 *
 * 2. It's gated to the user's primary location. If you're browsing Tokyo's
 *    weather from Brooklyn, `daily` is Tokyo's, and scheduling off it would
 *    quietly rewrite a week of your mornings with another city's forecast. When
 *    a saved city is active the existing window is left alone rather than
 *    cancelled — browsing is not a statement about where you'll wake up.
 */

import { useEffect, useRef } from 'react';
import { InteractionManager } from 'react-native';
import api from '../api/client';
import { authHeaders, getToken } from '../lib/auth';
import { useActiveLocation } from '../context/ActiveLocationContext';
import { CURRENT_LOCATION_ID } from '../lib/savedLocations';
import { buildDayOutfit } from '../lib/outfit/dayOutfit';
import { buildBriefContent } from '../lib/morningBrief';
import {
  BRIEF_WINDOW_DAYS,
  scheduleMorningBriefs,
  utcHourToLocal,
  type BriefDay,
} from '../lib/notifications';
import type { RecentlyWorn } from '../lib/outfit/types';
import type { UserPreferenceProfile } from '../lib/userPreferences';
import type {
  ClothingArticle,
  DailyForecast,
  Forecast,
  NotificationSettings,
  Settings,
} from '../types';

/** Local calendar date as "YYYY-MM-DD" — must match DailyForecast.date. */
const localISODate = (d: Date): string => {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

/**
 * Hours belonging to one local calendar day.
 *
 * The 36-hour window only ever fully covers tomorrow, so in practice this
 * returns a useful set for exactly one day and nothing for the rest — which is
 * the intended fidelity gradient, not a bug. Below MIN_HOURS_FOR_TIMELINE a
 * partial day would produce a timeline built on a few stray hours, so we hand
 * back nothing and let the copy fall back to the steady-day phrasing.
 */
const MIN_HOURS_FOR_TIMELINE = 6;

const hoursForDate = (forecasts: Forecast[], dateISO: string): Forecast[] | undefined => {
  const hours = forecasts.filter(f => {
    const t = new Date(f.DateTime);
    return !isNaN(t.getTime()) && localISODate(t) === dateISO;
  });
  return hours.length >= MIN_HOURS_FOR_TIMELINE ? hours : undefined;
};

/** The next BRIEF_WINDOW_DAYS calendar dates, starting tomorrow. */
const upcomingDates = (): string[] => {
  const now = new Date();
  return Array.from({ length: BRIEF_WINDOW_DAYS }, (_, i) =>
    // Calendar arithmetic rather than +24h, so a DST shift can't skip or repeat
    // a date — same reasoning as tomorrowDailyFor in lib/widget/buildInput.
    localISODate(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1 + i)),
  );
};

export interface MorningBriefSchedulerInput {
  daily: DailyForecast[] | undefined;
  articles: ClothingArticle[];
  settings: Settings;
  worn: RecentlyWorn;
  profile: UserPreferenceProfile;
  city?: string;
  lat?: number;
  lon?: number;
  /** False while weather/closets are still settling — avoids scheduling off a
   *  half-loaded closet and then immediately replacing it. */
  ready: boolean;
}

export function useMorningBriefScheduler({
  daily,
  articles,
  settings,
  worn,
  profile,
  city,
  lat,
  lon,
  ready,
}: MorningBriefSchedulerInput): void {
  const { activeId } = useActiveLocation();
  // Notification settings live on the server and change rarely. Fetched once per
  // mount rather than per data change, so a weather refresh doesn't re-hit the API.
  const notifSettings = useRef<NotificationSettings | null>(null);

  useEffect(() => {
    if (!ready) return;
    if (!getToken()) return;
    if (activeId !== CURRENT_LOCATION_ID) return;
    if (!daily || daily.length === 0) return;
    if (typeof lat !== 'number' || typeof lon !== 'number') return;

    let cancelled = false;

    // Generating up to 7 outfits is far too much to put on the render path — the
    // single tomorrow run was already deferred for this reason.
    const task = InteractionManager.runAfterInteractions(async () => {
      try {
        if (!notifSettings.current) {
          const { data } = await api.get<NotificationSettings>(
            '/api/notifications/settings',
            authHeaders(),
          );
          if (cancelled) return;
          notifSettings.current = data ?? null;
        }
        const ns = notifSettings.current;
        if (!ns?.morningBriefEnabled) {
          // Don't cancel here — reconcileMorningBriefs owns the cross-device
          // off switch at launch, and cancelling on every sync would fight it.
          return;
        }

        // Only fetch the wider window when there's actually a brief to build.
        // Hits the server's existing bundle cache, so this costs no WeatherKit
        // call — see HOURLY_WINDOW_H in server/src/lib/weatherKit.ts.
        let extended: Forecast[] = [];
        try {
          const { data } = await api.get<Forecast[]>('/api/weather/hourly', {
            params: { lat, lon, hours: 36 },
          });
          if (cancelled) return;
          extended = data ?? [];
        } catch {
          // Degrade to no timeline rather than no brief.
        }

        const byDate = new Map(daily.map(d => [d.date, d]));
        const days: BriefDay[] = [];

        for (const dateISO of upcomingDates()) {
          const day = byDate.get(dateISO);
          if (!day) continue; // outside the 10-day forecast

          const outfit = buildDayOutfit({
            articles,
            day,
            settings,
            worn,
            profile,
            forecasts: hoursForDate(extended, dateISO),
          });

          const { title, body } = buildBriefContent({
            day,
            outfit,
            city,
            settings,
            swing: {
              enabled: ns.tempSwingEnabled ?? false,
              thresholdF: ns.tempSwingThresholdF ?? 20,
            },
          });

          days.push({ dateISO, title, body });
        }

        if (cancelled || days.length === 0) return;

        await scheduleMorningBriefs({
          enabled: true,
          // Same preference order as NotificationsScreen: the hour the user
          // picked, falling back to deriving it only for accounts that predate
          // morningBriefHourLocal. These are local notifications scheduled with
          // a wall-clock hour, so the OS already handles DST for them — the
          // stale value being avoided here is the derivation, not the trigger.
          localHour: ns.morningBriefHourLocal ??
                     Math.round(utcHourToLocal(ns.morningBriefHourUTC ?? 12)),
          days,
        });
      } catch {
        // Best-effort. A failed reschedule leaves the previous window intact,
        // which is strictly better than tearing it down.
      }
    });

    return () => {
      cancelled = true;
      task.cancel();
    };
  }, [ready, activeId, daily, articles, settings, worn, profile, city, lat, lon]);
}
