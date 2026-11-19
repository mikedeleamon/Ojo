/**
 * weatherGlass.ts — what the weather does to the glass card on Home.
 *
 * Rain leaves beads on it, a freeze frosts it in from the corners, and real heat
 * makes it shimmer. This file holds the decision (glassEffectFor) and all of the
 * geometry, pure and seeded, so the art is identical on every render and the
 * rules can be tested in node. components/WeatherGlass draws it.
 *
 * Every effect is drawn OVER the card rather than into the glass. A native
 * GlassView can't be refracted or displaced from JavaScript, and Skia couldn't
 * do it either: a Skia canvas can't sample the UIKit views behind it. So the
 * beads, frost and haze are their own art, kept light and mostly inside the
 * card's padding so the outfit on the card stays readable.
 *
 * Geometry is laid out by walking along each edge with seeded gaps instead of
 * scattering over the card's size. The outfit card grows and shrinks (the
 * breakdown and "More details" expand it), and walking keeps every existing bead
 * where it was when that happens: a taller card only adds beads at the end.
 */

import type { RainVariant } from './backdropSpec';
import { classifyCondition } from './conditions';
import { rnd } from './rainField';

// ─── Decision ────────────────────────────────────────────────────────────────

export type RainDensity = 'drizzle' | 'rain' | 'storm';
export type FrostLevel = 1 | 2 | 3;

export type GlassEffect =
    | { kind: 'rain'; density: RainDensity }
    | { kind: 'frost'; level: FrostLevel }
    | { kind: 'heat'; intensity: number };

/** At or below this air temperature (°F) the glass frosts. */
export const FREEZING_F = 32;
/** At or above this air temperature (°F) the glass shimmers. */
export const HEAT_F = 90;
/** Temperature at which the shimmer reaches full strength. */
const HEAT_FULL_F = 105;
/** Shimmer strength right at HEAT_F, so 90° already reads. */
const HEAT_MIN_INTENSITY = 0.4;

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/**
 * The effect for the current weather, or null for none.
 *
 * Air temperature, not feels-like: glass freezes and heats with the air, and a
 * windy 36° day shouldn't frost over. A freeze wins over precipitation, since
 * whatever lands on glass below freezing is ice, and rain wins over heat (a hot
 * downpour still beads). Sleet above freezing is wet, so it beads like rain.
 */
export function glassEffectFor(
    rain: RainVariant | null,
    tempF: number | null | undefined,
): GlassEffect | null {
    const t = typeof tempF === 'number' && Number.isFinite(tempF) ? tempF : null;
    if (t !== null && t <= FREEZING_F) {
        return { kind: 'frost', level: t > 20 ? 1 : t > 5 ? 2 : 3 };
    }
    if (rain) {
        const density: RainDensity =
            rain === 'storm' ? 'storm' : rain === 'drizzle' ? 'drizzle' : 'rain';
        return { kind: 'rain', density };
    }
    if (t !== null && t >= HEAT_F) {
        const ramp = clamp01((t - HEAT_F) / (HEAT_FULL_F - HEAT_F));
        return { kind: 'heat', intensity: HEAT_MIN_INTENSITY + (1 - HEAT_MIN_INTENSITY) * ramp };
    }
    return null;
}

/**
 * Whether rain hits hard enough to splash off the card's top edge: steady rain
 * and storms do; drizzle, light rain and sleet don't.
 */
export function edgeSplashes(condition: string): boolean {
    const kind = classifyCondition(condition);
    if (kind === 'thunderstorm') return true;
    return kind === 'rain' && !condition.toLowerCase().includes('light');
}

// ─── Shared ──────────────────────────────────────────────────────────────────

/**
 * How far in from the card's edge the beads and edge frost may sit, in points.
 * Equal to the card's padding, so they never reach the card's content.
 */
export const GLASS_BAND = 20;

const lerp = (range: readonly [number, number], t: number) =>
    range[0] + (range[1] - range[0]) * t;

/** Safety cap on any walk, whatever size the card reports. */
const MAX_STEPS = 600;

// ─── Rain beads ──────────────────────────────────────────────────────────────

/** One bead in a strip's own coordinates: `along` the edge, `across` from it. */
export interface Bead {
    along: number;
    across: number;
    r: number;
    /** Opacity multiplier, 0–1. */
    o: number;
}

export interface BeadSpec {
    /** Gap between beads along an edge (points). */
    gap: readonly [number, number];
    /** Bead radius range (points). Most beads sit near the small end. */
    r: readonly [number, number];
    /** Mean vertical gap between beads over the card's face (points); 0 for none. */
    interiorGap: number;
    interiorR: readonly [number, number];
    /** Beads on the top border that grow heavy and run down the face. */
    runners: number;
    /** Splash points along the card's top edge, where the rain hits it. */
    splashes: number;
    /** Time between one splash point's hits (ms). */
    splashEveryMs: readonly [number, number];
    /** Droplets thrown up by each hit. */
    splashDroplets: number;
}

export const BEAD_SPECS: Readonly<Record<RainDensity, BeadSpec>> = {
    // Drizzle: a fine mist of tiny beads, too light to run,
    // and it only taps the top edge now and then.
    drizzle: {
        gap: [4, 9], r: [0.6, 1.6], interiorGap: 9, interiorR: [0.6, 1.7], runners: 0,
        splashes: 2, splashEveryMs: [1500, 2400], splashDroplets: 2,
    },
    rain: {
        gap: [6, 14], r: [1.0, 3.4], interiorGap: 11, interiorR: [1.0, 3.4], runners: 2,
        splashes: 4, splashEveryMs: [800, 1400], splashDroplets: 3,
    },
    storm: {
        gap: [5, 11], r: [1.2, 4.2], interiorGap: 9, interiorR: [1.1, 3.8], runners: 3,
        splashes: 6, splashEveryMs: [500, 900], splashDroplets: 4,
    },
};

/**
 * Beads along one edge strip `length` points long and `band` points deep.
 * `seed` separates the strips so no two share a pattern.
 */
export function stripBeads(
    length: number,
    band: number,
    spec: BeadSpec,
    seed: number,
    sparseness = 1,
): Bead[] {
    const out: Bead[] = [];
    if (!(length > 0)) return out;
    let along = lerp(spec.gap, rnd(seed, 0)) * 0.5 * sparseness;
    for (let i = 0; along < length && i < MAX_STEPS; i++) {
        const s = seed + i * 7;
        // Skewed toward the small end: most beads are pinpricks, a few are fat.
        const r = lerp(spec.r, Math.pow(rnd(s, 1), 1.8));
        // Hug the edge; the odd bead strays further in, never past the band.
        const raw = 1.5 + Math.pow(rnd(s, 2), 1.5) * (band - 3);
        const across = Math.min(band - r - 0.5, Math.max(r + 0.5, raw));
        out.push({ along, across, r, o: 0.55 + 0.45 * rnd(s, 3) });
        along += lerp(spec.gap, rnd(s, 4)) * sparseness;
    }
    return out;
}

/** A bead inside the card, in card coordinates. */
export interface InteriorBead {
    x: number;
    y: number;
    r: number;
    o: number;
}

/**
 * Sparse pinprick beads over the card's interior (inside the band), walked down
 * the card so a taller card only adds beads below the existing ones.
 */
export function interiorBeads(
    width: number,
    height: number,
    band: number,
    spec: BeadSpec,
    seed: number,
): InteriorBead[] {
    const out: InteriorBead[] = [];
    const innerW = width - band * 2;
    if (spec.interiorGap <= 0 || innerW <= 0) return out;
    let y = band + spec.interiorGap * rnd(seed, 0);
    for (let i = 0; y < height - band && i < MAX_STEPS; i++) {
        const s = seed + i * 11;
        const r = lerp(spec.interiorR, Math.pow(rnd(s, 1), 1.6));
        out.push({ x: band + rnd(s, 2) * innerW, y, r, o: 0.55 + 0.4 * rnd(s, 3) });
        y += spec.interiorGap * (0.4 + 1.2 * rnd(s, 4));
    }
    return out;
}

// ─── Top-edge splashes ───────────────────────────────────────────────────────

/** A droplet thrown up by a hit: how far it flies sideways and how high. */
export interface SplashDroplet {
    dx: number;
    rise: number;
    size: number;
}

/**
 * One point on the top edge where rain keeps hitting the card. It hits `hits.length`
 * times per loop, each at its own x, so the splashes wander along the edge.
 */
export interface SplashEmitter {
    hits: number[];
    cycleMs: number;
    delayMs: number;
    droplets: SplashDroplet[];
}

/** Hits per emitter loop. */
export const SPLASH_HITS = 4;

export function splashEmitters(width: number, spec: BeadSpec, seed: number): SplashEmitter[] {
    const out: SplashEmitter[] = [];
    const margin = 14;
    const usable = width - margin * 2;
    if (spec.splashes <= 0 || usable <= 0) return out;
    for (let i = 0; i < spec.splashes; i++) {
        const k = seed + i * 53;
        const zone = usable / spec.splashes;
        const hits = Array.from({ length: SPLASH_HITS }, (_, h) =>
            round1(margin + zone * i + zone * rnd(k, 10 + h)),
        );
        const every = lerp(spec.splashEveryMs, rnd(k, 1));
        const droplets = Array.from({ length: spec.splashDroplets }, (_, d) => {
            const dir = d % 2 === 0 ? -1 : 1;
            return {
                dx: round1(dir * (4 + 12 * rnd(k, 20 + d))),
                rise: round1(8 + 16 * rnd(k, 30 + d)),
                size: round1(1.4 + 1.4 * rnd(k, 40 + d)),
            };
        });
        out.push({ hits, cycleMs: Math.round(every * SPLASH_HITS), delayMs: Math.round(every * rnd(k, 2)), droplets });
    }
    return out;
}

/** A keyframe within one hit: [share of the hit's time, value]. */
export type Key = readonly [number, number];

/**
 * The same keyframes repeated for each of `n` hits across one 0→1 loop, as an
 * interpolation range. Keyframes must start at 0 and stay below 1; the loop's
 * end takes the first value, so it wraps without a jump.
 */
export function repeatKeys(n: number, keys: readonly Key[]): { inputRange: number[]; outputRange: number[] } {
    const inputRange: number[] = [];
    const outputRange: number[] = [];
    for (let s = 0; s < n; s++) {
        for (const [t, v] of keys) {
            inputRange.push((s + t) / n);
            outputRange.push(v);
        }
    }
    inputRange.push(1);
    outputRange.push(keys[0][1]);
    return { inputRange, outputRange };
}

/** One value per hit, held for the whole hit and cut at the boundary. */
export function holdPerHit(values: readonly number[]): { inputRange: number[]; outputRange: number[] } {
    const n = values.length;
    const eps = 1e-4;
    const inputRange: number[] = [];
    const outputRange: number[] = [];
    values.forEach((v, s) => {
        inputRange.push(s / n, (s + 1) / n - eps);
        outputRange.push(v, v);
    });
    inputRange.push(1);
    outputRange.push(values[0]);
    return { inputRange, outputRange };
}

// ─── Running drops ───────────────────────────────────────────────────────────
// Now and then a bead on the top border gathers enough water to run down the
// card's face. What makes it read as water rather than a dot on a rail:
//   - it sags as it swells, lets go slowly and picks up speed, and never stalls
//     or slows (stick-slip was tried and looked like a stutter);
//   - it draws out into a teardrop as it speeds up;
//   - it wanders a few points either side of straight down;
//   - it swallows the beads it crosses, growing and speeding up a little with
//     each, and they bead up again later;
//   - it leaves a wet trail that dries from the top, and a few tiny beads;
//   - the next drop starts from a different bead.
//
// A whole run is worked out ahead of time (planRun), from a seed, and turned
// into keyframes (runKeyframes) for one 0→1 timing on the native driver. The
// only JavaScript per run is starting the next one.

/** A bead on the top border that a run can start from, in card coordinates. */
export interface RunSpot {
    /** Its index in the top strip, so the strip leaves it for the lane to draw. */
    bead: number;
    x: number;
    y: number;
    /** Its size at rest: the bead, filled out to a size that can run. */
    r: number;
}

/**
 * A slice of the card's width that one drop at a time runs down. Each run
 * starts from the next of its spots. Lanes don't overlap, so no interior bead
 * can be swallowed by two drops.
 */
export interface RunLane {
    lo: number;
    hi: number;
    spots: RunSpot[];
    /** Wait before its first run, so lanes don't go together. */
    delayMs: number;
}

/** The smallest drop that runs. Smaller beads stay put, as they do on glass. */
const MIN_RUNNER_R = 2.6;
/** Starting beads per lane. */
export const SPOTS_PER_LANE = 3;
/** Spots keep this far inside their lane, which leaves the drop room to wander. */
const LANE_INSET = 10;
const SPOT_GAP = 12;

/**
 * `count` lanes across the card's face (not the corners), each with its biggest
 * top-strip beads as starting spots. A lane with no bead to start from is
 * left out.
 */
export function runLanes(top: Bead[], width: number, band: number, count: number, seed: number): RunLane[] {
    if (count <= 0) return [];
    const from = band + 8;
    const span = (width - band - 8 - from) / count;
    if (!(span > 0)) return [];
    const lanes: RunLane[] = [];
    for (let n = 0; n < count; n++) {
        const lo = from + span * n;
        const hi = lo + span;
        const candidates = top
            .map((b, i) => ({ b, i }))
            .filter(({ b }) => b.along >= lo + LANE_INSET && b.along <= hi - LANE_INSET)
            .sort((p, q) => q.b.r - p.b.r || p.i - q.i);
        const picked: { b: Bead; i: number }[] = [];
        for (const c of candidates) {
            if (picked.length >= SPOTS_PER_LANE) break;
            if (picked.every((p) => Math.abs(p.b.along - c.b.along) >= SPOT_GAP)) picked.push(c);
        }
        if (picked.length === 0) continue;
        lanes.push({
            lo,
            hi,
            spots: picked.map(({ b, i }) => ({ bead: i, x: b.along, y: b.across, r: Math.max(MIN_RUNNER_R, b.r) })),
            delayMs: Math.round(n * 1700 + 1500 * rnd(seed + n * 29, 2)),
        });
    }
    return lanes;
}

/** How long a bead swells on the edge before it lets go. */
export const SWELL_MS = 1300;
/** How much it swells, how far it sags (in radii), and how much taller than wide it gets. */
export const SWELL_SCALE = 1.3;
export const SWELL_SAG = 0.55;
export const SWELL_STRETCH = 1.12;
/** Speed it lets go at, and the speed the smallest runner settles to (points per second). */
export const RUN_START_SPEED = 14;
export const RUN_SPEED = 185;
/** Seconds to close most of the gap to its settled speed. */
const RUN_PICKUP_S = 0.5;
/** Each swallowed bead raises the settled speed by this much. */
const SWALLOW_SPEEDUP = 9;
/** A stretch of trail is dry this long after the drop passes it. */
export const TRAIL_DRY_MS = 1900;
/** After the run: the beads it left stay, then fade. */
export const CRUMBS_STAY_MS = 2200;
export const CRUMBS_FADE_MS = 2000;
/** After the run: a new bead grows where the drop started. */
export const REGROW_AT_MS = 800;
export const REGROW_MS = 2600;
/** After the run: the beads it swallowed bead up again. */
export const REFORM_AT_MS = 2600;
export const REFORM_MS = 2400;
/** From the end of the run to the end of the loop. Everything above fits inside it. */
export const LINGER_MS = 5200;

/** The teardrop's length from the middle of its head to its tip, in radii, at a speed. */
export const TEAR_MAX = 1.15 + 1.9 * 1.2;
export function tearLength(v: number): number {
    return 1.15 + 1.9 * Math.min(1.2, v / RUN_SPEED);
}

/** Where the drop is at a moment of its run. */
export interface RunSample {
    /** Milliseconds since it let go. */
    t: number;
    x: number;
    y: number;
    r: number;
    /** Points per second. */
    v: number;
}

export interface RunPlan {
    spot: RunSpot;
    restMs: number;
    /** Length of the run itself, from letting go to off the bottom. */
    runMs: number;
    cycleMs: number;
    /** The run, sampled every SAMPLE_MS; the first is the moment it lets go. */
    samples: RunSample[];
    /** Interior beads it swallows (`bead` is the index in interiorBeads' result). */
    eaten: (InteriorBead & { bead: number })[];
    /** Tiny beads it leaves on its trail. */
    crumbs: { x: number; y: number; r: number }[];
}

const SIM_HZ = 120;
const SAMPLE_EVERY = 10;
/** Milliseconds between samples. */
export const SAMPLE_MS = (1000 * SAMPLE_EVERY) / SIM_HZ;

/**
 * The card height a run is planned for: bucketed to 200 pt, so a card that
 * grows by a row doesn't restart the drops. The card clips whatever runs past
 * its real bottom.
 */
export function runBucket(height: number): number {
    return Math.max(400, Math.ceil(height / 200) * 200);
}

/**
 * One run down a lane: `run` counts the lane's runs from 0 and picks the spot
 * and the wander. `height` is the bucketed card height; `interior` the beads on
 * the card's face.
 */
export function planRun(
    lane: RunLane,
    laneIndex: number,
    run: number,
    height: number,
    interior: readonly InteriorBead[],
    seed: number,
): RunPlan {
    const k = seed + laneIndex * 29 + run * 131;
    const spot = lane.spots[run % lane.spots.length];
    const restMs = Math.round(600 + 1800 * rnd(k, 1));

    let r = spot.r * SWELL_SCALE;
    let settled = RUN_SPEED + 22 * (spot.r - MIN_RUNNER_R);
    let v = RUN_START_SPEED;
    let s = 0;
    const y0 = spot.y + spot.r * SWELL_SAG;
    const p1 = rnd(k, 2) * Math.PI * 2;
    const p2 = rnd(k, 3) * Math.PI * 2;
    // Two slow sines, eased in so it leaves the edge heading straight down.
    const wander = (d: number) =>
        Math.min(1, d / 45) *
        (3.6 * (Math.sin(d / 68 + p1) - Math.sin(p1)) + 1.4 * (Math.sin(d / 29 + p2) - Math.sin(p2)));
    const xAt = (d: number) => Math.min(lane.hi - r, Math.max(lane.lo + r, spot.x + wander(d)));

    // Only beads in this lane, and below where the drop starts.
    const inLane = interior
        .map((b, bead) => ({ ...b, bead }))
        .filter((b) => b.x >= lane.lo && b.x <= lane.hi);
    const gone = new Set<number>();
    const eaten: RunPlan['eaten'] = [];
    const crumbs: RunPlan['crumbs'] = [];
    let nextCrumb = 26 + 30 * rnd(k, 4);

    const dt = 1 / SIM_HZ;
    const samples: RunSample[] = [{ t: 0, x: spot.x, y: y0, r, v }];
    for (let step = 1; step < SIM_HZ * 60; step++) {
        v += ((settled - v) * dt) / RUN_PICKUP_S;
        s += v * dt;
        const x = xAt(s);
        const y = y0 + s;
        for (const b of inLane) {
            if (gone.has(b.bead)) continue;
            if (Math.abs(b.y - y) < r + 1 && Math.abs(b.x - x) < r + b.r + 0.5) {
                gone.add(b.bead);
                eaten.push(b);
                // Volumes add; a little is lost to the trail.
                r = Math.cbrt(r ** 3 + 0.8 * b.r ** 3);
                settled += SWALLOW_SPEEDUP;
            }
        }
        if (s > nextCrumb) {
            const c = k + 100 + crumbs.length * 3;
            crumbs.push({ x: x + (rnd(c, 1) - 0.5) * 1.2, y: y - r * 1.6, r: 0.55 + 0.8 * rnd(c, 2) });
            nextCrumb = s + 30 + 42 * rnd(c, 3);
        }
        const done = y - r * 4 > height;
        if (step % SAMPLE_EVERY === 0 || done) {
            samples.push({ t: (step * 1000) / SIM_HZ, x, y, r, v });
        }
        if (done) break;
    }
    const runMs = samples[samples.length - 1].t;
    return {
        spot,
        restMs,
        runMs,
        cycleMs: Math.round(restMs + SWELL_MS + runMs + LINGER_MS),
        samples,
        eaten,
        crumbs: crumbs.filter((c) => c.y < height),
    };
}

/** An interpolation of the loop's 0→1 progress. */
export interface Keys {
    inputRange: number[];
    outputRange: number[];
}

/** One stretch of the trail, top to bottom, and when it dries. */
export interface TrailStretch {
    /** Its top and bottom, in points below the trail's start. */
    from: number;
    to: number;
    /** Fully wet until the drop leaves it, then dries. */
    opacity: Keys;
    /**
     * How much fainter its top is drawn than its bottom, 0–1: the head start
     * its top has on drying. Baked into the art so neighbouring stretches,
     * which fade one after another, meet without a visible step.
     */
    lead: number;
}

/**
 * Everything a run animates, as interpolations of one progress value. Lengths
 * are points; the art they move is laid out by RainBeads.
 */
export interface RunKeys {
    /** The drop: offset from its spot, size as a multiple of its resting size, and the swell's stretch. */
    dx: Keys;
    dy: Keys;
    scale: Keys;
    stretch: Keys;
    opacity: Keys;
    /** The top half of the bead's rim, shown while it is a bead and not a teardrop. */
    rimOpacity: Keys;
    /** The teardrop's tail: its length as a share of TEAR_MAX, and when it shows. */
    tail: Keys;
    tailOpacity: Keys;
    /**
     * The trail and the beads left on it sit in a window whose bottom edge
     * follows the drop, so they appear behind it. `reveal` is how far that edge
     * has come down from the trail's start (trailTop); it ends at trailLength.
     */
    reveal: Keys;
    trailTop: number;
    trailLength: number;
    /** The trail's centre line: card x, points below trailTop, and the drop's radius there. */
    trail: { x: number; d: number; r: number }[];
    stretches: TrailStretch[];
    crumbsOpacity: Keys;
    /**
     * The beads it swallows sit in a window whose top edge follows the drop, so
     * each goes as the drop reaches it. `eat` is how far that edge has come down
     * from eatTop; it ends at eatLength. Later the window is put back and the
     * beads fade in again together.
     */
    eat: Keys;
    eatTop: number;
    eatLength: number;
    eatOpacity: Keys;
}

/** Share of a loop used for a hard cut. */
const CUT_MS = 1;

/** [milliseconds into the loop, value] pairs → an interpolation over 0–1. */
function keysOf(cycleMs: number, pairs: readonly (readonly [number, number])[]): Keys {
    const inputRange: number[] = [];
    const outputRange: number[] = [];
    let last = -1;
    for (const [ms, value] of pairs) {
        // Strictly increasing, whatever the rounding did to two close keys.
        const at = Math.min(1, Math.max(ms / cycleMs, last + 1e-6));
        if (at <= last) continue;
        inputRange.push(at);
        outputRange.push(value);
        last = at;
    }
    if (inputRange[0] !== 0) {
        inputRange.unshift(0);
        outputRange.unshift(outputRange[0]);
    }
    if (inputRange[inputRange.length - 1] < 1) {
        inputRange.push(1);
        outputRange.push(outputRange[outputRange.length - 1]);
    }
    return { inputRange, outputRange };
}

/** Most stretches a trail is cut into, and the length each aims for. */
const MAX_STRETCHES = 12;
const STRETCH_LENGTH = 70;
/** The trail starts this many radii above the middle of the drop, under its head. */
const TRAIL_TUCK = 0.4;

export function runKeyframes(plan: RunPlan): RunKeys {
    const { spot, samples, cycleMs } = plan;
    const R = plan.restMs;
    const S = R + SWELL_MS;
    const E = S + plan.runMs;
    const first = samples[0];
    const end = samples[samples.length - 1];
    const sag = first.y - spot.y;
    const during = (value: (p: RunSample) => number) =>
        samples.map((p) => [S + p.t, value(p)] as const);

    const tailAt = (v: number) => tearLength(v) / TEAR_MAX;

    // Trail window: its bottom edge sits just under the drop's head.
    const trailTop = first.y - first.r * TRAIL_TUCK;
    const edge = samples.map((p) => p.y - p.r * TRAIL_TUCK - trailTop);
    const trailLength = edge[edge.length - 1];
    /** Milliseconds into the run at which the window's edge reaches `d`. */
    const reaches = (d: number) => {
        for (let i = 1; i < edge.length; i++) {
            if (edge[i] >= d) {
                const f = (d - edge[i - 1]) / (edge[i] - edge[i - 1] || 1);
                return samples[i - 1].t + (samples[i].t - samples[i - 1].t) * f;
            }
        }
        return end.t;
    };
    const count = Math.min(MAX_STRETCHES, Math.max(1, Math.ceil(trailLength / STRETCH_LENGTH)));
    const stretches: TrailStretch[] = [];
    let entered = 0;
    for (let i = 0; i < count; i++) {
        const from = (trailLength * i) / count;
        const to = (trailLength * (i + 1)) / count;
        const left = reaches(to);
        stretches.push({
            from,
            to,
            opacity: keysOf(cycleMs, [[0, 1], [S + left, 1], [S + left + TRAIL_DRY_MS, 0]]),
            lead: Math.min(0.6, (left - entered) / TRAIL_DRY_MS),
        });
        entered = left;
    }

    // Swallowing window: its top edge sits just past the drop's middle. It
    // starts a little above the drop, clear of the first bead it can reach.
    const eatTop = first.y - first.r - 6;
    const eatEdge = (p: RunSample) => p.y + p.r * 0.3 - eatTop;
    const eatLength = eatEdge(end);

    return {
        dx: keysOf(cycleMs, [[0, 0], [S, 0], ...during((p) => p.x - spot.x).slice(1), [E + CUT_MS, 0]]),
        dy: keysOf(cycleMs, [
            [0, 0], [R, 0], [R + SWELL_MS / 2, sag / 4], [S, sag],
            ...during((p) => p.y - spot.y).slice(1), [E + CUT_MS, 0],
        ]),
        scale: keysOf(cycleMs, [
            [0, 1], [R, 1], [S, first.r / spot.r],
            ...during((p) => p.r / spot.r).slice(1),
            [E + CUT_MS, 0.05], [E + REGROW_AT_MS, 0.05], [E + REGROW_AT_MS + REGROW_MS, 1],
        ]),
        stretch: keysOf(cycleMs, [[0, 1], [R, 1], [S, SWELL_STRETCH], [S + 150, 1]]),
        opacity: keysOf(cycleMs, [[0, 1], [E, 1], [E + CUT_MS, 0], [E + REGROW_AT_MS, 0], [E + REGROW_AT_MS + CUT_MS, 1]]),
        rimOpacity: keysOf(cycleMs, [[0, 1], [S, 1], [S + CUT_MS, 0], [E, 0], [E + CUT_MS, 1]]),
        tail: keysOf(cycleMs, [[0, tailAt(first.v)], ...during((p) => tailAt(p.v)), [E + CUT_MS, tailAt(first.v)]]),
        tailOpacity: keysOf(cycleMs, [[0, 0], [S, 0], [S + CUT_MS, 1], [E, 1], [E + CUT_MS, 0]]),
        reveal: keysOf(cycleMs, [[0, 0], ...samples.map((p, i) => [S + p.t, edge[i]] as const)]),
        trailTop,
        trailLength,
        trail: samples.map((p, i) => ({ x: p.x, d: edge[i], r: p.r })),
        stretches,
        crumbsOpacity: keysOf(cycleMs, [[0, 1], [E + CRUMBS_STAY_MS, 1], [E + CRUMBS_STAY_MS + CRUMBS_FADE_MS, 0]]),
        eat: keysOf(cycleMs, [
            [0, 0], [S - CUT_MS, 0], ...during(eatEdge),
            [E + REFORM_AT_MS, eatLength], [E + REFORM_AT_MS + CUT_MS, 0],
        ]),
        eatTop,
        eatLength,
        eatOpacity: keysOf(cycleMs, [
            [0, 1], [E, 1], [E + CUT_MS, 0], [E + REFORM_AT_MS + CUT_MS, 0], [E + REFORM_AT_MS + REFORM_MS, 1],
        ]),
    };
}

// ─── Frost ───────────────────────────────────────────────────────────────────

/**
 * Frost for one corner, drawn as if for the top-left corner (growing into +x,
 * +y); the component mirrors it for the others. `paths` are by depth: spines,
 * branches, twigs, each drawn thinner and fainter.
 */
export interface FrostArt {
    /** Side of the square canvas the art fits in. */
    size: number;
    paths: [string, string, string];
    /**
     * Tiny six-armed ice specks, densest near the corner: the fine grain of
     * frosted glass between the larger crystals. One path.
     */
    specks: string;
    /** Crystal tips that catch the light. */
    sparkles: { x: number; y: number; s: number }[];
}

/** How far frost reaches in from a corner, as a share of the card's width. */
export const FROST_REACH: Readonly<Record<FrostLevel, number>> = { 1: 0.26, 2: 0.32, 3: 0.4 };

/** Ice dendrites branch at 60°. */
const BRANCH_DEG = 60;

const round1 = (v: number) => Math.round(v * 10) / 10;

interface GrowCtx {
    size: number;
    seed: number;
    maxDepth: number;
    paths: [string[], string[], string[]];
    sparkles: { x: number; y: number; s: number }[];
    n: number;
}

/** One crystal arm and, recursively, its side branches. */
function grow(ctx: GrowCtx, x0: number, y0: number, deg: number, len: number, depth: number) {
    if (len < 2.5) return;
    // A branch starts on its parent's straight heading, which the parent's
    // crooks can push just off the canvas; pull it back on.
    x0 = Math.min(ctx.size, Math.max(0, x0));
    y0 = Math.min(ctx.size, Math.max(0, y0));
    const k = ctx.seed + ctx.n++ * 17;
    // A gently curving arm: four segments, each bending a little further the
    // same way, so it grows like a fern frond rather than a scratch.
    const segs = 4;
    const bend = (rnd(k, 8) - 0.5) * 10;
    const pts: [number, number][] = [[x0, y0]];
    let x = x0;
    let y = y0;
    let heading = deg;
    for (let i = 0; i < segs; i++) {
        heading += bend + (rnd(k, i) - 0.5) * 8;
        const a = (heading * Math.PI) / 180;
        x = Math.min(ctx.size, Math.max(0, x + (Math.cos(a) * len) / segs));
        y = Math.min(ctx.size, Math.max(0, y + (Math.sin(a) * len) / segs));
        pts.push([x, y]);
    }
    ctx.paths[depth].push(
        `M${round1(pts[0][0])} ${round1(pts[0][1])}` +
            pts.slice(1).map(([px, py]) => `L${round1(px)} ${round1(py)}`).join(''),
    );
    if (depth === 0 || rnd(k, 9) > 0.6) {
        ctx.sparkles.push({ x, y, s: depth === 0 ? 1.6 : 1.1 });
    }
    if (depth >= ctx.maxDepth) return;

    // Side branches along the arm, close together, alternating sides and
    // shorter toward the tip, branching off the curved arm itself.
    let t = 0.1 + 0.08 * rnd(k, 5);
    for (let b = 0; t < 0.92 && b < 12; b++) {
        const side = b % 2 === 0 ? 1 : -1;
        const along = t * segs;
        const i = Math.min(segs - 1, Math.floor(along));
        const f = along - i;
        const bx = pts[i][0] + (pts[i + 1][0] - pts[i][0]) * f;
        const by = pts[i][1] + (pts[i + 1][1] - pts[i][1]) * f;
        const bLen = len * (1 - t) * 0.34 * (0.6 + 0.7 * rnd(k, 20 + b));
        const bDeg = deg + bend * along + side * (BRANCH_DEG + (rnd(k, 40 + b) - 0.5) * 16);
        grow(ctx, bx, by, bDeg, bLen, depth + 1);
        t += 0.06 + 0.06 * rnd(k, 60 + b);
    }
}

export function frostCorner(reach: number, level: FrostLevel, seed: number): FrostArt {
    const size = Math.ceil(reach * 1.15);
    const ctx: GrowCtx = {
        size,
        seed,
        maxDepth: level === 1 ? 1 : 2,
        paths: [[], [], []],
        sparkles: [],
        n: 0,
    };
    const spines = 5 + level * 2;
    for (let s = 0; s < spines; s++) {
        const k = seed + 1000 + s * 31;
        const fromCorner = s % 3 === 0;
        const alongTop = s % 2 === 0;
        if (fromCorner) {
            // Out of the corner itself, fanned across the quadrant.
            const deg = 10 + (70 * (s + rnd(k, 1))) / spines;
            grow(ctx, 0, 0, deg, reach * (0.5 + 0.35 * rnd(k, 2)), 0);
        } else {
            // Up from an edge near the corner, leaning away from it, and
            // shorter the further along the edge it starts.
            const d = reach * (0.06 + 0.6 * rnd(k, 3));
            const lean = (rnd(k, 4) - 0.35) * 50;
            const len = reach * (0.28 + 0.32 * rnd(k, 5)) * (1 - (d / reach) * 0.55);
            if (alongTop) grow(ctx, d, 0, 90 - lean, len, 0);
            else grow(ctx, 0, d, lean, len, 0);
        }
    }
    return {
        size,
        paths: [ctx.paths[0].join(''), ctx.paths[1].join(''), ctx.paths[2].join('')],
        specks: frostSpecks(size, reach, 14 + level * 12, seed + 5000),
        sparkles: ctx.sparkles,
    };
}

/**
 * `count` tiny six-armed specks within `reach` of the corner, most of them close
 * to it, as one path on a `size` canvas.
 */
function frostSpecks(size: number, reach: number, count: number, seed: number): string {
    let d = '';
    for (let i = 0; i < count; i++) {
        const k = seed + i * 29;
        const r = reach * Math.pow(rnd(k, 1), 1.7);
        const a = (Math.PI / 2) * rnd(k, 2);
        const cx = Math.cos(a) * r;
        const cy = Math.sin(a) * r;
        const arm = 0.8 + 1.6 * rnd(k, 3);
        const spin = rnd(k, 4) * 60;
        for (const deg of [0, 60, 120]) {
            const t = ((deg + spin) * Math.PI) / 180;
            const dx = Math.cos(t) * arm;
            const dy = Math.sin(t) * arm;
            const clamp = (v: number) => round1(Math.min(size, Math.max(0, v)));
            d += `M${clamp(cx - dx)} ${clamp(cy - dy)}L${clamp(cx + dx)} ${clamp(cy + dy)}`;
        }
    }
    return d;
}

/**
 * A rim of small crystals along an edge `length` long, growing into +y. For
 * the hardest freeze, between the corners' frost.
 */
export function frostEdge(length: number, seed: number): FrostArt {
    const depth = 26;
    const ctx: GrowCtx = {
        size: Math.max(length, depth),
        seed,
        maxDepth: 1,
        paths: [[], [], []],
        sparkles: [],
        n: 0,
    };
    let x = 3 + 6 * rnd(seed, 0);
    for (let i = 0; x < length && i < MAX_STEPS; i++) {
        const k = seed + i * 19;
        const lean = (rnd(k, 1) - 0.5) * 80;
        grow(ctx, x, 0, 90 + lean, 4 + 10 * Math.pow(rnd(k, 2), 1.5), 0);
        x += 5 + 8 * rnd(k, 3);
    }
    return {
        size: depth,
        paths: [ctx.paths[0].join(''), ctx.paths[1].join(''), ctx.paths[2].join('')],
        specks: '',
        sparkles: ctx.sparkles,
    };
}

/**
 * The same art with x and y swapped: an edge rim drawn along the top, turned to
 * run down the left side. Mirror it for the right.
 */
export function transposeArt(art: FrostArt): FrostArt {
    const swap = (d: string) => d.replace(/([ML])(-?[\d.]+) (-?[\d.]+)/g, '$1$3 $2');
    return {
        size: art.size,
        paths: [swap(art.paths[0]), swap(art.paths[1]), swap(art.paths[2])],
        specks: swap(art.specks),
        sparkles: art.sparkles.map((p) => ({ x: p.y, y: p.x, s: p.s })),
    };
}

// ─── Heat ────────────────────────────────────────────────────────────────────

export interface HeatWave {
    /** Where the wave starts, as a share of the card's height. */
    yF: number;
    /** How far it rises over one loop, in points. */
    rise: number;
    amp: number;
    wavelength: number;
    durationMs: number;
    delayMs: number;
    /** Peak opacity before intensity scaling. */
    opacity: number;
}

/**
 * Heat lines spread down the card, so whichever part is on screen shimmers.
 * Short rises: heat haze wavers in place more than it travels.
 */
export function heatWaves(seed: number): HeatWave[] {
    const anchors = [0.08, 0.24, 0.42, 0.6, 0.8];
    return anchors.map((yF, i) => {
        const k = seed + i * 23;
        return {
            yF: yF + 0.06 * rnd(k, 1),
            rise: 90 + 70 * rnd(k, 2),
            amp: 2 + 2.2 * rnd(k, 3),
            wavelength: 60 + 50 * rnd(k, 4),
            durationMs: Math.round(5200 + 2600 * rnd(k, 5)),
            delayMs: Math.round(i * 1300 + 900 * rnd(k, 6)),
            opacity: 0.11 + 0.06 * rnd(k, 7),
        };
    });
}

/** A horizontal sine line across `width`, centred on `y`. */
export function wavePath(width: number, y: number, amp: number, wavelength: number, phase = 0): string {
    const step = 4;
    let d = '';
    for (let x = 0; x <= width + step; x += step) {
        const yy = y + amp * Math.sin(((x / wavelength) * 2 + phase) * Math.PI);
        d += `${x === 0 ? 'M' : 'L'}${round1(x)} ${round1(yy)}`;
    }
    return d;
}
