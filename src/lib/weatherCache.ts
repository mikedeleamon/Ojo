/**
 * weatherCache.ts
 * ───────────────
 * Local-only per-city cache of the last weather payload, so switching cities in
 * the HUD paints instantly and still renders offline. Keyed by location id —
 * the reserved id `CURRENT_LOCATION_ID` ('current') holds the GPS snapshot.
 *
 * This is NOT synced to the server: weather is cheap to re-fetch and quickly
 * goes stale. Only the saved-city LIST is synced (via Settings).
 */

import type { WeatherSnapshot } from '../types';
import { storage, storageGetJSON } from './storage';
import { getUserId } from './auth';

// Scoped to the authenticated user so snapshots never bleed between accounts.
const cacheKey = () => `ojo_weather_cache_${getUserId() ?? 'anon'}`;

const DEFAULT_MAX_AGE_MS = 30 * 60_000; // 30 min — matches the server-side TTL.

type SnapshotMap = Record<string, WeatherSnapshot>;

const readAll = async (): Promise<SnapshotMap> =>
  storageGetJSON<SnapshotMap>(storage, cacheKey(), {});

/** All cached snapshots, keyed by location id. */
export const getAllSnapshots = async (): Promise<SnapshotMap> => readAll();

/** Cached snapshot for one location id, or null if none is stored. */
export const getSnapshot = async (
  id: string,
): Promise<WeatherSnapshot | null> => {
  const all = await readAll();
  return all[id] ?? null;
};

/** Store (or replace) the snapshot for a location id. */
export const setSnapshot = async (
  id: string,
  snap: WeatherSnapshot,
): Promise<void> => {
  const all = await readAll();
  all[id] = snap;
  await storage.setItem(cacheKey(), JSON.stringify(all));
};

/** True when a snapshot is older than `maxAgeMs` (or missing/unparseable). */
export const isStale = (
  snap: WeatherSnapshot | null,
  maxAgeMs = DEFAULT_MAX_AGE_MS,
): boolean => {
  if (!snap) return true;
  const t = new Date(snap.fetchedAt).getTime();
  if (Number.isNaN(t)) return true;
  return Date.now() - t > maxAgeMs;
};
