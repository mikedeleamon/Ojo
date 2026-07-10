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
import type {
  OjoWidgetSnapshot,
  OjoWidgetSnapshotItem,
  WidgetSnapshotInput,
} from './snapshot.types';

/** Widgets show at most a few items; cap work and payload size. */
const MAX_WIDGET_ITEMS = 4;

/** Cache one outfit's thumbnails in parallel; each resolves to a local path or null. */
const resolveItems = async (
  items: WidgetSnapshotInput['items'],
): Promise<OjoWidgetSnapshotItem[]> =>
  Promise.all(
    items.slice(0, MAX_WIDGET_ITEMS).map(async (it) => ({
      id: it.id,
      role: it.role,
      thumb: await cacheThumb(it.imageUrl),
    })),
  );

export async function updateWidgetSnapshot(input: WidgetSnapshotInput): Promise<void> {
  if (!isWidgetBridgeAvailable()) return;

  // Every variant's thumbnails must be pre-cached — the "Change fit" intent
  // swaps variants without the app running, so nothing can be fetched later.
  // (cacheThumb keys by URL hash, so an item shared between variants — or with
  // the top-level items, which mirror variant 0 — is downloaded once.)
  const variants = input.variants
    ? await Promise.all(
        input.variants.map(async (v) => ({
          headline: v.headline,
          items: await resolveItems(v.items),
          layerNote: v.layerNote,
          alerts: v.alerts,
          uvIndexText: v.uvIndexText,
          timeline: v.timeline,
        })),
      )
    : undefined;

  // Top-level items mirror variant 0 (already resolved above); only a
  // variant-less input (empty mode / legacy caller) resolves its own.
  const resolved = variants?.[0]?.items ?? (await resolveItems(input.items));

  const snapshot: OjoWidgetSnapshot = {
    mode: input.mode,
    updatedAt: new Date().toISOString(),
    headline: input.headline,
    tempLine: input.tempLine,
    weather: input.weather,
    weatherKind: input.weatherKind,
    isDay: input.isDay,
    items: resolved,
    variants,
    layerNote: input.layerNote,
    alerts: input.alerts,
    uvIndexText: input.uvIndexText,
    timeline: input.timeline,
    emptyReason: input.emptyReason,
    trip: input.trip,
    upcomingTrip: input.upcomingTrip,
    deepLink: input.deepLink,
  };

  try {
    writeSnapshot(JSON.stringify(snapshot));
    // Drop any thumbnails from previous snapshots that today's no longer uses —
    // keeping every variant's, not just the visible outfit's.
    const keep = [...resolved, ...(variants ?? []).flatMap((v) => v.items)]
      .map((r) => r.thumb)
      .filter((t): t is string => t != null);
    pruneThumbs([...new Set(keep)]);
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
    alerts: [],
    deepLink: OUTFIT_DEEP_LINK,
  };

  try {
    writeSnapshot(JSON.stringify(snapshot));
    pruneThumbs([]);
  } catch (e) {
    console.warn('[Ojo] clearWidgetSnapshot failed:', e);
  }
}
