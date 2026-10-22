/**
 * wardrobeGaps.ts
 * ---------------
 * Tracks recurring wardrobe gap signals from outfit generation.
 * When the engine reports the same gap (e.g. no coat on a cold day) repeatedly
 * over a rolling window, the system surfaces a persistent shopping suggestion.
 *
 * Architecture:
 *  - Stores gap events in AsyncStorage with timestamps
 *  - Rolling 30-day window — old events are pruned on each write
 *  - Public API returns actionable suggestions when a gap fires N+ times
 */

import { storage, storageGetJSON } from './storage';
import type { GapType } from './outfit/types';

export type { GapType };

// ─── Types ───────────────────────────────────────────────────────────────────

export interface GapEvent {
  type: GapType;
  date: string;  // ISO date string
}

export interface GapSuggestion {
  type: GapType;
  count: number;
  message: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

// v2: events under the old key came from substring-matching note copy, which
// logged a rain-layer gap on every rainy day even for raincoat owners. They're
// dropped rather than migrated; real gaps rebuild within a few days.
const STORAGE_KEY = 'ojo_wardrobe_gaps_v2';
const LEGACY_STORAGE_KEY = 'ojo_wardrobe_gaps';
const WINDOW_DAYS = 30;
const SUGGESTION_THRESHOLD = 4;  // Fire suggestion after 4 occurrences in 30 days

const GAP_MESSAGES: Record<GapType, string> = {
  missing_coat:       "You've needed a coat multiple times this month — consider adding one to your closet.",
  missing_jacket:     "A light jacket would've helped several times recently — worth adding to your wardrobe.",
  missing_boots:      "Boots have been recommended often lately — they'd serve you well this season.",
  missing_mid_layer:  "A mid layer (hoodie or sweater) keeps coming up — consider adding one.",
  missing_rain_layer: "Rain-resistant outerwear has been needed often — a waterproof jacket would be a smart addition.",
  missing_footwear:   "You don't have footwear in your closet yet — any pair would improve your recommendations.",
};

/** Shopping-search query for each gap's "Shop" button. */
export const GAP_SEARCH_TERMS: Record<GapType, string> = {
  missing_coat:       'winter coat',
  missing_jacket:     'light jacket',
  missing_boots:      'boots',
  missing_mid_layer:  'hoodie sweater',
  missing_rain_layer: 'waterproof jacket',
  missing_footwear:   'shoes',
};

// ─── Storage ──────────────────────────────────────────────────────────────────

const loadEvents = async (): Promise<GapEvent[]> =>
  storageGetJSON<GapEvent[]>(storage, STORAGE_KEY, []);

const saveEvents = async (events: GapEvent[]): Promise<void> =>
  storage.setItem(STORAGE_KEY, JSON.stringify(events));

/** Prune events older than the rolling window. */
const pruneOld = (events: GapEvent[]): GapEvent[] => {
  const cutoff = Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000;
  return events.filter(e => new Date(e.date).getTime() >= cutoff);
};

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Record the gaps from the current outfit generation.
 * Call this after generating outfits, passing the outfit's `gaps`.
 */
export const recordGaps = async (gaps: GapType[]): Promise<void> => {
  if (gaps.length === 0) return;

  const existing = await loadEvents();
  const today = new Date().toISOString().split('T')[0];

  // Deduplicate: don't record the same gap type twice on the same day
  const todayTypes = new Set(
    existing.filter(e => e.date.startsWith(today)).map(e => e.type)
  );

  const newEvents: GapEvent[] = [];
  for (const type of gaps) {
    if (!todayTypes.has(type)) {
      newEvents.push({ type, date: new Date().toISOString() });
      todayTypes.add(type);
    }
  }

  if (newEvents.length === 0) return;

  const updated = pruneOld([...newEvents, ...existing]);
  await saveEvents(updated);
};

/**
 * Returns actionable suggestions for gaps that have fired frequently.
 * Only returns gaps that exceeded the threshold within the rolling window.
 */
export const getGapSuggestions = async (): Promise<GapSuggestion[]> => {
  const events = pruneOld(await loadEvents());
  if (events.length === 0) return [];

  // Count occurrences per type
  const counts = new Map<GapType, number>();
  for (const e of events) {
    counts.set(e.type, (counts.get(e.type) ?? 0) + 1);
  }

  const suggestions: GapSuggestion[] = [];
  counts.forEach((count, type) => {
    if (count >= SUGGESTION_THRESHOLD) {
      suggestions.push({
        type,
        count,
        message: GAP_MESSAGES[type],
      });
    }
  });

  // Sort by frequency (most urgent first)
  suggestions.sort((a, b) => b.count - a.count);
  return suggestions;
};

/** Clear all gap data (for settings reset). */
export const clearGapHistory = async (): Promise<void> => {
  await storage.removeItem(STORAGE_KEY);
  await storage.removeItem(LEGACY_STORAGE_KEY);
};
