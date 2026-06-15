import { OutfitHistoryEntry } from '../types';
import { storage, storageGetJSON } from './storage';
import api from '../api/client';
import { authHeaders, getUserId } from './auth';

// Safety bound, not a functional limit: full history feeds Style DNA + insights,
// but we cap persisted/merged entries so a very heavy multi-year user can't grow
// the local AsyncStorage blob or the /api/history payload without limit. High
// enough that it never affects analytics in practice.
const MAX_ENTRIES = 2000;

// Storage keys scoped to the authenticated user to prevent history bleed between accounts.
const historyKey  = () => `ojo_outfit_history_${getUserId() ?? 'anon'}`;
const migratedKey = () => `ojo_history_migrated_v1_${getUserId() ?? 'anon'}`;

// ─── Local storage helpers ────────────────────────────────────────────────────

export const loadLocalHistory = async (): Promise<OutfitHistoryEntry[]> =>
  storageGetJSON<OutfitHistoryEntry[]>(storage, historyKey(), []);

export const saveHistory = async (entries: OutfitHistoryEntry[]): Promise<void> =>
  storage.setItem(historyKey(), JSON.stringify(entries.slice(0, MAX_ENTRIES)));

// ─── Server sync helpers (fire-and-forget, swallow errors) ───────────────────

const syncPost = (entry: OutfitHistoryEntry) =>
  api.post('/api/history', {
    id:             entry.id,
    wornAt:         entry.wornAt,
    closetId:       entry.closetId,
    closetName:     entry.closetName,
    articleIds:     entry.articleIds,
    articleSummary: entry.articleSummary,
  }, authHeaders()).catch(() => {});

const syncDelete = (id: string) =>
  api.delete(`/api/history/${id}`, authHeaders()).catch(() => {});

const syncClear = () =>
  api.delete('/api/history', authHeaders()).catch(() => {});

// ─── One-time migration: push local entries that server doesn't have ──────────

const migrateLocalToServer = async (serverIds: Set<string>, local: OutfitHistoryEntry[]) => {
  const alreadyMigrated = await storage.getItem(migratedKey());
  if (alreadyMigrated) return;
  const unsynced = local.filter(e => !serverIds.has(e.id));
  await Promise.all(unsynced.map(syncPost));
  await storage.setItem(migratedKey(), '1');
};

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Load history: tries server first, merges with local, falls back to local-only.
 * Deduplication is by entry `id` (client-generated).
 */
export const loadHistory = async (): Promise<OutfitHistoryEntry[]> => {
  const local = await loadLocalHistory();

  try {
    const res = await api.get<OutfitHistoryEntry[]>('/api/history', authHeaders());
    const serverEntries: OutfitHistoryEntry[] = res.data ?? [];
    const serverIds = new Set(serverEntries.map(e => e.id));

    // One-time migration of local-only entries
    migrateLocalToServer(serverIds, local).catch(() => {});

    // Merge: server wins for entries with matching id; local-only entries appended
    const localOnly = local.filter(e => !serverIds.has(e.id));
    const merged = [...serverEntries, ...localOnly]
      .sort((a, b) => new Date(b.wornAt).getTime() - new Date(a.wornAt).getTime())
      .slice(0, MAX_ENTRIES);

    // Keep local cache in sync with merged result
    await saveHistory(merged);
    return merged;
  } catch {
    // Network unavailable — return local entries
    return local;
  }
};

export const addHistoryEntry = async (
  entry: Omit<OutfitHistoryEntry, 'id' | 'wornAt'>
): Promise<OutfitHistoryEntry> => {
  const newEntry: OutfitHistoryEntry = {
    ...entry,
    id:     `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    wornAt: new Date().toISOString(),
  };
  // Write locally first (instant)
  const existing = await loadLocalHistory();
  await saveHistory([newEntry, ...existing]);
  // Fire-and-forget sync to server
  syncPost(newEntry);
  return newEntry;
};

export const deleteHistoryEntry = async (id: string): Promise<void> => {
  const entries = (await loadLocalHistory()).filter(e => e.id !== id);
  await saveHistory(entries);
  await syncDelete(id);
};

export const clearHistory = async (): Promise<void> => {
  await storage.removeItem(historyKey());
  await syncClear();
};

// ─── Query helpers (unchanged, operate on local for speed) ───────────────────

/** Returns article IDs worn within the last `withinDays` days (default 3). */
export const recentlyWornIds = async (withinDays = 3): Promise<Set<string>> => {
  const cutoff = Date.now() - withinDays * 24 * 60 * 60 * 1000;
  const ids = new Set<string>();
  (await loadLocalHistory()).forEach(entry => {
    if (new Date(entry.wornAt).getTime() >= cutoff) {
      entry.articleIds.forEach(id => ids.add(id));
    }
  });
  return ids;
};

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
