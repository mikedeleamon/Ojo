/**
 * manifest.ts — lookups into the published library.
 *
 * manifest.json is written by server/src/scripts/publishVisualLibrary.ts and
 * ships inside the app (decision D3 in docs/prerendered-visuals-plan.md): the
 * files themselves live on R2 under content-hashed names, so a published entry
 * never changes and coverage can be checked in CI (__tests__/manifest.test.ts).
 *
 * Until the first publish the manifest is empty (version 0), every lookup
 * returns null, and every caller shows today's fallback.
 */

import manifestJson from './manifest.json';
import type { LoopKey } from './looks';
import type { LibraryLoop, LibraryManifest } from './types';

export const LIBRARY_MANIFEST = manifestJson as LibraryManifest;

/** The story loop for a look (lookFor), or the recap. */
export function loopFor(key: LoopKey, manifest: LibraryManifest = LIBRARY_MANIFEST): LibraryLoop | null {
    return manifest.loops[key] ?? null;
}

/** False until the pipeline's first publish. */
export function isLibraryPublished(manifest: LibraryManifest = LIBRARY_MANIFEST): boolean {
    return Object.keys(manifest.loops).length > 0;
}
