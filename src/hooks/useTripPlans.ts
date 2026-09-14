import { useSyncExternalStore, useEffect, useCallback } from 'react';
import { SavedTripFitPlan } from '../types';
import { loadPlans, upsertPlan, deletePlan } from '../lib/tripStorage';
import {
    scheduleTripReminders,
    cancelTripReminders,
    scheduleTripMorningNotifications,
    cancelTripMorningNotifications,
    cancelOrphanedTripNotifications,
    awaitNotificationWipe,
} from '../lib/notifications';
import { claimReconcile } from '../lib/launchReconcile';
import { tripFitStatus } from '../views/TripFit/shared';

/**
 * Bring the device's scheduled trip notifications back in line with the plans
 * that actually exist. Runs once per session (see `claimReconcile`), because
 * useTripPlans mounts on several screens — via useTripMode on Home, TripFit,
 * etc. — and doing this per mount meant redundant native calls on every
 * navigation. Mutations (upsert/remove) still (re)schedule their own plan.
 *
 * The sweep comes first and is awaited. It only cancels ids missing from this
 * same list, so it could not cancel what the loop below schedules even if they
 * overlapped, but ordering it first means the loop isn't competing with a
 * pending-notification read for a set that still contains the dead entries.
 */
const reconcileTripNotifications = async (
    plans: SavedTripFitPlan[],
): Promise<void> => {
    // Never schedule into a set a sign-out is still clearing — otherwise a fast
    // account switch loses the notifications scheduled here to the previous
    // account's in-flight wipe.
    await awaitNotificationWipe();

    // Pass every plan, including completed ones: a completed trip is still a
    // live plan whose notifications the normal paths own.
    await cancelOrphanedTripNotifications(plans.map((p) => p.id));

    // Scheduling is idempotent (cancels-then-reschedules) and self-gates on the
    // local pref + notification permission, so this also retro-schedules trips
    // saved before the feature or the toggle was enabled.
    for (const plan of plans) {
        if (tripFitStatus(plan) !== 'completed') {
            scheduleTripMorningNotifications(plan).catch(() => {});
        }
    }
};

// ─── Shared module-level store ─────────────────────────────────────────────────
// Every useTripPlans() consumer reads and writes one cache, so a mutation made
// on one screen is immediately visible on every other — this hook mounts at
// least twice (TripFitScreen directly, Home through useTripMode), and while each
// mount held its own useState copy, ticking a packing checkbox on the TripFit
// tab never reached Home. That mattered beyond a stale label: Home owns the only
// writer for the home-screen widget snapshot (see OutfitSuggestion's widget-sync
// effect), so the Trip Countdown widget's packed count only moved on a cold
// start, when Home remounted and re-read storage.
//
// Consumers subscribe via useSyncExternalStore, and the store only publishes a
// new snapshot when the data actually changed — a refresh that returns identical
// plans keeps the same array reference, so nothing downstream re-renders and the
// widget snapshot isn't rewritten.
const EMPTY: SavedTripFitPlan[] = [];

let cache: SavedTripFitPlan[] | null = null;
let loaded = false;                  // a load has completed (ok or errored)
let inFlight: Promise<void> | null = null;
// Bumped by every local mutation, to spot one that landed mid-fetch. loadPlans()
// reads local storage at the top, so a plan written after that read is missing
// from the list it eventually resolves with — adopting that list would silently
// revert the write.
let mutations = 0;
// Bumped by resetTripPlansCache(). A load that started before a sign-out must
// not deliver the previous account's plans into the cleared cache, and must not
// mark it loaded either — that would leave the next account reading an empty
// list that nothing ever refetches.
let generation = 0;

interface TripPlansSnapshot {
    plans: SavedTripFitPlan[];
    loading: boolean;
}

let snapshot: TripPlansSnapshot = { plans: EMPTY, loading: true };
const listeners = new Set<() => void>();

/** Rebuild the snapshot object and notify subscribers. Call only on real change —
 *  useSyncExternalStore skips re-rendering when getSnapshot() is unchanged, so
 *  an unnecessary publish here is an unnecessary render everywhere. */
const publish = () => {
    snapshot = { plans: cache ?? EMPTY, loading: !loaded };
    listeners.forEach((l) => l());
};

const subscribe = (l: () => void) => {
    listeners.add(l);
    return () => { listeners.delete(l); };
};
const getSnapshot = () => snapshot;

const byStartDate = (a: SavedTripFitPlan, b: SavedTripFitPlan) =>
    a.startDate.localeCompare(b.startDate);

const updateCache = (fn: (prev: SavedTripFitPlan[]) => SavedTripFitPlan[]) => {
    mutations += 1;
    cache = fn(cache ?? EMPTY);
    publish();
};

/**
 * Load plans into the shared cache. Concurrent mounts collapse onto one
 * in-flight request, and the list is fetched once per session unless something
 * explicitly forces a refresh.
 */
function load(force = false): Promise<void> {
    if (inFlight) return inFlight;
    if (loaded && !force) return Promise.resolve();

    const mutationsAtStart = mutations;
    const gen = generation;

    const settle = (fresh: SavedTripFitPlan[] | null) => {
        // A sign-out that landed while this was in flight already cleared the
        // cache and detached this request — see resetTripPlansCache.
        if (gen !== generation) return;
        inFlight = null;
        const wasLoaded = loaded;
        loaded = true;
        // A mutation that landed while this was in flight is newer than
        // anything this list can describe; keep it and drop the fetch's answer.
        const stale = mutations !== mutationsAtStart;
        const changed =
            fresh != null &&
            !stale &&
            (cache == null || JSON.stringify(cache) !== JSON.stringify(fresh));
        if (changed) cache = fresh;
        if (cache == null) cache = EMPTY;
        if (changed || !wasLoaded) publish();

        if (claimReconcile('tripPlans')) {
            // Deliberately not awaited — the list has nothing to wait on while
            // notification bookkeeping runs.
            reconcileTripNotifications(cache).catch(() => {});
        }
    };

    inFlight = loadPlans()
        .then(settle)
        // loadPlans() already falls back to local-only when the server is
        // unreachable, so only a storage read can land here. Settle anyway, or
        // every consumer hangs on `loading` forever.
        .catch(() => settle(null));

    return inFlight;
}

/** Clears the shared cache — call on logout so the next account starts clean. */
export const resetTripPlansCache = (): void => {
    generation += 1;
    cache = null;
    loaded = false;
    // Detach any in-flight load rather than waiting on it: its `settle` now
    // no-ops, and dropping the handle lets the next account start its own.
    inFlight = null;
    publish();
};

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
 * create/update/delete. Backed by the shared store above, so every screen holding
 * this hook sees the same list and a mutation on one reaches all of them. Packing
 * reminders are (re)scheduled here so every code path that mutates a plan keeps
 * notifications in sync.
 */
export function useTripPlans(): UseTripPlansResult {
    const { plans, loading } = useSyncExternalStore(subscribe, getSnapshot);

    useEffect(() => {
        void load(); // no-op if already cached / in flight
    }, []);

    const refresh = useCallback(() => { void load(true); }, []);

    const upsert = useCallback(async (plan: SavedTripFitPlan) => {
        const saved = await upsertPlan(plan);
        updateCache((prev) => {
            const idx = prev.findIndex((p) => p.id === saved.id);
            const next =
                idx >= 0
                    ? prev.map((p) => (p.id === saved.id ? saved : p))
                    : [...prev, saved];
            return next.sort(byStartDate);
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
        updateCache((prev) => prev.filter((p) => p.id !== id));
        cancelTripReminders(id).catch(() => {});
        cancelTripMorningNotifications(id).catch(() => {});
    }, []);

    return { plans, loading, upsert, remove, refresh };
}
