/**
 * visualLibrary/types.ts — the contract between the offline loop renderer
 * (scripts/visual-library/) and the app.
 *
 * The library is a fixed set of short looping videos on R2, one per backdrop
 * look (looks.ts) plus the Weekly Recap, each rendered from the app's own
 * gradients and particle specs. Nothing is generated at runtime; the app only
 * downloads and caches. See docs/prerendered-visuals-plan.md.
 */

export interface LibraryAsset {
    /** Path under the library base URL, content-hashed: `loops/rain.8b21d0aa.mp4`. */
    path: string;
    /** Exact byte size. The cache rejects a download that doesn't match. */
    bytes: number;
    w?: number;
    h?: number;
}

export interface LibraryLoop extends LibraryAsset {
    /** The loop's first frame as a JPEG — what the share sheet previews instead of playing video. */
    poster: LibraryAsset;
}

export interface LibraryManifest {
    /** 0 until the pipeline first publishes; bumped by every publish after that. */
    version: number;
    /** Keyed by LoopKey (looks.ts). */
    loops: Record<string, LibraryLoop>;
}
