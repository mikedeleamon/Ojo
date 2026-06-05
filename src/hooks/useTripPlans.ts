import { useState, useEffect, useCallback } from 'react';
import { SavedTripFitPlan } from '../types';
import { loadPlans, upsertPlan, deletePlan } from '../lib/tripStorage';
import { scheduleTripReminders, cancelTripReminders } from '../lib/notifications';
import { tripFitStatus } from '../views/TripFit/shared';

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
        } else {
            cancelTripReminders(saved.id).catch(() => {});
        }
        return saved;
    }, []);

    const remove = useCallback(async (id: string) => {
        await deletePlan(id);
        setPlans((prev) => prev.filter((p) => p.id !== id));
        cancelTripReminders(id).catch(() => {});
    }, []);

    return { plans, loading, upsert, remove, refresh };
}
