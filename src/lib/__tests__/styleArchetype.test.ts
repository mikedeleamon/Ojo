import {
    computeStyleArchetype,
    hashString,
    paletteMood,
    silhouetteFor,
} from '../styleArchetype';
import { artHex, layoutStyleArt, ringCount } from '../styleArt';
import { hexToHsl } from '../../components/WeatherHUD/colorMath';
import type { UserPreferenceProfile } from '../userPreferences';

const profile = (p: Partial<UserPreferenceProfile>): UserPreferenceProfile => ({
    colors: {},
    fabrics: {},
    categories: {},
    colorPairs: {},
    totalOutfits: 0,
    ...p,
});

describe('paletteMood', () => {
    it('reads a mostly dark wardrobe as Midnight', () => {
        expect(paletteMood({ Black: 10, Navy: 6, Grey: 3, White: 2 })).toBe('midnight');
    });
    it('reads neutrals worn together as Tonal', () => {
        expect(paletteMood({ Cream: 6, Beige: 5, Black: 3, White: 4, Navy: 1 })).toBe('tonal');
    });
    it('reads browns, olives and rust as Earthbound', () => {
        expect(paletteMood({ Brown: 5, Olive: 4, Rust: 3, Cream: 3, Black: 2 })).toBe('earthen');
    });
    it('reads bright color as Vivid', () => {
        expect(paletteMood({ Red: 4, Yellow: 3, Black: 4, White: 3 })).toBe('vivid');
    });
    it('reads soft color as Pastel', () => {
        expect(paletteMood({ Lilac: 4, Blush: 3, White: 4, Grey: 3 })).toBe('pastel');
    });
    it('notices shine before anything else but scatter', () => {
        expect(paletteMood({ Black: 8, Gold: 3, Silver: 1 })).toBe('gilded');
    });
    it('reads blues as Tidal', () => {
        expect(paletteMood({ Blue: 4, Teal: 2, 'Sky Blue': 2, White: 4, Grey: 1 })).toBe('tidal');
    });
    it('reads an even spread of many colors as Prismatic', () => {
        expect(paletteMood({ Red: 2, Blue: 2, Green: 2, Yellow: 2, Pink: 2, Brown: 2, Black: 2, White: 2 })).toBe('prismatic');
    });
    it('weights by wears, not by what is owned', () => {
        // Same colors, opposite habits.
        expect(paletteMood({ Black: 20, Red: 2, Yellow: 2 })).toBe('midnight');
        expect(paletteMood({ Black: 2, Red: 10, Yellow: 10 })).toBe('vivid');
    });
    it('is Measured with nothing to go on', () => {
        expect(paletteMood({})).toBe('balanced');
    });
});

describe('silhouetteFor', () => {
    it('follows the most-worn category', () => {
        expect(silhouetteFor({ 'Business Casual': 8, Casual: 3 }, { Cotton: 5 })).toBe('commuter');
        expect(silhouetteFor({ Formal: 6 }, { Wool: 4 })).toBe('tailor');
        expect(silhouetteFor({ Outdoor: 6, Casual: 2 }, {})).toBe('ranger');
        expect(silhouetteFor({ Athletic: 5 }, {})).toBe('mover');
    });
    it('reads plain casual through the favorite fabric', () => {
        expect(silhouetteFor({ Casual: 9 }, { Linen: 5, Cotton: 3 })).toBe('wanderer');
        expect(silhouetteFor({ Casual: 9 }, { Wool: 5, Cotton: 3 })).toBe('layerer');
        expect(silhouetteFor({ Casual: 9 }, { Cotton: 5 })).toBe('classicist');
    });
    it('lets a dominant fabric define the look whatever the category', () => {
        expect(silhouetteFor({ Formal: 9 }, { Leather: 3, Cotton: 5 })).toBe('rider');
        expect(silhouetteFor({ Casual: 9 }, { Denim: 6, Cotton: 4 })).toBe('drifter');
    });
    it('falls back to Classicist with no history', () => {
        expect(silhouetteFor({}, {})).toBe('classicist');
    });
});

describe('computeStyleArchetype', () => {
    const p = profile({
        colors: { Navy: 12, Black: 6, Cream: 4, Grey: 3 },
        fabrics: { Wool: 6, Cotton: 9 },
        categories: { 'Business Casual': 10, Casual: 4 },
        colorPairs: { 'Cream|Navy': 7, 'Black|Navy': 3, 'Black|Grey': 1 },
        totalOutfits: 34,
    });

    it('names the style from palette and silhouette', () => {
        const a = computeStyleArchetype(p, [40, 52, 55, 61, 70])!;
        expect(a.name).toBe('The Midnight Commuter');
        expect(a.mood).toBe('midnight');
        expect(a.silhouette).toBe('commuter');
        expect(a.tagline.length).toBeGreaterThan(0);
        expect(a.detail.length).toBeGreaterThan(0);
    });

    it('keeps the facts behind the name', () => {
        const a = computeStyleArchetype(p, [40, 52, 55, 61, 70])!;
        expect(a.colors.map((c) => c.name)).toEqual(['Navy', 'Black', 'Cream', 'Grey']);
        expect(a.colors[0].share).toBeCloseTo(12 / 25);
        expect(a.pairs[0]).toEqual({ a: 'Cream', b: 'Navy', share: 7 / 11 });
        expect(a.topFabric).toBe('Cotton');
        expect(a.typicalFeelsLikeF).toBe(55);
        expect(a.totalOutfits).toBe(34);
    });

    it('has no typical weather when no outfit recorded it', () => {
        expect(computeStyleArchetype(p)!.typicalFeelsLikeF).toBeNull();
        expect(computeStyleArchetype(p, [50, 60])!.typicalFeelsLikeF).toBe(55);
    });

    it('is stable: same history, same name and seed', () => {
        expect(computeStyleArchetype(p)).toEqual(computeStyleArchetype(p));
    });

    it('has nothing to name before a color is worn', () => {
        expect(computeStyleArchetype(profile({ totalOutfits: 12 }))).toBeNull();
    });

    it('hashes strings stably and distinctly', () => {
        expect(hashString('a')).toBe(hashString('a'));
        expect(hashString('a')).not.toBe(hashString('b'));
        expect(hashString('anything')).toBeGreaterThanOrEqual(0);
    });
});

describe('style art', () => {
    const a = computeStyleArchetype(
        profile({
            colors: { Black: 10, Navy: 5, White: 2 },
            fabrics: { Cotton: 4 },
            categories: { Casual: 4 },
            colorPairs: { 'Black|White': 4, 'Black|Navy': 2 },
            totalOutfits: 42,
        }),
    )!;

    it('lifts dark colors so a dark wardrobe still glows', () => {
        const [, , l] = hexToHsl(artHex('Black'));
        expect(l).toBeGreaterThanOrEqual(0.38);
        const [, , navyL] = hexToHsl(artHex('Navy'));
        expect(navyL).toBeGreaterThanOrEqual(0.38);
    });

    it('knows metallics and Multi', () => {
        expect(artHex('Gold')).toMatch(/^#[0-9a-f]{6}$/);
        expect(artHex('Multi')).toMatch(/^#[0-9a-f]{6}$/);
        expect(artHex('Not a color')).toMatch(/^#[0-9a-f]{6}$/);
    });

    it('draws one orb per worn color, biggest for the most worn', () => {
        const art = layoutStyleArt(a, 320, 200);
        expect(art.orbs).toHaveLength(3);
        expect(art.orbs[0].r).toBeGreaterThan(art.orbs[2].r);
    });

    it('builds the helix rungs from the real pairings, thicker when worn more', () => {
        const art = layoutStyleArt(a, 320, 200);
        expect(art.rungs.length).toBeGreaterThan(4);
        expect(art.rungs[0].hexA).toBe(artHex('Black'));
        expect(art.rungs[0].hexB).toBe(artHex('White'));
        expect(art.rungs[0].width).toBeGreaterThan(art.rungs[1].width);
        for (const r of art.rungs) {
            expect(r.opacity).toBeGreaterThan(0);
            expect(r.opacity).toBeLessThanOrEqual(1);
        }
        expect(art.strands.front[0].startsWith('M') || art.strands.back[0].startsWith('M')).toBe(true);
    });

    it('rings the outfits logged, within limits', () => {
        expect(ringCount(0)).toBe(2);
        expect(ringCount(42)).toBe(4);
        expect(ringCount(500)).toBe(8);
        expect(layoutStyleArt(a, 320, 200).rings).toHaveLength(4);
    });

    it('repeats the helix exactly once a turn, one turn past the edge, so sliding it reads as rotation', () => {
        const art = layoutStyleArt(a, 320, 200);
        const period = art.helixPeriod;
        expect(period).toBeGreaterThan(0);
        const perTurn = art.rungs.filter((r) => r.x < period).length;
        expect(perTurn).toBe(8);
        for (let i = 0; i + perTurn < art.rungs.length; i++) {
            const r = art.rungs[i];
            const next = art.rungs[i + perTurn];
            expect(next.x - r.x).toBeCloseTo(period, 0);
            expect(next.hexA).toBe(r.hexA);
            expect(next.hexB).toBe(r.hexB);
            expect(next.y1).toBeCloseTo(r.y1, 0);
            expect(next.opacity).toBeCloseTo(r.opacity, 1);
        }
        // Covers the art plus one full turn.
        expect(Math.max(...art.rungs.map((r) => r.x))).toBeGreaterThan(320 + period - period / 8);
    });

    it('pins rungs across the art with their ends on the strands, so they can turn in place', () => {
        const art = layoutStyleArt(a, 320, 200);
        expect(art.turningRungs.length).toBeGreaterThan(4);
        for (const r of art.turningRungs) {
            expect(r.x).toBeGreaterThanOrEqual(0);
            expect(r.x).toBeLessThanOrEqual(320);
            const still = art.rungs.find((s) => s.x === r.x)!;
            // At the start of a turn, strand 0's end is y0 + amp·sin(phase), strand 1's mirrors it.
            expect(still.y1).toBeCloseTo(art.axis.y0 + art.axis.amp * Math.sin(r.phase), 0);
            expect(still.y2).toBeCloseTo(art.axis.y0 - art.axis.amp * Math.sin(r.phase), 0);
            expect(r.hexA).toBe(still.hexA);
        }
    });

    it('draws a helix even when no outfit paired two colors', () => {
        const solo = computeStyleArchetype(profile({ colors: { Black: 5 }, totalOutfits: 12 }))!;
        const art = layoutStyleArt(solo, 300, 190);
        expect(art.rungs.length).toBeGreaterThan(0);
        expect(art.rungs[0].hexA).toBe(art.rungs[0].hexB);
    });

    it('lays out the same every time', () => {
        expect(layoutStyleArt(a, 320, 200)).toEqual(layoutStyleArt(a, 320, 200));
    });
});
