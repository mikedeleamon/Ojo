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

const syncPost = (plan: SavedTripFitPlan) =>
  api.post('/api/tripfit', plan, authHeaders()).catch(() => {});

const syncDelete = (id: string) =>
  api.delete(`/api/tripfit/${id}`, authHeaders()).catch(() => {});

const syncClear = () =>
  api.delete('/api/tripfit?confirm=true', authHeaders()).catch(() => {});

// ─── One-time migration: push local plans the server doesn't have yet ────────────

const migrateLocalToServer = async (serverIds: Set<string>, local: SavedTripFitPlan[]) => {
  const alreadyMigrated = await storage.getItem(migratedKey());
  if (alreadyMigrated) return;
  const unsynced = local.filter(p => !serverIds.has(p.id));
  await Promise.all(unsynced.map(syncPost));
  await storage.setItem(migratedKey(), '1');
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

/** Create or update a plan (idempotent by `id`). Writes locally, then syncs. */
export const upsertPlan = async (plan: SavedTripFitPlan): Promise<SavedTripFitPlan> => {
  const stamped: SavedTripFitPlan = { ...plan, updatedAt: new Date().toISOString() };
  const existing = await loadLocalPlans();
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
