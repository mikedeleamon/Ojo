import { LIBRARY_MANIFEST, isLibraryPublished, loopFor } from '../manifest';
import { REQUIRED_LOOP_KEYS } from '../looks';
import type { LibraryAsset, LibraryManifest } from '../types';

// Paths the publish script writes: content-hashed, so a published file never changes.
//   loops/rain.8b21d0aa.mp4   loops/sky.goldenHour.1c0ffee2.mp4   loops/rain.poster.0badf00d.jpg
const LOOP_PATH = /^loops\/[A-Za-z]+(\.[A-Za-z]+)?\.[0-9a-f]{8}\.mp4$/;
const POSTER_PATH = /^loops\/[A-Za-z]+(\.[A-Za-z]+)?\.poster\.[0-9a-f]{8}\.jpg$/;

const asset = (path: string): LibraryAsset => ({ path, bytes: 1 });

describe('committed manifest', () => {
    // A partly published library is the one state that can't be allowed: some
    // weather would get a story loop and the rest wouldn't. Empty or complete.
    it('is unpublished (version 0, empty) or has a loop with a poster for every look and the recap', () => {
        if (!isLibraryPublished()) {
            expect(LIBRARY_MANIFEST.version).toBe(0);
            for (const key of REQUIRED_LOOP_KEYS) expect(loopFor(key)).toBeNull();
            return;
        }
        expect(LIBRARY_MANIFEST.version).toBeGreaterThan(0);
        expect(REQUIRED_LOOP_KEYS.filter((key) => !LIBRARY_MANIFEST.loops[key]?.poster)).toEqual([]);
    });

    it('uses only known keys and content-hashed paths', () => {
        for (const [key, loop] of Object.entries(LIBRARY_MANIFEST.loops)) {
            expect(REQUIRED_LOOP_KEYS).toContain(key);
            expect(loop.path).toMatch(LOOP_PATH);
            expect(loop.poster.path).toMatch(POSTER_PATH);
            expect(loop.bytes).toBeGreaterThan(0);
            expect(loop.poster.bytes).toBeGreaterThan(0);
        }
    });
});

describe('lookups', () => {
    const manifest: LibraryManifest = {
        version: 1,
        loops: {
            'sky.sunset': { ...asset('loops/sky.sunset.00000004.mp4'), poster: asset('loops/sky.sunset.poster.00000005.jpg') },
        },
    };

    it('finds a loop by look, and nothing for a look that is missing', () => {
        expect(loopFor('sky.sunset', manifest)?.path).toBe('loops/sky.sunset.00000004.mp4');
        expect(loopFor('rain', manifest)).toBeNull();
    });

    it('treats an empty manifest as unpublished', () => {
        expect(isLibraryPublished({ version: 0, loops: {} })).toBe(false);
        expect(isLibraryPublished(manifest)).toBe(true);
    });

    it('accepts dotted look names in content-hashed paths', () => {
        expect('loops/partlyCloudy.night.0a1b2c3d.mp4').toMatch(LOOP_PATH);
        expect('loops/sky.dawnAfterglow.poster.0a1b2c3d.jpg').toMatch(POSTER_PATH);
    });
});
