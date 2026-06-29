import { useState, useEffect, useCallback, useMemo } from 'react';
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
import { rehydratePlans, buildTripWeather, activeOutfit } from '../views/TripFit/shared';
import { generateOutfits } from '../lib/outfitEngine';
import type {
    SavedTripFitPlan,
    CurrentWeather,
    DailyForecast,
    ClothingArticle,
} from '../types';
import type { OutfitResult } from '../lib/outfit/types';

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

    const [resolved, setResolved] = useState<Omit<TripModeState, 'loading' | 'refresh'>>(INACTIVE);
    const [working, setWorking] = useState(true);
    const [nonce, setNonce] = useState(0);

    const refresh = useCallback(() => setNonce((n) => n + 1), []);

    const enabled = settings.tripModeEnabled !== false; // default on
    const radiusMi = settings.tripModeRadiusMi ?? DEFAULT_TRIP_MODE_RADIUS_MI;

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

    return useMemo(
        () => ({ ...resolved, loading: working, refresh }),
        [resolved, working, refresh],
    );
};
