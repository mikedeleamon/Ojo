import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import api from '../api/client';
import { authHeaders } from '../lib/auth';
import { useTripPlans } from './useTripPlans';
import { useClosets } from './useClosets';
import { useSettings } from './useSettings';
import { getCurrentLocation } from '../lib/location';
import {
    selectActiveTrip,
    todayDayIndex,
    findDaySnapshot,
    computeDrift,
    toLocalISODate,
    DEFAULT_TRIP_MODE_RADIUS_MI,
} from '../lib/tripMode';
import {
    rehydratePlans,
    buildTripWeather,
    activeOutfit,
    daysUntil,
    planArticleIds,
} from '../views/TripFit/shared';
import { generateOutfits } from '../lib/outfitEngine';
import type {
    SavedTripFitPlan,
    CurrentWeather,
    DailyForecast,
    ClothingArticle,
} from '../types';
import type { OutfitResult } from '../lib/outfit/types';

/** A saved trip that hasn't started yet — independent of whether Trip Mode is "active" today. */
export interface UpcomingTripInfo {
    plan: SavedTripFitPlan;
    /** Whole days from today to the trip's start date (always > 0). */
    daysUntil: number;
    /** Unique packable article count across the trip's planned days (0 while pending). */
    totalItems: number;
    packedItems: number;
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

const INACTIVE = {
    active: false as const,
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

    // The resolution effect below only re-runs when plans/closets/settings
    // change — nothing re-checks `todayISO` on its own, so a trip whose end
    // date has passed can keep showing as active if the app was simply left
    // foregrounded/backgrounded across midnight rather than relaunched.
    // Re-resolving on every foreground return closes that gap cheaply.
    const appState = useRef(AppState.currentState);
    useEffect(() => {
        const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
            if (appState.current.match(/inactive|background/) && next === 'active') {
                refresh();
            }
            appState.current = next;
        });
        return () => sub.remove();
    }, [refresh]);

    useEffect(() => {
        let cancelled = false;

        const run = async () => {
            if (!settingsReady || plansLoading || closetsLoading) return;
            setWorking(true);

            if (!enabled) {
                if (!cancelled) { setResolved(INACTIVE); setWorking(false); }
                return;
            }

            const todayISO = toLocalISODate();

            // Cheap pre-check with no GPS: bail (and skip the location prompt)
            // unless a trip's date window covers today.
            if (!selectActiveTrip(plans, todayISO, null, radiusMi)) {
                if (!cancelled) { setResolved(INACTIVE); setWorking(false); }
                return;
            }

            const gps = await getCurrentLocation(8000).catch(() => null);
            const sel = selectActiveTrip(
                plans,
                todayISO,
                gps ? { lat: gps.lat, lon: gps.lng } : null,
                radiusMi,
            );
            if (!sel) {
                if (!cancelled) { setResolved(INACTIVE); setWorking(false); }
                return;
            }

            const { trip, locationConfirmed, distanceMi } = sel;
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

            if (!cancelled) {
                setResolved({
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
                });
                setWorking(false);
            }
        };

        run().catch(() => {
            if (!cancelled) { setResolved(INACTIVE); setWorking(false); }
        });

        return () => { cancelled = true; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [settingsReady, plansLoading, closetsLoading, enabled, radiusMi, plans, closets, nonce]);

    // Soonest saved trip that hasn't started yet. Independent of the async
    // GPS/weather resolution above — a pure function of `plans` + today's date,
    // so a countdown is available immediately without waiting on location.
    const upcoming = useMemo<UpcomingTripInfo | null>(() => {
        if (!enabled) return null;
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
    }, [plans, enabled]);

    return useMemo(
        () => ({ ...resolved, upcoming, loading: working, refresh }),
        [resolved, upcoming, working, refresh],
    );
};
