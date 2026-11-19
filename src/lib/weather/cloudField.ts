/**
 * cloudField.ts — lays out the drifting clouds for a canvas.
 *
 * Pure, like rainField: CloudDrift draws what this returns, and the tests
 * measure it. Two shapes of cloud:
 *   - partly cloudy: separate cumulus, each a wide soft body with a row of
 *     puffs standing on a flat base, tallest toward the middle, and a shaded
 *     belly under the base;
 *   - overcast: one deck of soft lumps scattered on a jittered grid, each a few
 *     overlapping puffs of mixed size, some with a shaded underside.
 */

import {
    CLOUD_LAYERS,
    CLOUD_PUFF_FALLOFF,
    type CloudCover,
    type CloudLayerSpec,
    type OvercastLayerSpec,
} from './backdropSpec';
import { rnd } from './rainField';

/** An ellipse with a radial fade, in canvas points. */
export interface Puff {
    cx: number;
    cy: number;
    rx: number;
    ry: number;
}

export interface CloudShape {
    /**
     * Which cloud or lump this is, within its layer. Every whole-width copy of
     * it has the same number, and they share one gradient.
     */
    cloud: number;
    /** Opacity of one puff. */
    opacity: number;
    puffs: Puff[];
    /** The shade under it, drawn last, or null for none. */
    belly: Puff | null;
}

/** Opacity of the shade under a cloud whose puffs are drawn at `opacity`. */
export const bellyOpacity = (opacity: number) => Math.min(0.3, opacity * 0.9);

/**
 * Whole-width copies of each cloud. A layer's canvas is two widths wide and
 * slides left by one, so a cloud up to ~1.5 widths long has to be drawn at each
 * of these offsets to be there whenever it's in view.
 */
const COPIES = [-2, -1, 0, 1, 2];

const lerp = (range: readonly [number, number], t: number) => range[0] + (range[1] - range[0]) * t;

/** Shift a shape by whole canvas widths. */
const shifted = (shape: CloudShape, dx: number): CloudShape => ({
    ...shape,
    puffs: shape.puffs.map((p) => ({ ...p, cx: p.cx + dx })),
    belly: shape.belly && { ...shape.belly, cx: shape.belly.cx + dx },
});

/** Every copy of `shape` that can reach the two-width canvas. */
function copiesOnCanvas(shape: CloudShape, width: number): CloudShape[] {
    const left = Math.min(...shape.puffs.map((p) => p.cx - p.rx));
    const right = Math.max(...shape.puffs.map((p) => p.cx + p.rx));
    const out: CloudShape[] = [];
    for (const copy of COPIES) {
        const dx = copy * width;
        if (right + dx <= 0 || left + dx >= width * 2) continue;
        out.push(shifted(shape, dx));
    }
    return out;
}

/**
 * The clouds of one layer on a canvas `width` × `height` (one period wide; the
 * shapes span two). Copies that can't reach the two-width canvas are dropped.
 */
export function cloudShapes(
    cover: CloudCover,
    layerIndex: number,
    width: number,
    height: number,
): CloudShape[] {
    return cover === 'overcast'
        ? overcastShapes(CLOUD_LAYERS.overcast[layerIndex], width, height)
        : cumulusShapes(CLOUD_LAYERS.partly[layerIndex], layerIndex, width, height);
}

function cumulusShapes(layer: CloudLayerSpec, layerIndex: number, width: number, height: number): CloudShape[] {
    const out: CloudShape[] = [];
    layer.clouds.forEach((spec, ci) => {
        const seed = layerIndex * 97 + ci * 31 + 5;
        const n = Math.max(5, Math.round(spec.wf * 9));
        const w = spec.wf * width;
        const h = spec.hf * height;
        const base = spec.yf * height + h * 0.5;
        const cx = (spec.xf + spec.wf / 2) * width;
        const puffs: Puff[] = [{ cx, cy: base - h * 0.22, rx: w * 0.5, ry: h * 0.42 }];
        for (let i = 0; i < n; i++) {
            const f = (i + 0.5) / n;
            const r = h * (0.34 + 0.5 * Math.sin(Math.PI * f) * (0.6 + 0.6 * rnd(seed + i, 1)));
            puffs.push({
                cx: cx + (f - 0.5) * w * 0.84 + (rnd(seed + i, 2) - 0.5) * w * 0.05,
                cy: base - r * 0.78,
                rx: r * (1.05 + 0.5 * rnd(seed + i, 3)),
                ry: r,
            });
        }
        const cloud: CloudShape = {
            cloud: ci,
            opacity: spec.opacity,
            puffs,
            belly: { cx, cy: base + h * 0.06, rx: w * 0.46, ry: h * 0.3 },
        };
        out.push(...copiesOnCanvas(cloud, width));
    });
    return out;
}

/**
 * Lumps across one canvas width for an overcast layer: a whole number, so the
 * drift repeats, and even, so the lighter and darker turns along a row wrap
 * round without two of a kind meeting at the seam.
 */
export function overcastColumns(layer: OvercastLayerSpec, width: number, height: number): number {
    const ch = ((layer.bottom - layer.top) * height) / layer.rows;
    const even = 2 * Math.round(width / (ch * layer.cellAspect) / 2);
    const cap = layer.maxColumns - (layer.maxColumns % 2);
    return Math.min(cap, Math.max(2, even));
}

/**
 * An overcast layer's lumps. One lump per grid cell, a whole number of columns
 * to a canvas width so the layer repeats every width, odd rows set half a
 * column over so no two rows line up, and each lump strayed off its grid point.
 * Lumps are sized from the row height, so they keep their shape on any screen.
 */
function overcastShapes(layer: OvercastLayerSpec, width: number, height: number): CloudShape[] {
    const columns = overcastColumns(layer, width, height);
    const cw = width / columns;
    const ch = ((layer.bottom - layer.top) * height) / layer.rows;
    const out: CloudShape[] = [];
    for (let row = 0; row < layer.rows; row++) {
        for (let col = 0; col < columns; col++) {
            const k = layer.seed + row * 37 + col * 11;
            const index = row * columns + col;
            const across = col + 0.5 + layer.colPhase + (row % 2) * 0.5 + (rnd(k, 1) - 0.5) * 2 * layer.jitterX;
            // Kept within the first width; copiesOnCanvas repeats it.
            const cx = (((across * cw) % width) + width) % width;
            const cy = layer.top * height + (row + 0.5 + layer.rowPhase + (rnd(k, 2) - 0.5) * 2 * layer.jitterY) * ch;
            const tone = col % 2 === 0 ? 1 + layer.toneSpread : 1 - layer.toneSpread;
            const opacity = layer.opacity * tone * (1 + (rnd(k, 4) * 2 - 1) * layer.opacitySpread);
            // The body, then the rest set off it to either side and a little
            // up or down, so no lump has a straight edge.
            const ry = (lerp(layer.lumpH, rnd(k, 3)) * ch) / 2;
            const rx = ry * lerp(layer.aspect, rnd(k, 5));
            const puffs: Puff[] = [{ cx, cy, rx, ry }];
            for (let i = 1; i < layer.puffs; i++) {
                const side = i % 2 === 0 ? -1 : 1;
                const pry = ry * (0.5 + 0.25 * rnd(k + i, 6));
                puffs.push({
                    cx: cx + side * rx * (0.45 + 0.35 * rnd(k + i, 8)),
                    cy: cy + (rnd(k + i, 9) - 0.5) * 0.8 * ry,
                    rx: pry * lerp(layer.aspect, rnd(k + i, 7)),
                    ry: pry,
                });
            }
            const shaded = rnd(k, 10) < layer.shadedShare;
            const lump: CloudShape = {
                cloud: index,
                opacity,
                puffs,
                belly: shaded ? { cx, cy: cy + ry * 0.35, rx: rx * 0.9, ry: ry * 0.6 } : null,
            };
            out.push(...copiesOnCanvas(lump, width));
        }
    }
    return out;
}

/** A puff's share of its cloud's opacity at `d`, 0 at its centre to 1 at its edge. */
function falloff(d: number): number {
    if (d >= 1) return 0;
    const stops = CLOUD_PUFF_FALLOFF;
    for (let i = 1; i < stops.length; i++) {
        if (d <= stops[i].offset) {
            const a = stops[i - 1];
            const b = stops[i];
            return a.share + ((b.share - a.share) * (d - a.offset)) / (b.offset - a.offset);
        }
    }
    return 0;
}

/**
 * How much of the sky one layer's cloud covers at a point, 0–1: its puffs
 * composited the way they're drawn. The belly is left out, since it darkens.
 */
function layerCoverAt(shapes: CloudShape[], x: number, y: number): number {
    let clear = 1;
    for (const s of shapes) {
        for (const p of s.puffs) {
            const dx = (x - p.cx) / p.rx;
            const dy = (y - p.cy) / p.ry;
            const d2 = dx * dx + dy * dy;
            if (d2 < 1) clear *= 1 - s.opacity * falloff(Math.sqrt(d2));
        }
    }
    return 1 - clear;
}

/** Sample step along a row, in points. */
const ROW_STEP = 2;

/**
 * The cloud averaged along a row at height `yf` (0–1 of the canvas height), the
 * layers composited.
 *
 * This is what shows as stripes. Every layer only drifts sideways and repeats
 * every canvas width, so a row's average never changes as the layers move: a
 * row that averages denser than the rows beside it is denser for good, and a
 * run of them reads as a band. An even sky keeps this level from top to bottom
 * and puts its texture within rows instead (cloudRowSpread).
 */
export function meanCloudCover(cover: CloudCover, yf: number, width = 390, height = 844): number {
    const y = yf * height;
    let clear = 1;
    CLOUD_LAYERS[cover].forEach((_: unknown, li: number) => {
        const shapes = cloudShapes(cover, li, width, height);
        let sum = 0;
        let n = 0;
        for (let x = 0; x < width; x += ROW_STEP, n++) sum += layerCoverAt(shapes, x, y);
        clear *= 1 - sum / n;
    });
    return 1 - clear;
}

/** Relative positions of the layers that cloudRowSpread averages over. */
const SPREAD_OFFSETS = 8;

/**
 * How uneven the cloud is along a row at height `yf`: the standard deviation
 * of the cover across the row, zero for a flat sheet of grey. The layers drift
 * at different speeds, so how they line up keeps changing; this is the
 * root-mean-square over the second layer slid through a width of positions
 * against the first, which is what the row looks like over time.
 */
export function cloudRowSpread(cover: CloudCover, yf: number, width = 390, height = 844): number {
    const y = yf * height;
    const layers = CLOUD_LAYERS[cover].map((_: unknown, li: number) => cloudShapes(cover, li, width, height));
    // Each layer's row once, sampled over two widths so a slid layer can be read off it.
    const rowOf = (shapes: CloudShape[]) => {
        const out: number[] = [];
        for (let x = 0; x < width * 2; x += ROW_STEP) out.push(layerCoverAt(shapes, x, y));
        return out;
    };
    const lanes = layers.map(rowOf);
    const n = Math.floor(width / ROW_STEP);
    let variance = 0;
    for (let o = 0; o < SPREAD_OFFSETS; o++) {
        const slide = Math.floor((o * n) / SPREAD_OFFSETS);
        const samples: number[] = [];
        for (let i = 0; i < n; i++) {
            let clear = 1;
            lanes.forEach((lane, li) => { clear *= 1 - lane[li === 0 ? i : i + slide]; });
            samples.push(1 - clear);
        }
        const mean = samples.reduce((a, b) => a + b, 0) / n;
        variance += samples.reduce((a, b) => a + (b - mean) ** 2, 0) / n;
    }
    return Math.sqrt(variance / SPREAD_OFFSETS);
}

/**
 * The most cloud that can ever sit behind a point at height `yf` (0–1 of the
 * canvas height). The layers drift at different speeds, so sooner or later each
 * layer's densest part on that row lines up with every other's: the worst case
 * is each layer's own peak along the row, composited.
 */
export function peakCloudCover(cover: CloudCover, yf: number, width = 390, height = 844): number {
    const y = yf * height;
    let clear = 1;
    CLOUD_LAYERS[cover].forEach((_, li) => {
        const shapes = cloudShapes(cover, li, width, height);
        let peak = 0;
        for (let x = 0; x <= width; x += 2) peak = Math.max(peak, layerCoverAt(shapes, x, y));
        clear *= 1 - peak;
    });
    return 1 - clear;
}
