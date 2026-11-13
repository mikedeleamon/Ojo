/**
 * widget/wornToday.ts — the outfit the user logged as worn today, kept on disk
 * for the widget.
 *
 * "Wore this" is the widget's top-priority answer (buildWidgetInput), but the
 * home screen only holds it in component state. That was tolerable while the
 * widget could only change when the app was open; now the background refresh
 * rewrites the widget while the app is closed, and without this it would
 * replace the outfit the user committed to with the top-ranked suggestion.
 *
 * Stored with its date, so it stops counting at midnight on its own.
 */

import { storage, storageGetJSON } from '../storage';
import { toLocalISODate } from '../tripMode';
import type { OutfitResult } from '../outfit/types';

const WORN_TODAY_KEY = 'ojo_widget_worn_today';

interface StoredWorn {
  dateISO: string;
  outfit: OutfitResult;
}

/** Record (or, with null, forget) today's worn outfit. Best-effort. */
export const saveWornToday = async (outfit: OutfitResult | null): Promise<void> => {
  try {
    if (!outfit) {
      await storage.removeItem(WORN_TODAY_KEY);
      return;
    }
    const value: StoredWorn = { dateISO: toLocalISODate(), outfit };
    await storage.setItem(WORN_TODAY_KEY, JSON.stringify(value));
  } catch {
    /* best-effort — the widget falls back to the suggestion */
  }
};

/** Today's worn outfit, or null when none was logged today. */
export const readWornToday = async (): Promise<OutfitResult | null> => {
  const stored = await storageGetJSON<StoredWorn | null>(storage, WORN_TODAY_KEY, null);
  if (!stored || stored.dateISO !== toLocalISODate()) return null;
  return stored.outfit?.slots?.length ? stored.outfit : null;
};

export const clearWornToday = (): Promise<void> =>
  storage.removeItem(WORN_TODAY_KEY).catch(() => {});
