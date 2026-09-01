/**
 * useSameDayNudgeScheduler
 * ─────────────────────────
 * Keeps today's Same-Day Weather Nudges topped up.
 *
 * Unlike useMorningBriefScheduler, this doesn't generate anything of its own:
 * OutfitSuggestion already runs generateOutfits() with live current weather and
 * real hourly forecasts to produce outfits[0], so outfits[0].layering.timeline
 * is already today's real, hour-precise timeline. This hook just filters it
 * (lib/sameDayNudge.ts) and schedules whatever qualifies (lib/notifications.ts).
 *
 * Kept as its own hook rather than folded into useMorningBriefScheduler so a
 * bug in one scheduler's effect can't silently stop the other — independent
 * useEffects, independent dependency arrays.
 *
 * Same accepted cost as the Brief: only reschedules while the app is open, on
 * the home screen. There is no background task in this app. Forecast staleness
 * (the 12° drop this flags might really be 8° by afternoon) isn't re-validated
 * mid-day — every reopen naturally supersedes a stale schedule via the same
 * cancel-then-rebuild scheduleSameDayNudges already does on every call.
 */

import { useEffect, useRef } from 'react';
import { InteractionManager } from 'react-native';
import api from '../api/client';
import { authHeaders, getToken } from '../lib/auth';
import { useActiveLocation } from '../context/ActiveLocationContext';
import { CURRENT_LOCATION_ID } from '../lib/savedLocations';
import { selectNudgeworthySteps, buildNudgeContent } from '../lib/sameDayNudge';
import { scheduleSameDayNudges, type SameDayNudgeItem } from '../lib/notifications';
import type { OutfitResult } from '../lib/outfitEngine';
import type { NotificationSettings } from '../types';

/** Local calendar date as "YYYY-MM-DD" — must match SameDayNudgeItem.dateISO. */
const localISODate = (d: Date): string => {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

export interface SameDayNudgeSchedulerInput {
  /** outfits[0] from OutfitSuggestion — already generated, not regenerated here. */
  outfit: OutfitResult | null;
  city?: string;
  /** False while weather/closets are still settling. */
  ready: boolean;
}

export function useSameDayNudgeScheduler({
  outfit,
  city,
  ready,
}: SameDayNudgeSchedulerInput): void {
  const { activeId } = useActiveLocation();
  // Same fetch-once-per-mount reasoning as useMorningBriefScheduler: notification
  // settings live on the server and change rarely.
  const notifSettings = useRef<NotificationSettings | null>(null);

  useEffect(() => {
    if (!ready) return;
    if (!getToken()) return;
    if (activeId !== CURRENT_LOCATION_ID) return; // don't nudge off a browsed city
    if (!outfit?.layering?.timeline?.length) return;

    let cancelled = false;

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
        if (!ns?.sameDayNudgeEnabled) {
          // Don't cancel here — reconcileSameDayNudges owns the cross-device
          // off switch at launch, and cancelling on every sync would fight it.
          return;
        }

        const now = new Date();
        const dateISO = localISODate(now);
        const candidates = selectNudgeworthySteps(outfit.layering!.timeline, now);

        const items: SameDayNudgeItem[] = candidates.map(({ step }) => ({
          dateISO,
          hour: step.hour,
          ...buildNudgeContent({ step, city }),
        }));

        if (cancelled) return;
        await scheduleSameDayNudges(items);
      } catch {
        // Best-effort. A failed reschedule leaves the previous set intact,
        // which is strictly better than tearing it down.
      }
    });

    return () => {
      cancelled = true;
      task.cancel();
    };
  }, [ready, activeId, outfit, city]);
}
