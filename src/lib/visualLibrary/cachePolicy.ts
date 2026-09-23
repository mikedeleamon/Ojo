/**
 * cachePolicy.ts — the pure half of the library cache: URLs, file names, and
 * which files to evict. The I/O half (cache.ts) needs expo-file-system, which
 * can't load under jest, so everything decidable without a disk lives here.
 */

import type { LibraryAsset } from './types';

/**
 * Most a phone keeps. A backdrop is ~300 KB and a loop ~4 MB, so this holds a
 * handful of loops plus every backdrop someone plausibly sees; without a cap,
 * someone who shares in every kind of weather would keep all 13 loops (~45 MB).
 */
export const LIBRARY_CACHE_CAP_BYTES = 25 * 1024 * 1024;

/** Full URL for an asset, or null when no base URL is configured (dev builds). */
export function libraryUrl(baseUrl: string | null | undefined, asset: LibraryAsset): string | null {
  const base = baseUrl?.trim().replace(/\/+$/, '');
  if (!base) return null;
  return `${base}/${asset.path.replace(/^\/+/, '')}`;
}

/**
 * Flat cache file name for a library path:
 * `plates/rain.day.3f9a1c2e.jpg` → `plates__rain.day.3f9a1c2e.jpg`.
 * Paths are content-hashed, so the name alone identifies the exact bytes.
 */
export const cacheFileName = (path: string): string =>
  path.replace(/^\/+/, '').replace(/\//g, '__');

export interface CachedEntry {
  name: string;
  bytes: number;
  /** Milliseconds since epoch; files are written once, so this is download time. */
  modifiedAt: number;
}

/**
 * Names to delete to get the cache under `capBytes`, oldest download first.
 * Names in `keep` are never evicted — the file about to be used, or the one
 * just downloaded — even if that leaves the cache over the cap.
 */
export function evictionPlan(
  entries: readonly CachedEntry[],
  capBytes: number,
  keep: ReadonlySet<string> = new Set(),
): string[] {
  let total = entries.reduce((sum, e) => sum + e.bytes, 0);
  if (total <= capBytes) return [];

  const victims: string[] = [];
  const oldestFirst = [...entries].sort((a, b) => a.modifiedAt - b.modifiedAt);
  for (const entry of oldestFirst) {
    if (total <= capBytes) break;
    if (keep.has(entry.name)) continue;
    victims.push(entry.name);
    total -= entry.bytes;
  }
  return victims;
}
