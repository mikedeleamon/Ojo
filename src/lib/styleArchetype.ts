/**
 * styleArchetype.ts — a name for how someone dresses, read from what they've
 * actually worn.
 *
 * Style DNA already knows the numbers (top colors, fabric, category, pairings),
 * but numbers aren't something a person claims or shares. This turns them into
 * an identity: "The Midnight Commuter", "The Earthbound Ranger". The name is two
 * readings of the wear history:
 *
 *   adjective ← the palette's character (dark, tonal, earthy, vivid, pastel,
 *               metallic, blue, or all over the place)
 *   noun      ← the silhouette: the most-worn category, overridden by a fabric
 *               that dominates strongly enough to define the look
 *
 * Every input is weighted by wears, not by what's in the closet: a closet full
 * of colour worn in black every day is a Midnight closet. Pure and seeded, so the
 * name and the art laid out from it are stable between visits and testable.
 *
 * Names are Ojo's own. Don't borrow another app's archetype names.
 */

import type { UserPreferenceProfile } from './userPreferences';

// ─── Palette ────────────────────────────────────────────────────────────────

export type PaletteMood =
    | 'midnight'
    | 'tonal'
    | 'earthen'
    | 'vivid'
    | 'pastel'
    | 'gilded'
    | 'tidal'
    | 'prismatic'
    | 'balanced';

type Family = 'dark' | 'light' | 'earth' | 'cool' | 'bright' | 'soft' | 'metal' | 'multi';

/** Each clothing color in lib/colors/palettes, in exactly one family. */
const FAMILY: Record<string, Family> = {
    Black: 'dark', Navy: 'dark', Grey: 'dark',
    White: 'light', Cream: 'light', Beige: 'light',
    Brown: 'earth', Khaki: 'earth', Olive: 'earth', Rust: 'earth', Sage: 'earth', Burgundy: 'earth',
    Indigo: 'cool', Cobalt: 'cool', Blue: 'cool', 'Electric Blue': 'cool', 'Sky Blue': 'cool',
    Periwinkle: 'cool', Teal: 'cool', Cyan: 'cool', 'Baby Blue': 'cool',
    Red: 'bright', Scarlet: 'bright', Crimson: 'bright', Orange: 'bright', Yellow: 'bright',
    Green: 'bright', Lime: 'bright', 'Hot Pink': 'bright', Fuchsia: 'bright', Magenta: 'bright', Coral: 'bright',
    Mint: 'soft', Peach: 'soft', Lilac: 'soft', Lavender: 'soft', Pink: 'soft', Rose: 'soft',
    'Dusty Rose': 'soft', Blush: 'soft', Purple: 'soft', Plum: 'soft',
    Silver: 'metal', Gold: 'metal', Bronze: 'metal', 'Rose Gold': 'metal', Champagne: 'metal',
    Multi: 'multi',
};

export const MOOD_ADJECTIVE: Readonly<Record<PaletteMood, string>> = {
    midnight: 'Midnight',
    tonal: 'Tonal',
    earthen: 'Earthbound',
    vivid: 'Vivid',
    pastel: 'Pastel',
    gilded: 'Gilded',
    tidal: 'Tidal',
    prismatic: 'Prismatic',
    balanced: 'Measured',
};

export const MOOD_LINE: Readonly<Record<PaletteMood, string>> = {
    midnight: 'Dark, deliberate colors that go with everything.',
    tonal: 'Neutrals worn with intent. The outfit speaks softly.',
    earthen: 'Grounded in browns, olives and rust.',
    vivid: 'Color first, and never shy about it.',
    pastel: 'Soft color, worn lightly.',
    gilded: 'A little shine, most days.',
    tidal: 'Blues, from the shallows to deep water.',
    prismatic: 'A different palette every day, and it works.',
    balanced: 'A bit of everything, kept in balance.',
};

const shareOf = (counts: Record<string, number>) => {
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    return (key: string) => (total > 0 ? (counts[key] ?? 0) / total : 0);
};

/** Wear share per color family. */
export function familyShares(colors: Record<string, number>): Record<Family, number> {
    const out: Record<Family, number> = { dark: 0, light: 0, earth: 0, cool: 0, bright: 0, soft: 0, metal: 0, multi: 0 };
    const total = Object.values(colors).reduce((a, b) => a + b, 0);
    if (total <= 0) return out;
    for (const [name, n] of Object.entries(colors)) {
        const fam = FAMILY[name];
        if (fam) out[fam] += n / total;
    }
    return out;
}

/**
 * The palette's character. Rules run in order, most distinctive first: a
 * scattered palette or real shine says more than "mostly dark" does.
 */
export function paletteMood(colors: Record<string, number>): PaletteMood {
    const total = Object.values(colors).reduce((a, b) => a + b, 0);
    if (total <= 0) return 'balanced';
    const share = shareOf(colors);
    const fam = familyShares(colors);
    const shares = Object.keys(colors).map(share).sort((a, b) => b - a);
    const distinct = shares.filter((s) => s >= 0.06).length;

    if (distinct >= 6 && shares[0] < 0.22) return 'prismatic';
    if (fam.metal >= 0.18) return 'gilded';
    if (fam.dark >= 0.55) return 'midnight';
    if (fam.bright + fam.multi >= 0.35) return 'vivid';
    if (fam.soft >= 0.3) return 'pastel';
    if (fam.earth >= 0.35) return 'earthen';
    if (fam.cool >= 0.35) return 'tidal';
    if (fam.dark + fam.light >= 0.65) return 'tonal';

    // Nothing dominates: name it after the biggest family that has a mood.
    const ranked: [PaletteMood, number][] = [
        ['midnight', fam.dark],
        ['tonal', fam.light],
        ['earthen', fam.earth],
        ['tidal', fam.cool],
        ['vivid', fam.bright + fam.multi],
        ['pastel', fam.soft],
        ['gilded', fam.metal],
    ];
    ranked.sort((a, b) => b[1] - a[1]);
    return ranked[0][1] >= 0.3 ? ranked[0][0] : 'balanced';
}

// ─── Silhouette ─────────────────────────────────────────────────────────────

export type Silhouette =
    | 'tailor'
    | 'commuter'
    | 'maverick'
    | 'mover'
    | 'homebody'
    | 'ranger'
    | 'drifter'
    | 'wanderer'
    | 'layerer'
    | 'rider'
    | 'muse'
    | 'pragmatist'
    | 'classicist';

export const SILHOUETTE_NOUN: Readonly<Record<Silhouette, string>> = {
    tailor: 'Tailor',
    commuter: 'Commuter',
    maverick: 'Maverick',
    mover: 'Mover',
    homebody: 'Homebody',
    ranger: 'Ranger',
    drifter: 'Drifter',
    wanderer: 'Wanderer',
    layerer: 'Layerer',
    rider: 'Rider',
    muse: 'Muse',
    pragmatist: 'Pragmatist',
    classicist: 'Classicist',
};

export const SILHOUETTE_LINE: Readonly<Record<Silhouette, string>> = {
    tailor: 'Sharp lines, dressed for the room.',
    commuter: 'Office-ready, whatever the forecast.',
    maverick: 'Street-built, on your own terms.',
    mover: 'Built to move.',
    homebody: 'Comfort is the dress code.',
    ranger: 'Ready for whatever is outside.',
    drifter: 'Lives in denim.',
    wanderer: 'Light, airy layers for the long way round.',
    layerer: 'Wool and warmth, one layer at a time.',
    rider: 'Leather does the talking.',
    muse: 'Silk and drape.',
    pragmatist: 'Practical fabrics that do the job.',
    classicist: 'Easy, timeless basics.',
};

const CATEGORY_SILHOUETTE: Record<string, Silhouette> = {
    Formal: 'tailor',
    'Business Casual': 'commuter',
    Streetwear: 'maverick',
    Athletic: 'mover',
    Lounge: 'homebody',
    Outdoor: 'ranger',
};

const CASUAL_BY_FABRIC: Record<string, Silhouette> = {
    Denim: 'drifter',
    Linen: 'wanderer',
    Wool: 'layerer',
    Leather: 'rider',
    Silk: 'muse',
    Polyester: 'pragmatist',
    Synthetic: 'pragmatist',
};

const top = (counts: Record<string, number>): string | null =>
    Object.entries(counts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] ?? null;

/**
 * The silhouette. A fabric that dominates the wear history defines the look on
 * its own (someone in leather most days is a Rider whatever the category);
 * otherwise the most-worn category does, and plain Casual is read through the
 * favorite fabric.
 */
export function silhouetteFor(
    categories: Record<string, number>,
    fabrics: Record<string, number>,
): Silhouette {
    const fabric = shareOf(fabrics);
    if (fabric('Leather') >= 0.25) return 'rider';
    if (fabric('Silk') >= 0.2) return 'muse';
    if (fabric('Denim') >= 0.4) return 'drifter';

    const cat = top(categories);
    if (cat && CATEGORY_SILHOUETTE[cat]) return CATEGORY_SILHOUETTE[cat];
    const fab = top(fabrics);
    return (fab && CASUAL_BY_FABRIC[fab]) || 'classicist';
}

// ─── Archetype ──────────────────────────────────────────────────────────────

export interface StyleArchetype {
    name: string;
    mood: PaletteMood;
    silhouette: Silhouette;
    /** One line on the palette, one on the silhouette. */
    tagline: string;
    detail: string;
    /** Up to five most-worn colors and their wear shares, most worn first. */
    colors: { name: string; share: number }[];
    /** Most-worn color pairings, most worn first. */
    pairs: { a: string; b: string; share: number }[];
    topFabric: string | null;
    /** Median feels-like (°F) of the logged outfits that recorded it, or null. */
    typicalFeelsLikeF: number | null;
    totalOutfits: number;
    /** Stable seed for laying out the art. */
    seed: number;
}

/** A small stable string hash (FNV-1a), for seeding the art. */
export function hashString(s: string): number {
    let h = 0x811c9dc5;
    for (let i = 0; i < s.length; i++) {
        h ^= s.charCodeAt(i);
        h = Math.imul(h, 0x01000193);
    }
    return h >>> 0;
}

const median = (xs: number[]): number | null => {
    if (xs.length === 0) return null;
    const s = [...xs].sort((a, b) => a - b);
    const mid = Math.floor(s.length / 2);
    return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
};

/**
 * The archetype for a preference profile, or null before there's anything to
 * read (no colors worn yet). `feelsLikeF` are the logged outfits' recorded
 * feels-like temperatures, where they have one.
 */
export function computeStyleArchetype(
    profile: UserPreferenceProfile,
    feelsLikeF: number[] = [],
): StyleArchetype | null {
    const colorTotal = Object.values(profile.colors).reduce((a, b) => a + b, 0);
    if (colorTotal <= 0) return null;

    const mood = paletteMood(profile.colors);
    const silhouette = silhouetteFor(profile.categories, profile.fabrics);
    const name = `The ${MOOD_ADJECTIVE[mood]} ${SILHOUETTE_NOUN[silhouette]}`;

    const colors = Object.entries(profile.colors)
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .slice(0, 5)
        .map(([c, n]) => ({ name: c, share: n / colorTotal }));

    const pairTotal = Object.values(profile.colorPairs).reduce((a, b) => a + b, 0);
    const pairs = Object.entries(profile.colorPairs)
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .slice(0, 6)
        .map(([key, n]) => {
            const [a, b] = key.split('|');
            return { a, b, share: pairTotal > 0 ? n / pairTotal : 0 };
        })
        .filter((p) => p.a && p.b);

    const temps = feelsLikeF.filter((t) => Number.isFinite(t));
    const typical = median(temps);

    return {
        name,
        mood,
        silhouette,
        tagline: MOOD_LINE[mood],
        detail: SILHOUETTE_LINE[silhouette],
        colors,
        pairs,
        topFabric: top(profile.fabrics),
        typicalFeelsLikeF: typical === null ? null : Math.round(typical),
        totalOutfits: profile.totalOutfits,
        seed: hashString(`${name}|${colors.map((c) => c.name).join(',')}`),
    };
}
