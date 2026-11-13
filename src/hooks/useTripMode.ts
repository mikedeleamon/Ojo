import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { useTripPlans } from './useTripPlans';
import { useClosets } from './useClosets';
import { useSettings } from './useSettings';
import { getCurrentLocation, type Coords } from '../lib/location';
import {
    resolveTripMode,
    applyTripPresence,
    nextUpcomingTrip,
    upcomingDriftApplies,
    fetchUpcomingDrift,
    INACTIVE_TRIP_MODE,
} from '../lib/tripModeResolve';
import { DEFAULT_TRIP_MODE_RADIUS_MI } from '../lib/tripMode';
import type { SavedTripFitPlan } from '../types';
import type { OutfitResult } from '../lib/outfit/types';

/** A saved trip that hasn't started yet — independent of whether Trip Mode is "active" today. */
export interface UpcomingTripInfo {
    plan: SavedTripFitPlan;
    /** Whole days from today to the trip's start date (always > 0). */
    daysUntil: number;
    /** Unique packable article count across the trip's planned days (0 while pending). */
    totalItems: number;
    packedItems: number;
    /**
     * Set when a fresh forecast for the arrival day has drifted from the one saved
     * with the plan. Resolved asynchronously (best-effort) — null until then, and
     * whenever the trip is pending / out of the forecast window / the forecasts agree.
     */
    driftNote: string | null;
}

export interface TripModeState {
    active: boolean;
    loading: boolean;
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
    /** The soonest saved trip that hasn't started yet, e.g. for a "days until" countdown. */
    upcoming: UpcomingTripInfo | null;
    refresh: () => void;
}

// ─── GPS fix cache ─────────────────────────────────────────────────────────────
// The resolution effect below re-runs whenever plans/closets/settings change or
// the app foregrounds, and each run requested a fresh device fix (up to an 8s
// GPS acquisition + a permission prompt on first use). During an active trip the
// user's position barely moves between these, so a fix is reused for a few
// minutes. Kept module-level so it's shared across remounts, not per-hook.
const GPS_TTL_MS = 3 * 60_000;
let gpsFix: { at: number; value: Coords | null } | null = null;

const getCachedLocation = async (timeoutMs: number): Promise<Coords | null> => {
  if (gpsFix && Date.now() - gpsFix.at < GPS_TTL_MS) return gpsFix.value;
  const value = await getCurrentLocation(timeoutMs).catch(() => null);
  gpsFix = { at: Date.now(), value };
  return value;
};

const INACTIVE = INACTIVE_TRIP_MODE;

/**
 * Detects whether Trip Mode should be showing today and resolves the outfit to
 * surface. Pure date∩proximity decisions live in lib/tripMode; this hook does the
 * GPS / weather / closet I/O around them.
 *
 * GPS is only requested when a saved trip's date window actually covers today, so
 * users who aren't mid-trip never see a location prompt from this feature.
 */
export const useTripMode = (): TripModeState => {
    const { plans, loading: plansLoading } = useTripPlans();
    const { closets, loading: closetsLoading } = useClosets();
    const { settings, settingsReady } = useSettings();

    const [resolved, setResolved] = useState<Omit<TripModeState, 'loading' | 'refresh' | 'upcoming'>>(INACTIVE);
    const [working, setWorking] = useState(true);
    const [nonce, setNonce] = useState(0);

    const refresh = useCallback(() => setNonce((n) => n + 1), []);

    const enabled = settings.tripModeEnabled !== false; // default on
    const radiusMi = settings.tripModeRadiusMi ?? DEFAULT_TRIP_MODE_RADIUS_MI;

    // The resolution effect below reads a plan's dates, coordinates, closet,
    // occasion and saved days — never `checkedIds`. Now that plans live in a
    // shared store, ticking a packing checkbox on the TripFit tab publishes a
    // new array to every consumer, and keying this effect on that array re-ran a
    // GPS fix and a full generateOutfits here for a change it cannot see. Key it
    // on everything *except* the packed set: the countdown's packed count
    // (`upcomingBase`, below) is a separate memo and still updates instantly.
    const planDigest = useMemo(
        () => JSON.stringify(plans.map(({ checkedIds, ...rest }) => rest)),
        [plans],
    );

    // The resolution effect below only re-runs when plans/closets/settings
    // change — nothing re-checks `todayISO` on its own, so a trip whose end
    // date has passed can keep showing as active if the app was simply left
    // foregrounded/backgrounded across midnight rather than relaunched.
    // Re-resolving on every foreground return closes that gap cheaply.
    const appState = useRef(AppState.currentState);
    useEffect(() => {
        const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
            if (appState.current?.match(/inactive|background/) && next === 'active') {
                refresh();
            }
            appState.current = next;
        });
        return () => sub.remove();
    }, [refresh]);

    useEffect(() => {
        let cancelled = false;

        // The decisions themselves live in lib/tripModeResolve, shared with the
        // background refresh so a mid-trip refresh can't swap the widget's trip
        // outfit for an ordinary one.
        const run = async () => {
            if (!settingsReady || plansLoading || closetsLoading) return;
            setWorking(true);

            const { state, presence } = await resolveTripMode({
                plans,
                closets,
                settings,
                getGps: async () => {
                    const gps = await getCachedLocation(8000);
                    return gps ? { lat: gps.lat, lon: gps.lng } : null;
                },
            });
            applyTripPresence(presence, plans);
            if (!cancelled) { setResolved(state); setWorking(false); }
        };

        run().catch(() => {
            if (!cancelled) { setResolved(INACTIVE); setWorking(false); }
        });

        return () => { cancelled = true; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [settingsReady, plansLoading, closetsLoading, enabled, radiusMi, planDigest, closets, nonce]);

    // Soonest saved trip that hasn't started yet. Independent of the async
    // GPS/weather resolution above — a pure function of `plans` + today's date,
    // so a countdown is available immediately without waiting on location.
    const upcomingBase = useMemo(
        () => nextUpcomingTrip(plans, { tripModeEnabled: enabled }),
        [plans, enabled],
    );

    // Forecast-drift check for the upcoming trip: re-fetch the destination's
    // daily forecast and compare the arrival day against the one saved with the
    // plan. Only meaningful for a *planned* trip inside the forecast window —
    // pending trips (no saved days / beyond the window) have nothing to drift
    // from. Best-effort and keyed by plan id + saved-forecast timestamp so it
    // runs once per plan snapshot, not on every render.
    const [upcomingDrift, setUpcomingDrift] = useState<{ planId: string; note: string | null }>({
        planId: '',
        note: null,
    });
    const driftPlanId = upcomingBase?.plan.id ?? '';
    const driftStartDate = upcomingBase?.plan.startDate ?? '';
    const driftFetchedAt = upcomingBase?.plan.forecastFetchedAt ?? '';
    const driftHasDays = (upcomingBase?.plan.days.length ?? 0) > 0;
    useEffect(() => {
        const plan = upcomingBase?.plan;
        if (!plan || !upcomingDriftApplies(plan)) {
            setUpcomingDrift({ planId: plan?.id ?? '', note: null });
            return;
        }
        let cancelled = false;
        fetchUpcomingDrift(plan)
            .then((note) => {
                if (!cancelled) setUpcomingDrift({ planId: plan.id, note });
            })
            .catch(() => {
                /* drift is optional — leave whatever was last resolved */
            });
        return () => { cancelled = true; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [driftPlanId, driftStartDate, driftFetchedAt, driftHasDays]);

    const upcoming = useMemo<UpcomingTripInfo | null>(() => {
        if (!upcomingBase) return null;
        return {
            ...upcomingBase,
            driftNote: upcomingDrift.planId === upcomingBase.plan.id ? upcomingDrift.note : null,
        };
    }, [upcomingBase, upcomingDrift]);

    return useMemo(
        () => ({ ...resolved, upcoming, loading: working, refresh }),
        [resolved, upcoming, working, refresh],
    );
};
