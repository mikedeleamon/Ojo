import { OutfitHistoryEntry } from '../types';

const HISTORY_KEY = 'ojo_outfit_history';
const MAX_ENTRIES = 60; // keep last 60 logged outfits

export const loadHistory = (): OutfitHistoryEntry[] => {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? (JSON.parse(raw) as OutfitHistoryEntry[]) : [];
  } catch {
    return [];
  }
};

export const saveHistory = (entries: OutfitHistoryEntry[]): void => {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(entries.slice(0, MAX_ENTRIES)));
  } catch { /* storage full — silently ignore */ }
};

export const addHistoryEntry = (entry: Omit<OutfitHistoryEntry, 'id' | 'wornAt'>): OutfitHistoryEntry => {
  const newEntry: OutfitHistoryEntry = {
    ...entry,
    id:     `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    wornAt: new Date().toISOString(),
  };
  const existing = loadHistory();
  saveHistory([newEntry, ...existing]);
  return newEntry;
};

export const deleteHistoryEntry = (id: string): void => {
  const entries = loadHistory().filter(e => e.id !== id);
  saveHistory(entries);
};

export const clearHistory = (): void => {
  localStorage.removeItem(HISTORY_KEY);
};

/** Returns article IDs worn within the last `withinDays` days (default 3).
 *  The outfit engine uses this to deprioritise recently-worn items. */
export const recentlyWornIds = (withinDays = 3): Set<string> => {
  const cutoff = Date.now() - withinDays * 24 * 60 * 60 * 1000;
  const ids = new Set<string>();
  loadHistory().forEach(entry => {
    if (new Date(entry.wornAt).getTime() >= cutoff) {
      entry.articleIds.forEach(id => ids.add(id));
    }
  });
  return ids;
};
