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
 * 1. This is the foreground half. The background refresh
 *    (lib/background/refresh.ts) rebuilds the same window from the same
 *    builder (lib/morningBriefDays.ts) when iOS gives Ojo background time or,
 *    with "Always" location, when the phone leaves the area it was last in.
 *    Without either, the window only advances while the app is open, and
 *    BRIEF_WINDOW_DAYS (3) is the grace period that buys — see the note on it
 *    in lib/notifications.ts for why it isn't longer.
 *
 * 2. It's gated to the user's primary location. If you're browsing Tokyo's
 *    weather from Brooklyn, `daily` is Tokyo's, and scheduling off it would
 *    quietly rewrite your upcoming mornings with another city's forecast. When
 *    a saved city is active the existing window is left alone rather than
 *    cancelled — browsing is not a statement about where you'll wake up.
 */

import { useEffect, useRef } from 'react';
import api from '../api/client';
import { authHeaders, getToken } from '../lib/auth';
import { useActiveLocation } from '../context/ActiveLocationContext';
import { CURRENT_LOCATION_ID } from '../lib/savedLocations';
import { buildBriefDays, briefLocalHour } from '../lib/morningBriefDays';
import { scheduleMorningBriefs } from '../lib/notifications';
import type { RecentlyWorn } from '../lib/outfit/types';
import type { UserPreferenceProfile } from '../lib/userPreferences';
import type {
  ClothingArticle,
  DailyForecast,
  NotificationSettings,
  Settings,
} from '../types';
import { runAfterInteractions } from '../lib/runAfterInteractions';

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
    const task = runAfterInteractions(async () => {
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

        const days = await buildBriefDays({
          daily,
          articles,
          settings,
          worn,
          profile,
          city,
          lat,
          lon,
          ns,
          isCancelled: () => cancelled,
        });
        if (cancelled || !days || days.length === 0) return;

        await scheduleMorningBriefs({
          enabled: true,
          localHour: briefLocalHour(ns),
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
