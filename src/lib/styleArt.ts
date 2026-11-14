/**
 * styleArt.ts — the layout of a Style DNA poster, drawn from the wear history.
 *
 * Every mark means something:
 *   - the aura: one soft orb per most-worn color, sized by its share of wears;
 *   - the helix: a double strand in the two top colors, whose rungs are the
 *     user's actual most-worn color pairings, thicker the more they're worn;
 *   - the rings: one faint growth ring per ten outfits logged, like a tree's.
 *
 * Pure and seeded from the archetype, so a poster looks the same every time it's
 * drawn and only changes when the wear history does. components/StyleDna draws it.
 */

import { CSS_COLORS } from './colors/cssColors';
import { METALLIC_GRADIENTS } from './colors/metallicGradients';
import { hexToHsl, hslToHex } from '../components/WeatherHUD/colorMath';
import { rnd } from './weather/rainField';
import type { StyleArchetype } from './styleArchetype';

/** The poster's ground. Fixed: it's a brand surface, like a share card. */
export const ART_GROUND = ['#0B1120', '#111A2E', '#0B1120'] as const;

/** Shown for "Multi": a violet, since a single swatch can't be every color. */
const MULTI_HEX = '#a78bfa';

/** Lightness the art lifts a color to, so dark wardrobes still glow on the ground. */
const MIN_ORB_L = 0.38;
const MAX_ORB_L = 0.78;

/** The hex a clothing color name draws as on the dark ground. */
export function artHex(name: string): string {
    const metallic = METALLIC_GRADIENTS[name];
    const base = metallic ? metallic[1] : name === 'Multi' ? MULTI_HEX : CSS_COLORS[name] ?? '#9ca3af';
    const [h, s, l] = hexToHsl(base);
    // Black and grey have no hue to lift; give them a cool steel cast so a
    // Midnight poster reads as moonlight rather than mud.
    if (s < 0.08) return hslToHex(222, 0.18, Math.min(MAX_ORB_L, Math.max(MIN_ORB_L + 0.06, l)));
    return hslToHex(h, Math.max(s, 0.35), Math.min(MAX_ORB_L, Math.max(MIN_ORB_L, l)));
}

export interface ArtOrb {
    cx: number;
    cy: number;
    r: number;
    hex: string;
    opacity: number;
}

export interface ArtRung {
    x: number;
    y1: number;
    y2: number;
    hexA: string;
    hexB: string;
    width: number;
    /** Rungs at the helix's sides are seen edge-on, so fainter. */
    opacity: number;
}

export interface StyleArtLayout {
    width: number;
    height: number;
    orbs: ArtOrb[];
    rings: { cx: number; cy: number; r: number }[];
    /**
     * The helix is drawn one full turn wider than the art (`width + helixPeriod`)
     * and repeats exactly every `helixPeriod` points, rung colors included. Seen
     * from the side, a helix turning on its axis looks the same as one sliding
     * along it, so sliding this layer left by one period and wrapping makes it
     * rotate, seamlessly, with no redraw.
     */
    helixPeriod: number;
    strands: { back: [string, string]; front: [string, string]; hex: [string, string] };
    /** Rungs as drawn still (the share poster), across the extra turn too. */
    rungs: ArtRung[];
    /**
     * The helix's axis, for rungs that turn in place: centre line, swing, and
     * the angle to add to each rung's `phase` per full turn of the loop (2π).
     */
    axis: { y0: number; amp: number };
    /**
     * Rungs pinned at their x across the art, for the rotating helix. A rung's
     * two ends sit at y0 ± amp·sin(phase + turn), so as the helix turns each
     * rung swings through its axis, shortening to a point edge-on, while the
     * strands slide (which, side-on, is the same motion). `hexA` is strand 0's
     * end (y0 + amp·sin), `hexB` strand 1's.
     */
    turningRungs: { x: number; phase: number; hexA: string; hexB: string; width: number }[];
    grain: { x: number; y: number; r: number; o: number }[];
}

const round1 = (v: number) => Math.round(v * 10) / 10;

/** Growth rings: one per ten outfits, between two and eight. */
export const ringCount = (totalOutfits: number) => Math.min(8, Math.max(2, Math.round(totalOutfits / 10)));

export function layoutStyleArt(archetype: StyleArchetype, width: number, height: number): StyleArtLayout {
    const seed = archetype.seed % 100000;
    const m = Math.min(width, height);
    const fx = width * (0.5 + (rnd(seed, 1) - 0.5) * 0.16);
    // The aura and helix sit in the upper part: in the app the name and
    // tagline are set over the bottom of the art.
    const fy = height * 0.36;

    // ── Aura ──
    const palette = archetype.colors.length > 0 ? archetype.colors : [{ name: 'Grey', share: 1 }];
    const orbs: ArtOrb[] = palette.map((c, i) => {
        const angle = rnd(seed, 10 + i) * Math.PI * 2;
        const dist = i === 0 ? m * 0.04 : m * (0.16 + 0.22 * (1 - c.share)) * (0.7 + 0.5 * rnd(seed, 20 + i));
        return {
            cx: round1(fx + Math.cos(angle) * dist * (width / m)),
            cy: round1(fy + Math.sin(angle) * dist * 0.8),
            r: round1(m * (0.26 + 0.42 * Math.sqrt(c.share))),
            hex: artHex(c.name),
            opacity: Math.max(0.35, 0.85 - i * 0.12),
        };
    });

    // ── Rings ──
    const nRings = ringCount(archetype.totalOutfits);
    const rings = Array.from({ length: nRings }, (_, i) => ({
        cx: round1(fx),
        cy: round1(fy),
        r: round1(m * (0.16 + (0.34 * (i + 1)) / nRings)),
    }));

    // ── Helix ──
    // Across the upper third, two strands half a turn apart. Sampling a strand
    // and splitting it where it passes behind the other gives the depth: the
    // back halves are drawn first and fainter, the rungs, then the front halves.
    // One extra turn past the right edge, so it can rotate (see helixPeriod).
    const y0 = height * 0.3;
    const amp = height * 0.1;
    const wavelength = width * 0.62;
    const phase0 = rnd(seed, 30) * Math.PI * 2;
    const theta = (x: number) => (x / wavelength) * Math.PI * 2 + phase0;
    const strandY = (x: number, s: 0 | 1) => y0 + amp * Math.sin(theta(x) + s * Math.PI);
    // Strand 0 is in front where cos θ > 0; strand 1 is in front elsewhere.
    const inFront = (x: number, s: 0 | 1) => (Math.cos(theta(x)) > 0) === (s === 0);

    const span = width + wavelength;
    const step = 3;
    const back: [string, string] = ['', ''];
    const front: [string, string] = ['', ''];
    for (const s of [0, 1] as const) {
        let prev: { x: number; y: number; front: boolean } | null = null;
        for (let x = -step; x <= span + step; x += step) {
            const pt = { x, y: round1(strandY(x, s)), front: inFront(x, s) };
            // A new run starts where the strand crosses behind or in front, from
            // the previous sample, so the two halves meet without a gap.
            const d = !prev
                ? `M${pt.x} ${pt.y}`
                : prev.front === pt.front
                    ? `L${pt.x} ${pt.y}`
                    : `M${prev.x} ${prev.y}L${pt.x} ${pt.y}`;
            if (pt.front) front[s] += d;
            else back[s] += d;
            prev = pt;
        }
    }
    const strandHex: [string, string] = [
        artHex(palette[0].name),
        artHex((palette[1] ?? palette[0]).name),
    ];

    // No pairings logged (every outfit had one colored piece): pair neighbouring
    // colors instead, or a single color with itself.
    const pairs = archetype.pairs.length > 0
        ? archetype.pairs
        : palette.length > 1
            ? palette.slice(0, -1).map((c, i) => ({ a: c.name, b: palette[i + 1].name, share: 0.2 }))
            : [{ a: palette[0].name, b: palette[0].name, share: 0.2 }];
    const maxShare = Math.max(...pairs.map((p) => p.share), 0.01);
    // Eight rungs a turn, colored by their place in the turn, so the pattern
    // repeats exactly once per helixPeriod.
    const RUNGS_PER_TURN = 8;
    const rungGap = wavelength / RUNGS_PER_TURN;
    const rungs: ArtRung[] = [];
    for (let i = 0, x = rungGap / 2; x < span + rungGap; i++, x += rungGap) {
        const p = pairs[(i % RUNGS_PER_TURN) % pairs.length];
        const edgeOn = Math.abs(Math.cos(theta(x)));
        rungs.push({
            x: round1(x),
            y1: round1(strandY(x, 0)),
            y2: round1(strandY(x, 1)),
            hexA: artHex(p.a),
            hexB: artHex(p.b),
            width: round1(1.2 + 2.4 * (p.share / maxShare)),
            opacity: round1(0.25 + 0.65 * edgeOn),
        });
    }

    // ── Grain ──
    const grain = Array.from({ length: 70 }, (_, i) => ({
        x: round1(rnd(seed + i, 41) * width),
        y: round1(rnd(seed + i, 42) * height),
        r: round1(0.4 + 0.7 * rnd(seed + i, 43)),
        o: round1(0.08 + 0.27 * rnd(seed + i, 44)),
    }));

    // The same rungs, pinned across the art, each knowing its angle on the helix.
    const turningRungs = rungs
        .filter((r) => r.x <= width)
        .map((r) => ({ x: r.x, phase: theta(r.x), hexA: r.hexA, hexB: r.hexB, width: r.width }));

    return {
        width,
        height,
        orbs,
        rings,
        axis: { y0, amp },
        turningRungs,
        helixPeriod: wavelength,
        strands: { back, front, hex: strandHex },
        rungs,
        grain,
    };
}
