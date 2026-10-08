/**
 * rainField.ts — lays out the falling-rain drops for a canvas.
 *
 * Pure, so the two renderers share one layout: StormIconLightning draws it in
 * the app, and scripts/visual-library/export_data.ts writes it out for the
 * story loops (render_loops.py only draws what it's given).
 *
 * Each band becomes one tile: a static field of drops, `period` taller than
 * the canvas, that sits `period` above it and slides down-and-sideways by one
 * period per loop. The drops repeat every period along the wind slant, so
 * when the tile snaps back the picture is identical and the loop is seamless.
 */

import {
    RAIN_REF_WIDTH,
    RAIN_VARIANTS,
    type RainField,
    type RainVariant,
} from './backdropSpec';

export interface RainDrop {
    /** Top-left of the unrotated streak, in tile points. */
    x: number;
    y: number;
    w: number;
    len: number;
    opacity: number;
}

export interface RainTile {
    /** Points the tile falls per loop, and the loop's length. */
    period: number;
    loopMs: number;
    /** Tile height in points: canvas height + period. The tile's top sits at -period. */
    height: number;
    drops: RainDrop[];
}

/** The promo video's seeded random (a sin hash): the same pattern on every run. */
export function rnd(i: number, k: number): number {
    const x = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453;
    return x - Math.floor(x);
}

const lerp = (range: readonly [number, number], t: number) => range[0] + (range[1] - range[0]) * t;

/**
 * Tiles for a rain variant on a `width` × `height` canvas (points), with the
 * given wind slant (horizontal drift per unit of fall; see windSlant).
 */
export function rainTiles(variant: RainVariant, width: number, height: number, angle: number): RainTile[] {
    const scale = width / RAIN_REF_WIDTH;
    // A drop moves along the line x = c + angle * y. Lines that cross the
    // canvas have c in [lo, lo + span]; spreading drops over that whole range
    // keeps the density even when the wind slants them in from off-screen.
    const span = width + Math.abs(angle) * height;
    const lo = Math.min(0, -angle * height);
    // `count` is per still-air 9:16 canvas; cover the actual area at that density.
    const areaFactor = (span * height) / (width * width * (16 / 9));

    const tiles: RainTile[] = [];
    let seed = 0;
    RAIN_VARIANTS[variant].forEach((field: RainField) => {
        const perBand = (field.count * areaFactor) / field.bands.length;
        field.bands.forEach((band) => {
            const period = band.periodF * height;
            const unique = Math.max(1, Math.round(perBand * band.periodF));
            const w = field.width * scale;
            // Copies needed to cover the tile, plus one above it for tails
            // that hang down into the top edge.
            const copies = Math.ceil(height / period) + 1;
            const drops: RainDrop[] = [];
            for (let n = 0; n < unique; n++, seed++) {
                const c = lo + rnd(seed, 1) * span;
                const y0 = rnd(seed, 2) * period;
                const len = lerp(field.length, rnd(seed, 3)) * scale;
                const opacity = lerp(field.opacity, rnd(seed, 4));
                for (let k = -1; k <= copies; k++) {
                    const y = y0 + k * period;
                    if (y + len < 0 || y > height + period) continue;
                    // The tile's top is at screen y = -period at the start of a loop.
                    drops.push({ x: c + angle * (y - period) - w / 2, y, w, len, opacity });
                }
            }
            tiles.push({ period, loopMs: band.loopMs, height: height + period, drops });
        });
    });
    return tiles;
}

/** Streak tilt in degrees (SVG convention, clockwise) so streaks line up with their slanted fall. */
export function streakTiltDeg(angle: number): number {
    return (-Math.atan(angle) * 180) / Math.PI;
}
