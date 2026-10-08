/**
 * backdropSpec.ts — the numbers behind WeatherHUD's full-screen weather backdrop.
 *
 * Pure data, no React Native, so two renderers read the same values:
 *   - the app's own layers (StormIconLightning, ClearNightIconMoon, ShootingStar,
 *     SunGlare, FlakeFall, FogDrift) under WeatherHUD's BackdropLayers;
 *   - the Instagram-story loops, rendered offline by
 *     scripts/visual-library/render_loops.py from the copy export_data.ts
 *     writes out. Change a value here and both follow.
 *
 * Every size is in points, as the layers draw it. Positions are 0–1 fractions
 * of the canvas; durations are milliseconds.
 */

// ─── Rain ───────────────────────────────────────────────────────────────────
// Ported from the rain in the Instagram promo video, which read far better than
// the old fixed grid of streak columns: every streak gets its own seeded-random
// position, length and opacity, and the field falls ~6× faster than the grid
// did. lib/weather/rainField lays the drops out; StormIconLightning draws them.
//
// A variant is one or more fields (sleet adds a field of round ice pellets to
// its streaks). A field's drops are split across speed bands. Each band is one
// native loop, translating a static SVG, so a band costs one animated view
// however many drops it holds — see the perf notes in StormIconLightning.

/** Widths and lengths are written in px of a 1080-px-wide frame, the promo video's, and scaled by canvas width / 1080. */
export const RAIN_REF_WIDTH = 1080;

export interface RainBand {
    /**
     * The band's drops repeat every `periodF` of the canvas height. Each band
     * gets a different period, so the combined field never repeats on screen.
     */
    periodF: number;
    /**
     * Milliseconds to fall one period. Every value divides 8000, so the 8 s
     * story loops are seamless; a drop crosses the canvas in loopMs / periodF.
     */
    loopMs: number;
}

export interface RainField {
    /** Drops on a still-air 9:16 canvas. Scaled up for taller canvases and for the wind slant. */
    count: number;
    /** Streak width and length range, in RAIN_REF_WIDTH px. Length = width draws a round pellet. */
    width: number;
    length: readonly [number, number];
    opacity: readonly [number, number];
    bands: readonly RainBand[];
}

export type RainVariant = 'storm' | 'light' | 'drizzle' | 'sleet';

export const RAIN_VARIANTS: Readonly<Record<RainVariant, readonly RainField[]>> = {
    // Plain rain: the promo video's rain, as written. Crosses the screen in 1.0–1.3 s.
    light: [{
        count: 70, width: 3, length: [36, 76], opacity: [0.2, 0.4],
        bands: [
            { periodF: 0.55, loopMs: 8000 / 11 },
            { periodF: 0.5, loopMs: 8000 / 14 },
            { periodF: 0.45, loopMs: 8000 / 18 },
        ],
    }],
    // Thunderstorm: denser, longer, brighter and faster (0.7–1.0 s).
    storm: [{
        count: 110, width: 3, length: [56, 110], opacity: [0.25, 0.5],
        bands: [
            { periodF: 0.55, loopMs: 8000 / 15 },
            { periodF: 0.5, loopMs: 8000 / 19 },
            { periodF: 0.45, loopMs: 8000 / 25 },
        ],
    }],
    // Drizzle: many short, thin, faint drops, slower than rain (1.6–2.1 s), as
    // fine droplets are.
    drizzle: [{
        count: 110, width: 2.5, length: [14, 30], opacity: [0.16, 0.32],
        bands: [
            { periodF: 0.55, loopMs: 8000 / 7 },
            { periodF: 0.5, loopMs: 8000 / 9 },
            { periodF: 0.45, loopMs: 8000 / 11 },
        ],
    }],
    // Sleet: short quick streaks (0.95–1.05 s), plus round ice pellets among them.
    sleet: [
        {
            count: 60, width: 3, length: [22, 44], opacity: [0.28, 0.46],
            bands: [
                { periodF: 0.55, loopMs: 8000 / 14 },
                { periodF: 0.5, loopMs: 8000 / 17 },
            ],
        },
        {
            count: 40, width: 7, length: [7, 7], opacity: [0.5, 0.75],
            bands: [{ periodF: 0.45, loopMs: 8000 / 15 }],
        },
    ],
};

/** Default wind drift for falling particles: translateX per unit of fall. WeatherHUD passes the live value (lib/weather/windSlant). */
export const DEFAULT_RAIN_ANGLE = 0.12;

// ─── Sheet lightning ─────────────────────────────────────────────────────────

/**
 * One strike: bright, near-dark, bright again, then a slow decay. Expressed as
 * a single interpolated timing rather than four chained ones, so a strike costs
 * one JS round-trip instead of four and its shape can't be stretched by a busy
 * JS thread mid-flash.
 */
export const FLASH_MS = 400;
export const FLASH_CURVE = {
    inputRange: [0, 50 / FLASH_MS, 110 / FLASH_MS, 180 / FLASH_MS, 1],
    outputRange: [0, 0.35, 0.05, 0.3, 0],
};

/** Gap between sheet-lightning strikes: FLASH_GAP_MIN_MS plus up to FLASH_GAP_SPREAD_MS, randomized per strike. */
export const FLASH_GAP_MIN_MS = 4500;
export const FLASH_GAP_SPREAD_MS = 4500;

// ─── Clear-night star field ─────────────────────────────────────────────────

export interface StarSeed {
    xf: number;
    yf: number;
    d: number;
}

/**
 * Star seeds. `xf`/`yf` are 0–1 fractions of the canvas; `d` is the star's
 * tip-to-tip span in **points**, and also drives its brightness.
 *
 * These were originally radii in viewBox units (r=12–22), which the
 * full-screen canvas scaled by `size / 1280` = 0.1406 pt per unit — so they
 * rendered at 3.4–6.2 pt across, and were rewritten into this table at
 * exactly that size. Small is still the baseline: it's what makes the sky
 * read as depth rather than as decoration, and the far band (d < NEAR_MIN_D)
 * stays there. The near band (d ≥ NEAR_MIN_D) has since been bumped past
 * that original ceiling on purpose — a visible size jump between the two
 * bands, not just a brightness and speed one, sharpens the near/far split
 * from `starLayer` instead of leaving it as a continuous gradient. Sizing in
 * points means what is written here is what lands on screen.
 *
 * Middle-band seeds (yf 0.35–0.66) stay outside xf 0.38–0.62 to clear the moon.
 */
export const STAR_SEEDS: readonly StarSeed[] = [
    // ── Top strip ──────────────────────────────────────────────────────────
    { xf: 0.02, yf: 0.02, d: 3.5 },
    { xf: 0.18, yf: 0.012, d: 3 },
    { xf: 0.35, yf: 0.027, d: 5.5 },
    { xf: 0.5, yf: 0.014, d: 3.5 },
    { xf: 0.65, yf: 0.023, d: 6 },
    { xf: 0.82, yf: 0.016, d: 3 },
    { xf: 0.98, yf: 0.022, d: 5.5 },
    // ── Upper ──────────────────────────────────────────────────────────────
    { xf: 0.02, yf: 0.125, d: 5 },
    { xf: 0.12, yf: 0.156, d: 3 },
    { xf: 0.25, yf: 0.07, d: 5.5 },
    { xf: 0.75, yf: 0.078, d: 3.5 },
    { xf: 0.88, yf: 0.172, d: 6 },
    { xf: 0.97, yf: 0.133, d: 3.5 },
    // ── Middle sides ───────────────────────────────────────────────────────
    { xf: 0.02, yf: 0.352, d: 5.5 },
    { xf: 0.08, yf: 0.5, d: 3.5 },
    { xf: 0.15, yf: 0.609, d: 3 },
    { xf: 0.25, yf: 0.406, d: 5 },
    { xf: 0.75, yf: 0.391, d: 5 },
    { xf: 0.85, yf: 0.563, d: 3.5 },
    { xf: 0.92, yf: 0.352, d: 5.5 },
    { xf: 0.98, yf: 0.5, d: 6 },
    // ── Lower ──────────────────────────────────────────────────────────────
    { xf: 0.03, yf: 0.684, d: 5.5 },
    { xf: 0.2, yf: 0.719, d: 3.5 },
    { xf: 0.5, yf: 0.703, d: 6.5 },
    { xf: 0.8, yf: 0.734, d: 5.5 },
    { xf: 0.97, yf: 0.684, d: 6 },
    // ── Bottom strip ───────────────────────────────────────────────────────
    { xf: 0.07, yf: 0.813, d: 6 },
    { xf: 0.3, yf: 0.875, d: 3.5 },
    { xf: 0.5, yf: 0.836, d: 7 },
    { xf: 0.72, yf: 0.875, d: 5.5 },
    { xf: 0.93, yf: 0.813, d: 6.5 },
];

/**
 * Fixed stars — rendered as plain Views, never animated.
 *
 * These carry no opacity driver and no Animated.View wrapper, so they add
 * geometry without adding anything the compositor has to revisit: the field
 * gets denser at no per-frame cost, and they keep the sky populated after the
 * twinkling set freezes on scroll (see WeatherHUD's `twinkleFrozen`).
 *
 * Placed in the gaps the twinkling seeds leave, and kept to the small end of
 * the size range — baseAlpha() maps diameter to brightness, so these land
 * dimmer and read as more distant, which is also why they aren't missed when
 * they don't twinkle.
 */
export const STATIC_STAR_SEEDS: readonly StarSeed[] = [
    // ── Upper centre — the band the twinkling seeds skip ───────────────────
    { xf: 0.42, yf: 0.098, d: 3 },
    { xf: 0.58, yf: 0.135, d: 3.5 },
    { xf: 0.68, yf: 0.055, d: 3 },
    // ── Upper-to-middle transition ─────────────────────────────────────────
    { xf: 0.09, yf: 0.242, d: 3.5 },
    { xf: 0.33, yf: 0.203, d: 3 },
    { xf: 0.62, yf: 0.227, d: 5 },
    { xf: 0.91, yf: 0.258, d: 3 },
    // ── Middle centre ──────────────────────────────────────────────────────
    { xf: 0.38, yf: 0.328, d: 3.5 },
    { xf: 0.68, yf: 0.313, d: 3.5 },
    { xf: 0.55, yf: 0.445, d: 3 },
    { xf: 0.35, yf: 0.523, d: 5 },
    // ── Lower centre ───────────────────────────────────────────────────────
    { xf: 0.62, yf: 0.594, d: 3 },
    { xf: 0.45, yf: 0.633, d: 3.5 },
    { xf: 0.88, yf: 0.648, d: 3 },
    { xf: 0.17, yf: 0.945, d: 5 },
    // ── Fill pass — the field thinned out once stars shrank to their
    //    original span; these sit in the gaps the seeds above leave, still
    //    clear of the moon zone and still free (no animation driver). ──────
    { xf: 0.13, yf: 0.056, d: 3 },
    { xf: 0.52, yf: 0.073, d: 3.5 },
    { xf: 0.89, yf: 0.085, d: 3 },
    { xf: 0.25, yf: 0.127, d: 3.5 },
    { xf: 0.73, yf: 0.169, d: 3 },
    { xf: 0.04, yf: 0.196, d: 3.5 },
    { xf: 0.54, yf: 0.274, d: 3 },
    { xf: 0.06, yf: 0.302, d: 3.5 },
    { xf: 0.8, yf: 0.325, d: 3 },
    { xf: 0.14, yf: 0.384, d: 3.5 },
    { xf: 0.97, yf: 0.401, d: 3 },
    { xf: 0.03, yf: 0.418, d: 3 },
    { xf: 0.24, yf: 0.462, d: 5 },
    { xf: 0.82, yf: 0.485, d: 3.5 },
    { xf: 0.22, yf: 0.538, d: 3 },
    { xf: 0.69, yf: 0.547, d: 3 },
    { xf: 0.04, yf: 0.591, d: 3.5 },
    { xf: 0.8, yf: 0.612, d: 3 },
    { xf: 0.15, yf: 0.667, d: 3.5 },
    { xf: 0.96, yf: 0.74, d: 3.5 },
    { xf: 0.38, yf: 0.77, d: 3.5 },
    { xf: 0.18, yf: 0.825, d: 3.5 },
    { xf: 0.88, yf: 0.892, d: 3.5 },
    { xf: 0.53, yf: 0.985, d: 3 },
];

/**
 * Size cutoff between the two bands. 4 splits the current field roughly
 * 1:2 (23 near, 47 far) — a small, bright foreground scattered over a denser,
 * dimmer background, which is the near/far ratio a real sky reads as.
 */
export const NEAR_MIN_D = 4;

/**
 * Twinkle phases. Stars share an opacity value with every Nth star, so the
 * whole field costs this many animation drivers rather than 31 — but the
 * durations are mutually near-coprime, so the groups never settle into a
 * visible rhythm the way five groups on round-numbered durations did.
 */
export const PHASE_CONFIGS = [
    { delay: 0, duration: 3100 },
    { delay: 520, duration: 3700 },
    { delay: 1180, duration: 2900 },
    { delay: 1740, duration: 4300 },
    { delay: 2360, duration: 3300 },
    { delay: 2810, duration: 4700 },
] as const;

/**
 * PHASE_CONFIGS split by duration, short first — the near/bigger stars
 * round-robin FAST, the far/smaller ones round-robin SLOW, so "closer" stars
 * visibly swing quicker without adding any native loops beyond the six above.
 */
export const FAST_PHASE_INDICES = [0, 2, 4] as const; // 3100, 2900, 3300 ms
export const SLOW_PHASE_INDICES = [1, 3, 5] as const; // 3700, 4300, 4700 ms

/**
 * Twinkle amplitude floor, one per depth band. Near stars swing all the way
 * down to near-invisible; far stars barely dim, which reads as a shimmer
 * rather than a blink at that size — pairing depth with contrast the same
 * way duration pairs it with speed above.
 */
export const TWINKLE_MIN_NEAR = 0.15;
export const TWINKLE_MIN_FAR = 0.55;

export const STAR_MIN_D = 3;
export const STAR_MAX_D = 7;

/**
 * Per-star baseline brightness, folded into the fill colour rather than the
 * animated opacity so the two multiply. Bigger stars read as nearer/brighter.
 */
export function baseAlpha(d: number): number {
    const t = (d - STAR_MIN_D) / (STAR_MAX_D - STAR_MIN_D);
    return 0.55 + 0.45 * t;
}

/**
 * A 4-point sparkle on a 0–100 box, centred at (50, 50), tips on the edges.
 *
 * This is `generateSparkle()` from before the field became dots, transcribed:
 * eight straight segments, tip → waist → tip, with the waist at 12% of the
 * radius (50 ± 6). The needle-thin waist is the shape — curving the edges or
 * fattening the waist turns it into a plus sign or a diamond at these sizes.
 */
export const SPARKLE_D = 'M50,0 L56,44 L100,50 L56,56 L50,100 L44,56 L0,50 L44,44 Z';

/**
 * Tip-to-tip span, as a multiple of the seed's `d`.
 *
 * 1, because `d` already *is* the span in points — no extra scaling on top of
 * whatever's written in the seed tables (originally 3–6, now 3–7 since the
 * near band's seeds were bumped up; see STAR_SEEDS above).
 */
export const SPAN_RATIO = 1;

// ─── Shooting star ───────────────────────────────────────────────────────────
// An occasional streak across the clear-night sky. One Animated.View holding a
// static gradient streak, rotated to its heading and translated along it by a
// single native timing per shot; only the randomized gap stays on a JS timer.

export const SHOOTING_STAR = {
    /** Gap between shots: gapMinMs plus up to gapSpreadMs, randomized per shot. */
    gapMinMs: 14000,
    gapSpreadMs: 16000,
    /** One shot, start to finish. The head eases out (quadratic) over this. */
    ms: 900,
    /** How far the head travels, and the streak's length behind it, in points. */
    travel: 170,
    tail: 70,
    /** Streak thickness and the head dot's diameter, in points. */
    width: 1.5,
    head: 2.6,
    opacity: 0.9,
    /** Opacity over the shot's 0–1 progress. */
    fade: { inputRange: [0, 0.15, 0.65, 1], outputRange: [0, 1, 1, 0] },
    /** Heading below horizontal, in degrees; direction (left or right) is random. */
    angleMinDeg: 18,
    angleSpreadDeg: 20,
    /** Where the streak's midpoint lands, 0–1 of the canvas: the upper sky, clear of the status bar. */
    region: { xMin: 0.25, xMax: 0.75, yMin: 0.14, yMax: 0.36 },
    /** The one shot in an 8 s story loop, at a fixed time and place. */
    story: { atMs: 4600, xf: 0.58, yf: 0.2, angleDeg: 28, leftward: true },
} as const;

// ─── Sun glare ───────────────────────────────────────────────────────────────
// Clear and sunny days: a soft glow from just past the top-right corner, where
// an out-of-frame sun would be, and a few faint lens-flare ghosts on the line
// from it through the middle of the screen. Flat shapes, no texture. One native
// loop per layer: the glow breathes, the ghosts slide a few points along their
// line.

export interface GlareGhost {
    /** Position along the flare line: 0 = the sun, 0.5 = canvas centre, 1 = the opposite point. */
    t: number;
    /** Diameter, in points. */
    d: number;
    opacity: number;
    /** A filled disc, or a thin ring. */
    shape: 'disc' | 'ring';
}

export const SUN_GLARE = {
    /** The sun, 0–1 of the canvas: just past the top-right corner. */
    source: { xf: 0.92, yf: -0.03 },
    /** Warm white, so the glare reads as sunlight rather than haze. */
    color: '#fff4dc',
    /** Glow radius as a fraction of the canvas width, and its radial fade. */
    glowRadiusF: 1.1,
    glowStops: [
        { offset: 0, opacity: 0.85 },
        { offset: 0.08, opacity: 0.6 },
        { offset: 0.25, opacity: 0.28 },
        { offset: 0.55, opacity: 0.08 },
        { offset: 1, opacity: 0 },
    ],
    /** One slow breath: glow opacity swings 1 → breatheMin → 1, ghosts slide `drift` points out and back. */
    breatheMs: 7000,
    breatheMin: 0.72,
    drift: 8,
    ringStroke: 1.5,
    ghosts: [
        { t: 0.24, d: 34, opacity: 0.10, shape: 'disc' },
        { t: 0.33, d: 12, opacity: 0.16, shape: 'disc' },
        { t: 0.64, d: 56, opacity: 0.07, shape: 'ring' },
        { t: 0.74, d: 20, opacity: 0.11, shape: 'disc' },
        { t: 0.86, d: 42, opacity: 0.06, shape: 'disc' },
    ] as readonly GlareGhost[],
} as const;

// ─── Snow ────────────────────────────────────────────────────────────────────
// Each group is one Animated.View translating an SVG of stacked particles down
// by one segment and snapping back, so a group costs one native loop however
// many flakes it holds. Two details make it read as snow:
//   - columns carry their own vertical phase, so flakes don't fall in rows;
//   - the same progress value also drives a sideways sway (one full swing per
//     segment), which is what makes snow read as snow rather than slow rain.

export interface FlakeGroup {
    id: string;
    /** Column positions, 0–1 of the width. */
    xOffsets: readonly number[];
    /** Per-column vertical offset, 0–1 of a segment. Same length as xOffsets. */
    phases: readonly number[];
    /** Milliseconds to fall one segment. */
    duration: number;
    startDelay: number;
    /** Sideways sway, points either side of the column, once per segment. */
    sway: number;
    /** Dot diameter or flake span, in points. */
    size: number;
    shape: 'dot' | 'flake';
    opacity: number;
}

/** Particles stacked per column; a segment is the canvas height divided by this. */
export const FLAKES_PER_COLUMN = 5;

/** Stroke width of a six-arm flake, in points. */
export const FLAKE_STROKE = 1.2;

export const SNOW_GROUPS: readonly FlakeGroup[] = [
    // Far: small, dim dots drifting slowly — most of the snowfall.
    {
        id: 'far',
        xOffsets: [0.05, 0.17, 0.29, 0.41, 0.53, 0.65, 0.77, 0.89],
        phases:   [0.00, 0.55, 0.20, 0.75, 0.40, 0.90, 0.10, 0.65],
        duration: 5200, startDelay: 0, sway: 6, size: 3, shape: 'dot', opacity: 0.6,
    },
    // Near: fewer, bigger six-arm flakes, a little faster and swinging wider.
    {
        id: 'near',
        xOffsets: [0.11, 0.35, 0.59, 0.83],
        phases:   [0.30, 0.80, 0.05, 0.50],
        duration: 4200, startDelay: 300, sway: 10, size: 9, shape: 'flake', opacity: 0.85,
    },
];

// ─── Fog ─────────────────────────────────────────────────────────────────────
// Soft banks drifting sideways. Each layer is one Animated.View two canvases
// wide whose bands repeat every canvas width, translated left by one width and
// snapped back — seamless, one native loop per layer. A band is an ellipse
// with a radial fade from `opacity` at its centre to nothing at its edge.

export interface FogBand {
    /** Left edge and width, 0–1 of the canvas width. */
    xf: number;
    wf: number;
    /** Vertical centre and height, 0–1 of the canvas height. */
    yf: number;
    hf: number;
    opacity: number;
}

export interface FogLayerSpec {
    id: string;
    /** Milliseconds to drift one canvas width. */
    duration: number;
    bands: readonly FogBand[];
}

export const FOG_LAYERS: readonly FogLayerSpec[] = [
    {
        id: 'far',
        duration: 70000,
        bands: [
            { xf: 0.00, wf: 0.90, yf: 0.18, hf: 0.14, opacity: 0.16 },
            { xf: 0.55, wf: 1.00, yf: 0.46, hf: 0.18, opacity: 0.18 },
            { xf: 0.20, wf: 0.80, yf: 0.76, hf: 0.16, opacity: 0.16 },
        ],
    },
    {
        id: 'near',
        duration: 45000,
        bands: [
            { xf: 0.35, wf: 1.10, yf: 0.30, hf: 0.20, opacity: 0.20 },
            { xf: 0.80, wf: 0.90, yf: 0.62, hf: 0.22, opacity: 0.22 },
        ],
    },
];
