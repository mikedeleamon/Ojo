/**
 * recapStorage.ts — persistence for which recap templates a user has seen,
 * feeding recapEngine's cooldown suppression (WEEKLY_RECAP_TEMPLATES.md §rules).
 * Keys are user-scoped like outfitHistory to prevent bleed between accounts.
 */

import { storage, storageGetJSON, storageSetJSON } from './storage';
import { getUserId } from './auth';
import { ShownRecord, isoWeekKey } from './recapEngine';

const shownKey = () => `ojo_recap_shown_${getUserId() ?? 'anon'}`;

/** Longest template cooldown is 31 days; keep a little slack past that. */
const RETENTION_DAYS = 40;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Records shown in weeks BEFORE the given one — the current week is excluded
 * so reopening this week's recap doesn't suppress its own templates.
 */
export const loadShownBeforeWeek = async (week: string): Promise<ShownRecord[]> => {
  const all = await storageGetJSON<ShownRecord[]>(storage, shownKey(), []);
  return all.filter(r => isoWeekKey(new Date(r.shownAt)) !== week);
};

/**
 * Persist this week's shown templates, replacing any records already written
 * for the same week (rebuilds are deterministic, so re-opens produce the same
 * set) and pruning anything past the longest cooldown.
 */
export const recordShownTemplates = async (
  templateIds: string[],
  now: Date = new Date(),
): Promise<void> => {
  const week = isoWeekKey(now);
  const cutoff = now.getTime() - RETENTION_DAYS * DAY_MS;
  const all = await storageGetJSON<ShownRecord[]>(storage, shownKey(), []);
  const kept = all.filter(r => {
    const t = new Date(r.shownAt).getTime();
    return t >= cutoff && isoWeekKey(new Date(r.shownAt)) !== week;
  });
  const added: ShownRecord[] = templateIds.map(templateId => ({
    templateId,
    shownAt: now.toISOString(),
  }));
  await storageSetJSON(storage, shownKey(), [...kept, ...added]);
};

export const clearRecapShown = async (): Promise<void> =>
  storage.removeItem(shownKey());
