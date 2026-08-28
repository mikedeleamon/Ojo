import { useEffect, useMemo, useRef } from 'react';
import { Animated, useWindowDimensions, View, type ViewStyle } from 'react-native';
import Svg, { Path, G } from 'react-native-svg';
import { useReduceMotion } from '../../hooks/useReduceMotion';
import { nativeLoop, pingPong } from '../../lib/animation/nativeLoop';

// ─── Moon geometry ────────────────────────────────────────────────────────────

/** Original full-disc path — used when no moonPhase prop is supplied. */
const MOON_D_FULL =
    'M662.97,832.52h-36.75c-118-8.77-212.63-102.78-221.74-220.8l-.08-36.01c8.47-118.89,103.45-213.68,222.32-222.29l36.06.04c118.04,8.82,212.63,102.8,221.75,220.82l.08,36.02c-8.45,118.51-102.93,213.28-221.64,222.22Z';

/** Center and radius of the moon disc in the 1280×1280 viewBox. */
const MOON_CX = 644;
const MOON_CY = 593;
const MOON_R  = 240;

/**
 * Geometric SVG path for the illuminated portion of the moon.
 *
 * phase: 0 = new moon, 0.25 = first quarter (right side lit),
 *        0.5 = full moon, 0.75 = last quarter (left side lit).
 *
 * Uses two arcs: the lit limb (outer semicircle) and the terminator
 * (a half-ellipse whose x-radius is r·|cos(2π·phase)|). The sweep
 * direction flips between crescent and gibbous at the quarter boundary.
 */
function moonPhasePath(cx: number, cy: number, r: number, phase: number): string {
    const p = ((phase % 1) + 1) % 1; // normalise to [0, 1)
    if (p < 0.02 || p > 0.98) return ''; // new moon — nothing visible

    if (Math.abs(p - 0.5) < 0.01) {
        // Full moon — two semicircular arcs forming a complete disc
        return `M ${cx - r},${cy} A ${r},${r} 0 1,1 ${cx + r},${cy} A ${r},${r} 0 1,1 ${cx - r},${cy} Z`;
    }

    const top    = `${cx},${cy - r}`;
    const bottom = `${cx},${cy + r}`;
    const rx     = r * Math.abs(Math.cos(2 * Math.PI * p));

    if (p < 0.5) {
        // Waxing: right side lit.
        // Outer: clockwise right-semicircle (top→bottom). Terminator: CCW for crescent, CW for gibbous.
        const termSweep = p < 0.25 ? 0 : 1;
        return `M ${top} A ${r},${r} 0 0,1 ${bottom} A ${rx},${r} 0 0,${termSweep} ${top} Z`;
    } else {
        // Waning: left side lit. Mirror image of the waxing half, so the
        // terminator sweep is the opposite of the waxing branch above:
        // gibbous (0.5–0.75) bulges right (sweep 0), crescent (0.75–1) bulges left (sweep 1).
        const termSweep = p < 0.75 ? 0 : 1;
        return `M ${top} A ${r},${r} 0 0,0 ${bottom} A ${rx},${r} 0 0,${termSweep} ${top} Z`;
    }
}

// ─── Star field ─────────────────────────────────────────────────────────────
//
// Each star is a 4-point sparkle: a concave-tapered path, drawn by its own
// star-sized <Svg>. Crossed rounded-rect Views were tried first and read as
// plus signs — the taper is the whole difference between a star and a dot with
// arms — and no combination of borderRadius makes a View concave.
//
// What must never come back is the *full-screen* SVG layer this file used to
// have: five of them, cross-fading, six shapes apiece.
//
//   • RNSVGSvgView renders through `drawRect:` (see its `contentMode =
//     UIViewContentModeRedraw`), so every layer carried a full-screen
//     CPU-rasterized backing store — roughly 12 MB each at @3x, ~60 MB for the
//     field, to paint 31 sparkles.
//   • Each layer animated its own opacity while holding sublayers, so
//     CoreAnimation had to render the subtree into an offscreen buffer and
//     composite it every frame (`allowsGroupOpacity`) — five full-screen
//     offscreen passes per frame, on top of whatever the glass surfaces above
//     were already costing.
//
// Both costs scale with the *layer's* area, not the field's shape count, so a
// per-star Svg sized to its own star inverts them: a 12 pt box is a ~5 KB
// backing store rasterized once (the geometry never changes), and its group
// opacity is a 12 pt offscreen pass. Forty-six of those together are smaller
// than one of the full-screen layers they replace, and each star can carry its
// own brightness and phase instead of six of them blinking in unison.

/**
 * Star seeds. `xf`/`yf` are 0–1 fractions of the canvas; `d` is the star's
 * weight in **points** — it sets both the brightness and the sparkle's span
 * (see SPAN_RATIO), so the tuning below still reads as a size ordering.
 *
 * These used to be radii in viewBox units, which the full-screen canvas scaled
 * by ~0.14 (the viewBox was sized `screenWidth / size * 1280` ≈ 2860 units wide
 * but rendered at ~400 pt). An eight-segment sparkle path authored at r=14 came
 * out under 4 pt across — all of that geometry rasterized into something the
 * size of a full stop. Sizing in points instead means what is written here is
 * what lands on screen.
 *
 * Middle-band seeds (yf 0.35–0.66) stay outside xf 0.38–0.62 to clear the moon.
 */
const STAR_SEEDS: { xf: number; yf: number; d: number }[] = [
    // ── Top strip ──────────────────────────────────────────────────────────
    { xf: 0.02, yf: 0.02, d: 3.5 },
    { xf: 0.18, yf: 0.012, d: 3 },
    { xf: 0.35, yf: 0.027, d: 4.5 },
    { xf: 0.5, yf: 0.014, d: 3.5 },
    { xf: 0.65, yf: 0.023, d: 5 },
    { xf: 0.82, yf: 0.016, d: 3 },
    { xf: 0.98, yf: 0.022, d: 4.5 },
    // ── Upper ──────────────────────────────────────────────────────────────
    { xf: 0.02, yf: 0.125, d: 4 },
    { xf: 0.12, yf: 0.156, d: 3 },
    { xf: 0.25, yf: 0.07, d: 4.5 },
    { xf: 0.75, yf: 0.078, d: 3.5 },
    { xf: 0.88, yf: 0.172, d: 5 },
    { xf: 0.97, yf: 0.133, d: 3.5 },
    // ── Middle sides ───────────────────────────────────────────────────────
    { xf: 0.02, yf: 0.352, d: 4.5 },
    { xf: 0.08, yf: 0.5, d: 3.5 },
    { xf: 0.15, yf: 0.609, d: 3 },
    { xf: 0.25, yf: 0.406, d: 4 },
    { xf: 0.75, yf: 0.391, d: 4 },
    { xf: 0.85, yf: 0.563, d: 3.5 },
    { xf: 0.92, yf: 0.352, d: 4.5 },
    { xf: 0.98, yf: 0.5, d: 5 },
    // ── Lower ──────────────────────────────────────────────────────────────
    { xf: 0.03, yf: 0.684, d: 4.5 },
    { xf: 0.2, yf: 0.719, d: 3.5 },
    { xf: 0.5, yf: 0.703, d: 5.5 },
    { xf: 0.8, yf: 0.734, d: 4.5 },
    { xf: 0.97, yf: 0.684, d: 5 },
    // ── Bottom strip ───────────────────────────────────────────────────────
    { xf: 0.07, yf: 0.813, d: 5 },
    { xf: 0.3, yf: 0.875, d: 3.5 },
    { xf: 0.5, yf: 0.836, d: 6 },
    { xf: 0.72, yf: 0.875, d: 4.5 },
    { xf: 0.93, yf: 0.813, d: 5.5 },
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
const STATIC_STAR_SEEDS: { xf: number; yf: number; d: number }[] = [
    // ── Upper centre — the band the twinkling seeds skip ───────────────────
    { xf: 0.42, yf: 0.098, d: 3 },
    { xf: 0.58, yf: 0.135, d: 3.5 },
    { xf: 0.68, yf: 0.055, d: 3 },
    // ── Upper-to-middle transition ─────────────────────────────────────────
    { xf: 0.09, yf: 0.242, d: 3.5 },
    { xf: 0.33, yf: 0.203, d: 3 },
    { xf: 0.62, yf: 0.227, d: 4 },
    { xf: 0.91, yf: 0.258, d: 3 },
    // ── Middle centre ──────────────────────────────────────────────────────
    { xf: 0.38, yf: 0.328, d: 3.5 },
    { xf: 0.68, yf: 0.313, d: 3.5 },
    { xf: 0.55, yf: 0.445, d: 3 },
    { xf: 0.35, yf: 0.523, d: 4 },
    // ── Lower centre ───────────────────────────────────────────────────────
    { xf: 0.62, yf: 0.594, d: 3 },
    { xf: 0.45, yf: 0.633, d: 3.5 },
    { xf: 0.88, yf: 0.648, d: 3 },
    { xf: 0.17, yf: 0.945, d: 4 },
];

const STAR_MIN_D = 3;
const STAR_MAX_D = 6;

/**
 * Twinkle phases. Stars share an opacity value with every Nth star, so the
 * whole field costs this many animation drivers rather than 31 — but the
 * durations are mutually near-coprime, so the groups never settle into a
 * visible rhythm the way five groups on round-numbered durations did.
 */
const PHASE_CONFIGS = [
    { delay: 0, duration: 3100 },
    { delay: 520, duration: 3700 },
    { delay: 1180, duration: 2900 },
    { delay: 1740, duration: 4300 },
    { delay: 2360, duration: 3300 },
    { delay: 2810, duration: 4700 },
] as const;

/** Opacity floor of the twinkle. */
const TWINKLE_MIN = 0.15;
const TWINKLE_RANGE = pingPong(1, TWINKLE_MIN);

/**
 * Per-star baseline brightness, folded into the fill colour rather than the
 * animated opacity so the two multiply. Bigger stars read as nearer/brighter.
 */
function baseAlpha(d: number): number {
    const t = (d - STAR_MIN_D) / (STAR_MAX_D - STAR_MIN_D);
    return 0.55 + 0.45 * t;
}

/** Appends an alpha channel to a 6-digit hex colour; other formats pass through. */
function withAlpha(color: string, alpha: number): string {
    if (!/^#[0-9a-f]{6}$/i.test(color)) return color;
    return (
        color +
        Math.round(Math.max(0, Math.min(1, alpha)) * 255)
            .toString(16)
            .padStart(2, '0')
    );
}

// ─── Sparkle geometry ───────────────────────────────────────────────────────

/**
 * A 4-point sparkle on a 0–100 box, centred at (50, 50).
 *
 * Each arm is one cubic whose control points sit close to the centre, which is
 * what pulls the edges concave and tapers the tips to needles. Straight-line
 * arms of constant width read as a plus sign at these sizes; the concavity is
 * what makes it read as a star.
 */
const SPARKLE_D =
    'M50,0 C54.5,33 67,45.5 100,50 C67,54.5 54.5,67 50,100 C45.5,67 33,54.5 0,50 C33,45.5 45.5,33 50,0 Z';

/** Tip-to-tip span of the sparkle, as a multiple of the seed's weight. */
const SPAN_RATIO = 2;
/** Seeds at or above this weight get a second sparkle at 45°, for 8 points. */
const CROSS_MIN_D = 4;
/** Size of that second sparkle, relative to the first. */
const CROSS_SCALE = 0.62;
/** Rotates the cross sparkle about the centre of the 0–100 box. */
const CROSS_TRANSFORM = `translate(50, 50) rotate(45) scale(${CROSS_SCALE}) translate(-50, -50)`;

interface Star {
    /** Absolute box for the star's own Svg, in canvas points. */
    box: ViewStyle;
    span: number;
    fill: string;
    /** Whether to add the 45° pair. */
    cross: boolean;
}

function makeStar(
    xf: number,
    yf: number,
    d: number,
    width: number,
    height: number,
    color: string,
): Star {
    const span = d * SPAN_RATIO;
    return {
        box: {
            position: 'absolute',
            left: xf * width - span / 2,
            top: yf * height - span / 2,
            width: span,
            height: span,
        },
        span,
        fill: withAlpha(color, baseAlpha(d)),
        cross: d >= CROSS_MIN_D,
    };
}

/** The star's geometry. Static once mounted — only the wrapper's opacity moves. */
function Sparkle({ span, fill, cross }: Omit<Star, 'box'>) {
    return (
        <Svg viewBox='0 0 100 100' width={span} height={span}>
            <Path fill={fill} d={SPARKLE_D} />
            {cross && (
                <G transform={CROSS_TRANSFORM}>
                    <Path fill={fill} d={SPARKLE_D} />
                </G>
            )}
        </Svg>
    );
}

/** One natively-looped 0→1 progress value per phase, mapped to a twinkle. */
function useTwinklePhases(animate: boolean) {
    const ref = useRef<Animated.Value[] | null>(null);
    if (ref.current === null) {
        ref.current = PHASE_CONFIGS.map(() => new Animated.Value(0));
    }
    const values = ref.current;

    useEffect(() => {
        if (!animate) {
            values.forEach((v) => v.setValue(0));
            return;
        }
        const loops = values.map((v, i) => {
            v.setValue(0);
            return nativeLoop(v, PHASE_CONFIGS[i].duration);
        });
        // The start delay is the one piece that stays on a JS timer, but it
        // fires once per mount rather than once per swing.
        const timers = loops.map((loop, i) =>
            setTimeout(() => loop.start(), PHASE_CONFIGS[i].delay),
        );
        return () => {
            timers.forEach(clearTimeout);
            loops.forEach((loop) => loop.stop());
        };
    }, [animate, values]);

    // progress 0 (the resting value) maps to full opacity, so a non-animating
    // field renders as a still sky rather than a dimmed one.
    return useMemo(
        () => values.map((v) => v.interpolate(TWINKLE_RANGE)),
        [values],
    );
}

interface StarFieldProps {
    width: number;
    height: number;
    color: string;
    animate: boolean;
}

function StarField({ width, height, color, animate }: StarFieldProps) {
    const opacities = useTwinklePhases(animate);

    const twinkling = useMemo(
        () =>
            STAR_SEEDS.map((seed) =>
                makeStar(seed.xf, seed.yf, seed.d, width, height, color),
            ),
        [width, height, color],
    );

    // Plain Views: no animated node, no opacity binding, nothing per-frame.
    const fixed = useMemo(
        () =>
            STATIC_STAR_SEEDS.map((seed) =>
                makeStar(seed.xf, seed.yf, seed.d, width, height, color),
            ),
        [width, height, color],
    );

    return (
        <>
            {twinkling.map((star, i) => (
                <Animated.View
                    key={i}
                    style={[
                        star.box,
                        { opacity: opacities[i % opacities.length] },
                    ]}
                    pointerEvents='none'
                >
                    <Sparkle
                        span={star.span}
                        fill={star.fill}
                        cross={star.cross}
                    />
                </Animated.View>
            ))}
            {fixed.map((star, i) => (
                <View
                    key={i}
                    style={star.box}
                    pointerEvents='none'
                >
                    <Sparkle
                        span={star.span}
                        fill={star.fill}
                        cross={star.cross}
                    />
                </View>
            ))}
        </>
    );
}

// ─── Component ───────────────────────────────────────────────────────────────

interface ClearNightIconProps {
    size?: number;
    color?: string;
    /** Stretch the canvas to the full screen width. */
    fullWidth?: boolean;
    /** Stretch the canvas to the full screen height. */
    fullHeight?: boolean;
    /** Run the twinkle animation. Defaults to true. */
    animate?: boolean;
    /** Render the star field. Pass false when a separate full-screen star layer
     *  is already behind the content. */
    showStars?: boolean;
    /** Render the moon disc. Pass false on the background star layer so only
     *  one moon appears (the hero instance). */
    showMoon?: boolean;
    /**
     * Fractional moon phase: 0 = new moon, 0.25 = first quarter (right side lit),
     * 0.5 = full moon, 0.75 = last quarter (left side lit). Omit for full-moon
     * appearance (existing default behaviour).
     */
    moonPhase?: number;
    /**
     * Flip the moon disc horizontally. Pass true for Southern Hemisphere observers
     * so the lit limb appears on the correct side (opposite to NH).
     * Does not affect stars. Default false.
     */
    mirrorDisc?: boolean;
}

export default function ClearNightIcon({
    size = 180,
    color = '#fefefe',
    fullWidth = false,
    fullHeight = false,
    animate = true,
    showStars = true,
    showMoon = true,
    moonPhase,
    mirrorDisc = false,
}: ClearNightIconProps) {
    const reduceMotion = useReduceMotion();
    const animateStars = animate && showStars && !reduceMotion;
    const { width: screenWidth, height: screenHeight } = useWindowDimensions();

    const vbW = fullWidth ? Math.round((screenWidth / size) * 1280) : 1280;
    const vbH = fullHeight ? Math.round((screenHeight / size) * 1280) : 1280;
    const offsetX = (vbW - 1280) / 2;
    const offsetY = (vbH - 1280) / 2;

    const width = fullWidth ? screenWidth : size;
    const height = fullHeight ? screenHeight : size;

    const moonD = useMemo(
        () => moonPhase !== undefined ? moonPhasePath(MOON_CX, MOON_CY, MOON_R, moonPhase) : MOON_D_FULL,
        [moonPhase],
    );

    return (
        <View
            style={{ width, height }}
            accessibilityLabel='Clear night'
        >
            {showMoon && moonD.length > 0 && (
                // mirrorDisc flips the disc for Southern Hemisphere observers.
                // scaleX(-1) around the disc centre mirrors the lit limb without
                // affecting the star layers above.
                <Svg
                    viewBox={`0 0 ${vbW} ${vbH}`}
                    width={width}
                    height={height}
                >
                    <G
                        transform={
                            mirrorDisc
                                ? `translate(${offsetX}, ${offsetY}) translate(${MOON_CX}, ${MOON_CY}) scale(-1, 1) translate(${-MOON_CX}, ${-MOON_CY})`
                                : `translate(${offsetX}, ${offsetY})`
                        }
                    >
                        <Path
                            fill={color}
                            d={moonD}
                        />
                    </G>
                </Svg>
            )}
            {showStars && (
                <StarField
                    width={width}
                    height={height}
                    color={color}
                    animate={animateStars}
                />
            )}
        </View>
    );
}
