import { useState, useEffect, useCallback } from 'react';
import { SavedTripFitPlan } from '../types';
import { loadPlans, upsertPlan, deletePlan } from '../lib/tripStorage';
import {
    scheduleTripReminders,
    cancelTripReminders,
    scheduleTripMorningNotifications,
    cancelTripMorningNotifications,
} from '../lib/notifications';
import { tripFitStatus } from '../views/TripFit/shared';

// Launch-scoped guard: the morning-notification reconciliation below only needs
// to run once per app process. useTripPlans mounts on several screens (via
// useTripMode on Home, TripFit, etc.), and each mount used to re-schedule every
// plan's notifications — redundant native calls on every navigation to those
// screens. Mutations (upsert/remove) still (re)schedule their own plan directly.
let reconciledThisLaunch = false;

interface UseTripPlansResult {
    plans: SavedTripFitPlan[];
    loading: boolean;
    /** Create or update a plan; persists, then (re)schedules its reminders. */
    upsert: (plan: SavedTripFitPlan) => Promise<SavedTripFitPlan>;
    remove: (id: string) => Promise<void>;
    refresh: () => void;
}

/**
 * Loads the user's saved TripFit plans (local-first, server-synced) and exposes
 * create/update/delete. Packing reminders are (re)scheduled here so every code
 * path that mutates a plan keeps notifications in sync.
 */
export function useTripPlans(): UseTripPlansResult {
    const [plans, setPlans] = useState<SavedTripFitPlan[]>([]);
    const [loading, setLoading] = useState(true);
    const [key, setKey] = useState(0);

    const refresh = useCallback(() => setKey((k) => k + 1), []);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        loadPlans()
            .then((p) => {
                if (!cancelled) setPlans(p);
                // Reconcile Trip Mode morning nudges once per launch: scheduling
                // is idempotent (cancels-then-reschedules) and self-gates on the
                // local pref + permission, so this also retro-schedules trips
                // saved before the feature/toggle was enabled. Gated so remounts
                // on other screens don't repeat the native scheduling calls.
                if (!reconciledThisLaunch) {
                    reconciledThisLaunch = true;
                    for (const plan of p) {
                        if (tripFitStatus(plan) !== 'completed') {
                            scheduleTripMorningNotifications(plan).catch(() => {});
                        }
                    }
                }
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [key]);

    const upsert = useCallback(async (plan: SavedTripFitPlan) => {
        const saved = await upsertPlan(plan);
        setPlans((prev) => {
            const idx = prev.findIndex((p) => p.id === saved.id);
            const next =
                idx >= 0
                    ? prev.map((p) => (p.id === saved.id ? saved : p))
                    : [...prev, saved];
            return next.sort((a, b) => a.startDate.localeCompare(b.startDate));
        });
        // Only schedule reminders for trips that haven't already finished.
        if (tripFitStatus(saved) !== 'completed') {
            scheduleTripReminders(saved).catch(() => {});
            scheduleTripMorningNotifications(saved).catch(() => {});
        } else {
            cancelTripReminders(saved.id).catch(() => {});
            cancelTripMorningNotifications(saved.id).catch(() => {});
        }
        return saved;
    }, []);

    const remove = useCallback(async (id: string) => {
        await deletePlan(id);
        setPlans((prev) => prev.filter((p) => p.id !== id));
        cancelTripReminders(id).catch(() => {});
        cancelTripMorningNotifications(id).catch(() => {});
    }, []);

    return { plans, loading, upsert, remove, refresh };
}
