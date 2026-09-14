import { SavedTripFitPlan } from '../types';
import { storage, storageGetJSON } from './storage';
import api from '../api/client';
import { authHeaders, getUserId } from './auth';

const MAX_PLANS = 100;

// Storage key scoped to the authenticated user so plans never bleed between accounts.
const plansKey    = () => `ojo_tripfit_plans_${getUserId() ?? 'anon'}`;
const migratedKey = () => `ojo_tripfit_migrated_v1_${getUserId() ?? 'anon'}`;

// ─── Id generation ──────────────────────────────────────────────────────────────

export const newPlanId = (): string =>
  `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

// ─── Local storage helpers ──────────────────────────────────────────────────────

export const loadLocalPlans = async (): Promise<SavedTripFitPlan[]> =>
  storageGetJSON<SavedTripFitPlan[]>(storage, plansKey(), []);

const saveLocalPlans = async (plans: SavedTripFitPlan[]): Promise<void> =>
  storage.setItem(plansKey(), JSON.stringify(plans.slice(0, MAX_PLANS)));

// ─── Server sync helpers (fire-and-forget, swallow errors) ──────────────────────

// Resolves true when the post landed, false when it didn't. Fire-and-forget
// callers can keep ignoring the result; the one-time migration below needs it,
// because it must not latch its "done" flag on a batch that silently failed.
const syncPost = (plan: SavedTripFitPlan): Promise<boolean> =>
  api.post('/api/tripfit', plan, authHeaders()).then(() => true).catch(() => false);

const syncDelete = (id: string) =>
  api.delete(`/api/tripfit/${id}`, authHeaders()).catch(() => {});

const syncClear = () =>
  api.delete('/api/tripfit?confirm=true', authHeaders()).catch(() => {});

// ─── One-time migration: push local plans the server doesn't have yet ────────────

const migrateLocalToServer = async (serverIds: Set<string>, local: SavedTripFitPlan[]) => {
  const alreadyMigrated = await storage.getItem(migratedKey());
  if (alreadyMigrated) return;
  const unsynced = local.filter(p => !serverIds.has(p.id));
  const results = await Promise.all(unsynced.map(syncPost));
  // Only latch the flag once every plan actually landed — syncPost swallows its
  // own failures, so Promise.all resolved even when all of them failed, latching
  // the flag and stranding those plans on the device forever. Empty batch is a
  // success: [].every() is true.
  if (results.every(Boolean)) await storage.setItem(migratedKey(), '1');
};

// ─── Public API ─────────────────────────────────────────────────────────────────

/**
 * Load plans: server first, merged with local, falling back to local-only when
 * offline. The newer `updatedAt` wins for plans that exist in both places so an
 * edit made offline isn't clobbered by a stale server copy.
 */
export const loadPlans = async (): Promise<SavedTripFitPlan[]> => {
  const local = await loadLocalPlans();

  try {
    const res = await api.get<SavedTripFitPlan[]>('/api/tripfit', authHeaders());
    const server: SavedTripFitPlan[] = res.data ?? [];
    const serverIds = new Set(server.map(p => p.id));

    migrateLocalToServer(serverIds, local).catch(() => {});

    const localById = new Map(local.map(p => [p.id, p]));
    const merged: SavedTripFitPlan[] = server.map(s => {
      const l = localById.get(s.id);
      return l && new Date(l.updatedAt).getTime() > new Date(s.updatedAt).getTime() ? l : s;
    });
    // Append local-only plans (not yet synced)
    for (const l of local) if (!serverIds.has(l.id)) merged.push(l);

    merged.sort((a, b) => a.startDate.localeCompare(b.startDate));
    await saveLocalPlans(merged);
    return merged;
  } catch {
    return [...local].sort((a, b) => a.startDate.localeCompare(b.startDate));
  }
};

/** The fields that decide whether two records describe the same trip. */
export interface TripIdentity {
  destination: string;
  startDate:   string;
  endDate:     string;
}

/** Two plans describe the same trip when the city and both dates line up. */
export const isSameTrip = (a: TripIdentity, b: TripIdentity): boolean =>
  a.startDate === b.startDate &&
  a.endDate === b.endDate &&
  a.destination.trim().toLowerCase() === b.destination.trim().toLowerCase();

/**
 * The already-saved plan `candidate` would be adopted by rather than added to,
 * if there is one.
 *
 * Exported because `upsertPlan` is not the only caller that needs the answer:
 * the free-tier trip cap has to know whether a save would actually create a
 * record before it charges a slot for it.
 */
export const findTwinPlan = <T extends TripIdentity>(
  plans: T[],
  candidate: TripIdentity,
): T | undefined => plans.find(p => isSameTrip(p, candidate));

/**
 * Create or update a plan (idempotent by `id`). Writes locally, then syncs.
 *
 * Also idempotent by *trip*: a planner session that didn't open a saved plan
 * mints a fresh id, so planning a trip the user already had saved — from the
 * "Plan a new trip" button, or from the flight chip for a trip they'd already
 * planned by hand — wrote a second record for it. Duplicates are easy to miss
 * in the library and impossible to miss at 8am, when every copy's Trip Mode
 * nudge fires side by side with identical copy. Same city, same dates is the
 * same trip: adopt the record that already exists rather than adding to it.
 */
export const upsertPlan = async (plan: SavedTripFitPlan): Promise<SavedTripFitPlan> => {
  const existing = await loadLocalPlans();

  // Only when the incoming id is unknown — an edit to a plan already saved
  // under its own id is never a duplicate of anything, even if the user has
  // just retyped its dates to match another trip's.
  const twin = existing.some(p => p.id === plan.id)
    ? undefined
    : findTwinPlan(existing, plan);

  const stamped: SavedTripFitPlan = {
    ...plan,
    id:        twin?.id ?? plan.id,
    createdAt: twin?.createdAt ?? plan.createdAt,
    updatedAt: new Date().toISOString(),
  };

  const idx = existing.findIndex(p => p.id === stamped.id);
  const next = idx >= 0
    ? existing.map(p => (p.id === stamped.id ? stamped : p))
    : [stamped, ...existing];
  await saveLocalPlans(next);
  syncPost(stamped);
  return stamped;
};

export const deletePlan = async (id: string): Promise<void> => {
  const next = (await loadLocalPlans()).filter(p => p.id !== id);
  await saveLocalPlans(next);
  syncDelete(id);
};

export const clearPlans = async (): Promise<void> => {
  await storage.removeItem(plansKey());
  syncClear();
};
