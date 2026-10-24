import { OutfitHistoryEntry } from '../types';
import { storage, storageGetJSON } from './storage';
import api from '../api/client';
import { authHeaders, getUserId } from './auth';
import { createOutboxStore, type Outbox } from './syncOutbox';

// Safety bound, not a functional limit: full history feeds Style DNA + insights,
// but we cap persisted/merged entries so a very heavy multi-year user can't grow
// the local AsyncStorage blob or the /api/history payload without limit. High
// enough that it never affects analytics in practice.
const MAX_ENTRIES = 2000;

// Storage keys scoped to the authenticated user to prevent history bleed between accounts.
const historyKey = () => `ojo_outfit_history_${getUserId() ?? 'anon'}`;
// Changes the server hasn't confirmed (see syncOutbox). Replaces the one-time
// `ojo_history_migrated_v1_*` latch; leftover keys from it are harmless.
const outbox = createOutboxStore(() => `ojo_history_outbox_v1_${getUserId() ?? 'anon'}`);

// Entries never change once logged, so every queued upload is the same version.
const LOGGED = '1';

const wornMs = (e: OutfitHistoryEntry) => new Date(e.wornAt).getTime();

// ─── Local storage helpers ────────────────────────────────────────────────────

export const loadLocalHistory = async (): Promise<OutfitHistoryEntry[]> =>
  storageGetJSON<OutfitHistoryEntry[]>(storage, historyKey(), []);

export const saveHistory = async (entries: OutfitHistoryEntry[]): Promise<void> =>
  storage.setItem(historyKey(), JSON.stringify(entries.slice(0, MAX_ENTRIES)));

// ─── Server sync helpers (swallow errors) ────────────────────────────────────

// Each resolves true when the request landed, false when it didn't. A change
// leaves the outbox only on true; otherwise it's sent again after the next load.
const syncPost = (entry: OutfitHistoryEntry): Promise<boolean> =>
  api.post('/api/history', {
    id:             entry.id,
    wornAt:         entry.wornAt,
    closetId:       entry.closetId,
    closetName:     entry.closetName,
    articleIds:     entry.articleIds,
    articleSummary: entry.articleSummary,
    // ML-ranker instrumentation — omitted (not null) when absent so pre-existing
    // entries and Trip Mode logs post the same shape they always did.
    ...(entry.context   ? { context:   entry.context }   : {}),
    ...(entry.engine    ? { engine:    entry.engine }    : {}),
    ...(entry.negatives ? { negatives: entry.negatives } : {}),
  }, authHeaders()).then(() => true).catch(() => false);

const syncDelete = (id: string): Promise<boolean> =>
  api.delete(`/api/history/${id}`, authHeaders()).then(() => true).catch(() => false);

const syncClear = (): Promise<boolean> =>
  api.delete('/api/history?confirm=true', authHeaders()).then(() => true).catch(() => false);

const pushEntry = async (entry: OutfitHistoryEntry) => {
  if (await syncPost(entry)) await outbox.confirmPush(entry.id, LOGGED);
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

/** Sends everything still queued: a pending clear first, then deletes and new entries. */
const replay = (box: Outbox, pending: OutfitHistoryEntry[]): Promise<void> => {
  if (replaying) return replaying;
  replaying = (async () => {
    // Entries logged after a clear must not reach the server before it, or the
    // clear would wipe them.
    if (box.clearAt && !(await pushClear(box.clearAt))) return;
    await Promise.all([...box.del.map(pushDelete), ...pending.map(pushEntry)]);
  })().finally(() => { replaying = null; });
  return replaying;
};

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Load history: tries server first, merges with local, falls back to local-only.
 * Deduplication is by entry `id` (client-generated).
 *
 * A local entry the server lacks is kept only while it's queued in the outbox
 * (logged here, upload not yet confirmed) and is then sent again. One the
 * outbox doesn't know about was deleted on another device, so it's dropped.
 * The server's `clearedAt` tombstone drops queued entries worn before a clear
 * on another device too.
 */
export const loadHistory = async (): Promise<OutfitHistoryEntry[]> => {
  let serverEntries: OutfitHistoryEntry[];
  let clearedAt: number | null;
  const mark = outbox.mark();
  try {
    const res = await api.get<{ entries: OutfitHistoryEntry[]; clearedAt: string | null }>(
      '/api/history',
      authHeaders(),
    );
    serverEntries = res.data?.entries ?? [];
    clearedAt = res.data?.clearedAt ? new Date(res.data.clearedAt).getTime() : null;
  } catch {
    // Network unavailable — return local entries
    return loadLocalHistory();
  }

  const { merged, box, pending } = await outbox.locked(async () => {
    // Read after the request, not before it: an entry logged while it was in
    // flight is only in local storage, and the save below must keep it.
    const local = await loadLocalHistory();
    const box = await outbox.read();
    const serverIds = new Set(serverEntries.map(e => e.id));

    // First load since the outbox shipped: queue the entries the old one-time
    // migration left stranded on this device.
    if (!box.seeded) {
      for (const e of local) if (!serverIds.has(e.id)) box.push[e.id] = LOGGED;
      box.seeded = true;
    }

    const settled = outbox.settledSince(mark);

    // Hide what a delete or clear made here removed: queued ones the server
    // hasn't applied, and ones that landed after this list was read.
    const deletedHere = new Set([...box.del, ...settled.deleted]);
    const clearedHere = Math.max(
      box.clearAt ? new Date(box.clearAt).getTime() : -Infinity,
      settled.clearedAt ?? -Infinity,
    );
    const fromServer = serverEntries.filter(e =>
      !deletedHere.has(e.id) && wornMs(e) >= clearedHere);
    // A delete the server already reflects needs no request.
    box.del = box.del.filter(id => serverIds.has(id));

    // Local entries the server's list lacks that are still queued, or whose
    // upload landed after the list was read.
    const kept = local.filter(e =>
      !serverIds.has(e.id) &&
      (e.id in box.push || settled.pushed.has(e.id)) &&
      !(clearedAt !== null && wornMs(e) < clearedAt));
    const pending = kept.filter(e => e.id in box.push);
    // Everything else in the outbox is on the server now, or was dropped above.
    box.push = Object.fromEntries(pending.map(e => [e.id, LOGGED]));

    const merged = [...fromServer, ...kept]
      .sort((a, b) => wornMs(b) - wornMs(a))
      .slice(0, MAX_ENTRIES);

    // Keep local cache in sync with merged result
    await saveHistory(merged);
    await outbox.write(box);
    return { merged, box, pending };
  });

  replay(box, pending).catch(() => {});
  return merged;
};

export const addHistoryEntry = async (
  entry: Omit<OutfitHistoryEntry, 'id' | 'wornAt'>
): Promise<OutfitHistoryEntry> => {
  const newEntry: OutfitHistoryEntry = {
    ...entry,
    id:     `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    wornAt: new Date().toISOString(),
  };
  // Write locally first (instant), queued until the server confirms it
  await outbox.locked(async () => {
    const existing = await loadLocalHistory();
    await saveHistory([newEntry, ...existing]);
    const box = await outbox.read();
    box.push[newEntry.id] = LOGGED;
    await outbox.write(box);
  });
  // Not awaited: the entry is saved either way, and a failed upload is retried
  // after the next load.
  pushEntry(newEntry).catch(() => {});
  return newEntry;
};

export const deleteHistoryEntry = async (id: string): Promise<void> => {
  await outbox.locked(async () => {
    const entries = (await loadLocalHistory()).filter(e => e.id !== id);
    await saveHistory(entries);
    const box = await outbox.read();
    delete box.push[id];
    // Queued even if its upload never landed: the upload may have succeeded
    // without this device hearing back. The server ignores unknown ids.
    if (!box.del.includes(id)) box.del.push(id);
    await outbox.write(box);
  });
  await pushDelete(id);
};

export const clearHistory = async (): Promise<void> => {
  const at = new Date().toISOString();
  await outbox.locked(async () => {
    await storage.removeItem(historyKey());
    // Everything this device had is gone, uploaded or not.
    await outbox.write({ push: {}, del: [], clearAt: at, seeded: true });
  });
  await pushClear(at);
};

// ─── Query helpers (unchanged, operate on local for speed) ───────────────────

/**
 * Returns a map of article ID → days since last worn (fractional).
 * Only includes articles worn within the last `withinDays` days.
 * If an article appears multiple times, the most recent wear date wins.
 */
export const recentlyWornWithAge = async (withinDays = 7): Promise<Map<string, number>> => {
  const cutoff = Date.now() - withinDays * 24 * 60 * 60 * 1000;
  const map = new Map<string, number>();
  const now = Date.now();

  (await loadLocalHistory()).forEach(entry => {
    const wornTime = new Date(entry.wornAt).getTime();
    if (wornTime >= cutoff) {
      const daysSince = (now - wornTime) / (24 * 60 * 60 * 1000);
      entry.articleIds.forEach(id => {
        // Keep the most recent (smallest daysSince) for each article
        const existing = map.get(id);
        if (existing === undefined || daysSince < existing) {
          map.set(id, daysSince);
        }
      });
    }
  });
  return map;
};
