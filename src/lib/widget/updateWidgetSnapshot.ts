/**
 * widget/updateWidgetSnapshot.ts — the single writer for the home-screen widget.
 *
 * Given already-resolved outfit/trip data, it caches each item's thumbnail into
 * the shared App Group container, writes snapshot.json, and reloads WidgetKit
 * timelines (all via the native bridge). Call it on every relevant recompute —
 * Phase 4 wires the actual call sites (outfit generation, trip transitions,
 * foreground, daily rollover).
 *
 * Contract: this function never throws and never blocks meaningful work. It
 * no-ops when the native bridge is absent (Android / Expo Go / pre-prebuild),
 * and a single bad thumbnail degrades to a null thumb rather than failing the
 * whole snapshot.
 */

import { OUTFIT_DEEP_LINK } from './deepLinks';
import { cacheThumb, isWidgetBridgeAvailable, pruneThumbs, writeSnapshot } from './native';
import type { OjoWidgetSnapshot, WidgetSnapshotInput } from './snapshot.types';

/** Widgets show at most a few items; cap work and payload size. */
const MAX_WIDGET_ITEMS = 4;

export async function updateWidgetSnapshot(input: WidgetSnapshotInput): Promise<void> {
  if (!isWidgetBridgeAvailable()) return;

  const items = input.items.slice(0, MAX_WIDGET_ITEMS);

  // Cache thumbnails in parallel; each resolves to a local path or null.
  const resolved = await Promise.all(
    items.map(async (it) => ({
      id: it.id,
      role: it.role,
      thumb: await cacheThumb(it.imageUrl),
    })),
  );

  const snapshot: OjoWidgetSnapshot = {
    mode: input.mode,
    updatedAt: new Date().toISOString(),
    headline: input.headline,
    tempLine: input.tempLine,
    items: resolved,
    trip: input.trip,
    deepLink: input.deepLink,
  };

  try {
    writeSnapshot(JSON.stringify(snapshot));
    // Drop any thumbnails from previous snapshots that today's no longer uses.
    const keep = resolved
      .map((r) => r.thumb)
      .filter((t): t is string => t != null);
    pruneThumbs(keep);
  } catch (e) {
    console.warn('[Ojo] updateWidgetSnapshot failed:', e);
  }
}

/**
 * Reset the widget to its empty state — e.g. the closet was emptied or the user
 * signed out. Clears cached thumbnails too.
 */
export async function clearWidgetSnapshot(): Promise<void> {
  if (!isWidgetBridgeAvailable()) return;

  const snapshot: OjoWidgetSnapshot = {
    mode: 'empty',
    updatedAt: new Date().toISOString(),
    headline: '',
    items: [],
    deepLink: OUTFIT_DEEP_LINK,
  };

  try {
    writeSnapshot(JSON.stringify(snapshot));
    pruneThumbs([]);
  } catch (e) {
    console.warn('[Ojo] clearWidgetSnapshot failed:', e);
  }
}
