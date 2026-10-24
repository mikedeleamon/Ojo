import { SavedTripFitPlan } from '../types';
import { storage, storageGetJSON } from './storage';
import api from '../api/client';
import { authHeaders, getUserId } from './auth';
import { createOutboxStore, type Outbox } from './syncOutbox';

const MAX_PLANS = 100;

// Storage key scoped to the authenticated user so plans never bleed between accounts.
const plansKey = () => `ojo_tripfit_plans_${getUserId() ?? 'anon'}`;
// Changes the server hasn't confirmed (see syncOutbox), versioned per edit.
// Replaces the one-time `ojo_tripfit_migrated_v1_*` latch; leftover keys from
// it are harmless.
const outbox = createOutboxStore(() => `ojo_tripfit_outbox_v1_${getUserId() ?? 'anon'}`);

// `updatedAt` alone can repeat within a millisecond, and then an older edit's
// upload would confirm a newer one.
let edits = 0;
const editVersion = (plan: SavedTripFitPlan) => `${plan.updatedAt}#${++edits}`;

const ms = (iso: string) => new Date(iso).getTime();
const byStartDate = (a: SavedTripFitPlan, b: SavedTripFitPlan) =>
  a.startDate.localeCompare(b.startDate);

// ─── Id generation ──────────────────────────────────────────────────────────────

export const newPlanId = (): string =>
  `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

// ─── Local storage helpers ──────────────────────────────────────────────────────

export const loadLocalPlans = async (): Promise<SavedTripFitPlan[]> =>
  storageGetJSON<SavedTripFitPlan[]>(storage, plansKey(), []);

const saveLocalPlans = async (plans: SavedTripFitPlan[]): Promise<void> =>
  storage.setItem(plansKey(), JSON.stringify(plans.slice(0, MAX_PLANS)));

// ─── Server sync helpers (swallow errors) ───────────────────────────────────────

// Each resolves true when the request landed, false when it didn't. A change
// leaves the outbox only on true; otherwise it's sent again after the next load.
const syncPost = (plan: SavedTripFitPlan): Promise<boolean> =>
  api.post('/api/tripfit', plan, authHeaders()).then(() => true).catch(() => false);

const syncDelete = (id: string): Promise<boolean> =>
  api.delete(`/api/tripfit/${id}`, authHeaders()).then(() => true).catch(() => false);

const syncClear = (): Promise<boolean> =>
  api.delete('/api/tripfit?confirm=true', authHeaders()).then(() => true).catch(() => false);

const pushPlan = async (plan: SavedTripFitPlan, version: string) => {
  if (await syncPost(plan)) await outbox.confirmPush(plan.id, version);
};

const pushDelete = async (id: string) => {
  if (await syncDelete(id)) await outbox.confirmDelete(id);
};

const pushClear = async (at: string): Promise<boolean> => {
  if (!(await syncClear())) return false;
  await outbox.confirmClear(at);
  return true;
};

// One replay at a time; anything queued meanwhile goes out after the next load.
let replaying: Promise<void> | null = null;

/** Sends everything still queued: a pending clear first, then deletes and saves. */
const replay = (box: Outbox, pending: SavedTripFitPlan[]): Promise<void> => {
  if (replaying) return replaying;
  replaying = (async () => {
    // Plans saved after a clear must not reach the server before it, or the
    // clear would wipe them.
    if (box.clearAt && !(await pushClear(box.clearAt))) return;
    await Promise.all([
      ...box.del.map(pushDelete),
      ...pending.map(p => pushPlan(p, box.push[p.id])),
    ]);
  })().finally(() => { replaying = null; });
  return replaying;
};

// ─── Public API ─────────────────────────────────────────────────────────────────

/**
 * Load plans: server first, merged with local, falling back to local-only when
 * offline.
 *
 * A plan saved or edited here whose upload the server hasn't confirmed is
 * queued in the outbox; its local copy wins and is sent again. Every other
 * plan comes from the server, and a local plan the server lacks that isn't
 * queued was deleted on another device, so it's dropped.
 */
export const loadPlans = async (): Promise<SavedTripFitPlan[]> => {
  let server: SavedTripFitPlan[];
  const mark = outbox.mark();
  try {
    const res = await api.get<SavedTripFitPlan[]>('/api/tripfit', authHeaders());
    server = res.data ?? [];
  } catch {
    return [...(await loadLocalPlans())].sort(byStartDate);
  }

  const { merged, box, pending } = await outbox.locked(async () => {
    // Read after the request, not before it: a plan saved while it was in
    // flight is only in local storage, and the save below must keep it.
    const local = await loadLocalPlans();
    const box = await outbox.read();
    const serverById = new Map(server.map(p => [p.id, p]));

    // First load since the outbox shipped: queue plans the old one-time
    // migration left stranded here, and offline edits that never went up (the
    // local copy is newer than the server's).
    if (!box.seeded) {
      for (const l of local) {
        const s = serverById.get(l.id);
        if (!s || ms(l.updatedAt) > ms(s.updatedAt)) box.push[l.id] = l.updatedAt;
      }
      box.seeded = true;
    }

    const settled = outbox.settledSince(mark);

    // Only a successful upload confirms a queued plan: the server may hold an
    // older version of it. The local copy also wins when its upload landed
    // after this list was read.
    const kept = local.filter(l => l.id in box.push || settled.pushed.has(l.id));
    const keptIds = new Set(kept.map(l => l.id));
    const pending = kept.filter(l => l.id in box.push);
    // Queued ids with no local plan left have nothing to upload.
    box.push = Object.fromEntries(pending.map(l => [l.id, box.push[l.id]]));

    // Hide what a delete or clear made here removed: queued ones the server
    // hasn't applied, and ones that landed after this list was read.
    const deletedHere = new Set([...box.del, ...settled.deleted]);
    const clearedHere = Math.max(box.clearAt ? ms(box.clearAt) : -Infinity, settled.clearedAt ?? -Infinity);
    // A delete the server already reflects needs no request.
    box.del = box.del.filter(id => serverById.has(id));

    const merged = [
      ...server.filter(s =>
        !keptIds.has(s.id) &&
        !deletedHere.has(s.id) &&
        ms(s.updatedAt) >= clearedHere),
      ...kept,
    ].sort(byStartDate);

    await saveLocalPlans(merged);
    await outbox.write(box);
    return { merged, box, pending };
  });

  replay(box, pending).catch(() => {});
  return merged;
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
  const { stamped, version } = await outbox.locked(async () => {
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
    // Queued at this version: an upload of an older edit that lands later
    // doesn't confirm this one.
    const version = editVersion(stamped);
    const box = await outbox.read();
    box.push[stamped.id] = version;
    await outbox.write(box);
    return { stamped, version };
  });
  pushPlan(stamped, version).catch(() => {});
  return stamped;
};

export const deletePlan = async (id: string): Promise<void> => {
  await outbox.locked(async () => {
    const next = (await loadLocalPlans()).filter(p => p.id !== id);
    await saveLocalPlans(next);
    const box = await outbox.read();
    delete box.push[id];
    // Queued even if its upload never landed: the upload may have succeeded
    // without this device hearing back. The server ignores unknown ids.
    if (!box.del.includes(id)) box.del.push(id);
    await outbox.write(box);
  });
  pushDelete(id).catch(() => {});
};

export const clearPlans = async (): Promise<void> => {
  const at = new Date().toISOString();
  await outbox.locked(async () => {
    await storage.removeItem(plansKey());
    // Everything this device had is gone, uploaded or not.
    await outbox.write({ push: {}, del: [], clearAt: at, seeded: true });
  });
  pushClear(at).catch(() => {});
};
