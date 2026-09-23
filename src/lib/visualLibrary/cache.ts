/**
 * cache.ts — download-once access to library files.
 *
 * ensureLocal resolves a file:// URI for an asset, downloading it into
 * Caches/library/ the first time. Names are content-hashed, so a file that is
 * already there is always the right one: no revalidation, no ETags. Caches is
 * where Apple's storage guidance puts re-downloadable files, and iOS may clear
 * it under storage pressure — the next call simply downloads again.
 *
 * Same contract as segmentGarment (lib/vision/native.ts): it resolves null and
 * never throws — no base URL (dev builds), no network, a timeout, a size
 * mismatch. Every caller treats null as "show today's fallback".
 *
 * The library holds no user data, so logout leaves this cache alone.
 */

import { Directory, File, Paths } from 'expo-file-system';
import {
  cacheFileName,
  evictionPlan,
  libraryUrl,
  LIBRARY_CACHE_CAP_BYTES,
  type CachedEntry,
} from './cachePolicy';
import type { LibraryAsset } from './types';

const BASE_URL = process.env.EXPO_PUBLIC_LIBRARY_BASE_URL;

/** How long a caller waits. The download itself keeps going and lands in the cache for next time. */
const DEFAULT_TIMEOUT_MS = 20_000;

const PARTIAL_SUFFIX = '.part';

/** One download per file, however many callers ask for it at once. */
const inFlight = new Map<string, Promise<string | null>>();

export function ensureLocal(
  asset: LibraryAsset | null | undefined,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<string | null> {
  if (!asset) return Promise.resolve(null);
  const url = libraryUrl(BASE_URL, asset);
  if (!url) return Promise.resolve(null);

  const name = cacheFileName(asset.path);
  let pending = inFlight.get(name);
  if (!pending) {
    pending = fetchToCache(url, name, asset.bytes).finally(() => inFlight.delete(name));
    inFlight.set(name, pending);
  }
  return withTimeout(pending, timeoutMs);
}

async function fetchToCache(url: string, name: string, bytes: number): Promise<string | null> {
  try {
    const dir = libraryDir();
    const target = new File(dir, name);
    if (target.exists) {
      if (target.size === bytes) return target.uri;
      target.delete(); // wrong size: left over from an interrupted write
    }

    // Download beside the target and rename once verified, so a half-written
    // file can never be mistaken for a cached one.
    const partial = new File(dir, name + PARTIAL_SUFFIX);
    if (partial.exists) partial.delete();
    const downloaded = await File.downloadFileAsync(url, partial, { idempotent: true });
    if (downloaded.size !== bytes) {
      downloaded.delete();
      console.warn(`[Ojo][library] size mismatch for ${name}: got ${downloaded.size}, want ${bytes}`);
      return null;
    }
    downloaded.move(target);
    evictOverCap(dir, name);
    return target.uri;
  } catch (e) {
    console.warn(`[Ojo][library] download failed for ${name}:`, e);
    return null;
  }
}

function libraryDir(): Directory {
  const dir = new Directory(Paths.cache, 'library');
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
  return dir;
}

function evictOverCap(dir: Directory, justWritten: string): void {
  try {
    const files = dir
      .list()
      .filter((f): f is File => f instanceof File && !f.name.endsWith(PARTIAL_SUFFIX));
    const entries: CachedEntry[] = files.map(f => ({
      name: f.name,
      bytes: f.size,
      modifiedAt: f.modificationTime ?? 0,
    }));
    const victims = new Set(evictionPlan(entries, LIBRARY_CACHE_CAP_BYTES, new Set([justWritten])));
    for (const f of files) if (victims.has(f.name)) f.delete();
  } catch (e) {
    // Eviction is housekeeping; a failure here must not fail the download.
    console.warn('[Ojo][library] eviction failed:', e);
  }
}

function withTimeout<T>(promise: Promise<T | null>, ms: number): Promise<T | null> {
  if (!Number.isFinite(ms)) return promise;
  return new Promise(resolve => {
    const timer = setTimeout(() => resolve(null), ms);
    promise.then(
      value => { clearTimeout(timer); resolve(value); },
      () => { clearTimeout(timer); resolve(null); },
    );
  });
}
