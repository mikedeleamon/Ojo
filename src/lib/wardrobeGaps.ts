/**
 * wardrobeGaps.ts
 * ---------------
 * Tracks recurring wardrobe gap signals from outfit generation.
 * When a missing-layer note (e.g. "No coat in your closet") fires repeatedly
 * over a rolling window, the system surfaces a persistent shopping suggestion.
 *
 * Architecture:
 *  - Stores gap events in AsyncStorage with timestamps
 *  - Rolling 30-day window — old events are pruned on each write
 *  - Public API returns actionable suggestions when a gap fires N+ times
 */

import { storage, storageGetJSON } from './storage';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface GapEvent {
  type: GapType;
  date: string;  // ISO date string
}

export type GapType =
  | 'missing_coat'
  | 'missing_jacket'
  | 'missing_boots'
  | 'missing_mid_layer'
  | 'missing_rain_layer'
  | 'missing_footwear';

export interface GapSuggestion {
  type: GapType;
  count: number;
  message: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'ojo_wardrobe_gaps';
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
 * Record one or more gap events from the current outfit generation.
 * Call this after generating outfits, passing the notes array.
 */
export const recordGapsFromNotes = async (notes: string[]): Promise<void> => {
  const gaps: GapType[] = [];

  for (const note of notes) {
    const lower = note.toLowerCase();
    if (lower.includes('no coat'))                gaps.push('missing_coat');
    if (lower.includes('light jacket'))           gaps.push('missing_jacket');
    if (lower.includes('boots would'))            gaps.push('missing_boots');
    if (lower.includes('mid layer'))              gaps.push('missing_mid_layer');
    if (lower.includes('waterproof') || lower.includes('water-resistant'))
                                                  gaps.push('missing_rain_layer');
    if (lower.includes('no footwear'))            gaps.push('missing_footwear');
  }

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
};
