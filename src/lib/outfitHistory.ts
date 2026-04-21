import { OutfitHistoryEntry } from '../types';
import { storage, storageGetJSON } from './storage';

const HISTORY_KEY  = 'ojo_outfit_history';
const MAX_ENTRIES  = 60;

export const loadHistory = async (): Promise<OutfitHistoryEntry[]> =>
  storageGetJSON<OutfitHistoryEntry[]>(storage, HISTORY_KEY, []);

export const saveHistory = async (entries: OutfitHistoryEntry[]): Promise<void> =>
  storage.setItem(HISTORY_KEY, JSON.stringify(entries.slice(0, MAX_ENTRIES)));

export const addHistoryEntry = async (
  entry: Omit<OutfitHistoryEntry, 'id' | 'wornAt'>
): Promise<OutfitHistoryEntry> => {
  const newEntry: OutfitHistoryEntry = {
    ...entry,
    id:     `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    wornAt: new Date().toISOString(),
  };
  const existing = await loadHistory();
  await saveHistory([newEntry, ...existing]);
  return newEntry;
};

export const deleteHistoryEntry = async (id: string): Promise<void> => {
  const entries = (await loadHistory()).filter(e => e.id !== id);
  await saveHistory(entries);
};

export const clearHistory = async (): Promise<void> => {
  await storage.removeItem(HISTORY_KEY);
};

/** Returns article IDs worn within the last `withinDays` days (default 3). */
export const recentlyWornIds = async (withinDays = 3): Promise<Set<string>> => {
  const cutoff = Date.now() - withinDays * 24 * 60 * 60 * 1000;
  const ids = new Set<string>();
  (await loadHistory()).forEach(entry => {
    if (new Date(entry.wornAt).getTime() >= cutoff) {
      entry.articleIds.forEach(id => ids.add(id));
    }
  });
  return ids;
};
