import { useEffect, useMemo, useRef } from 'react';
import {
    Animated,
    useWindowDimensions,
    View,
    type ViewStyle,
} from 'react-native';
import Svg, { Path, G } from 'react-native-svg';
import { useReduceMotion } from '../../hooks/useReduceMotion';
import { nativeLoop, pingPong } from '../../lib/animation/nativeLoop';
import {
    FAST_PHASE_INDICES,
    NEAR_MIN_D,
    PHASE_CONFIGS,
    SLOW_PHASE_INDICES,
    SPAN_RATIO,
    SPARKLE_D,
    STAR_SEEDS,
    STATIC_STAR_SEEDS,
    TWINKLE_MIN_FAR,
    TWINKLE_MIN_NEAR,
    baseAlpha,
} from '../../lib/weather/backdropSpec';

// ─── Moon geometry ────────────────────────────────────────────────────────────

/** Original full-disc path — used when no moonPhase prop is supplied. */
const MOON_D_FULL =
    'M662.97,832.52h-36.75c-118-8.77-212.63-102.78-221.74-220.8l-.08-36.01c8.47-118.89,103.45-213.68,222.32-222.29l36.06.04c118.04,8.82,212.63,102.8,221.75,220.82l.08,36.02c-8.45,118.51-102.93,213.28-221.64,222.22Z';

/** Center and radius of the moon disc in the 1280×1280 viewBox. */
const MOON_CX = 644;
const MOON_CY = 593;
const MOON_R = 240;

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
function moonPhasePath(
    cx: number,
    cy: number,
    r: number,
    phase: number,
): string {
    const p = ((phase % 1) + 1) % 1; // normalise to [0, 1)
    if (p < 0.02 || p > 0.98) return ''; // new moon — nothing visible

    if (Math.abs(p - 0.5) < 0.01) {
        // Full moon — two semicircular arcs forming a complete disc
        return `M ${cx - r},${cy} A ${r},${r} 0 1,1 ${cx + r},${cy} A ${r},${r} 0 1,1 ${cx - r},${cy} Z`;
    }

    const top = `${cx},${cy - r}`;
    const bottom = `${cx},${cy + r}`;
    const rx = r * Math.abs(Math.cos(2 * Math.PI * p));

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
//
// The `starLayer` prop (see seedsForLayer / NEAR_MIN_D below) splits the same
// seed tables by size instead of adding stars, so a caller — currently
// WeatherHUD's full-screen backdrop — can mount two of these at different
// BackdropLayer scroll-parallax depths and get real near/far separation for
// the price of one extra wrapper view, not a bigger field.

/**
 * Depth band a caller can restrict the field to. Splits the same seed tables
 * by size rather than drawing extra stars, so a caller can mount two
 * instances — 'far' at a shallow scroll-parallax depth, 'near' at a deeper
 * one — and get real motion-parallax separation for the price of one extra
 * BackdropLayer, not a bigger field. Omit to render every seed (unchanged
 * behaviour for any caller that doesn't care about the split).
 */
type StarLayer = 'near' | 'far';

function seedsForLayer<T extends { d: number }>(
    seeds: readonly T[],
    layer: StarLayer | undefined,
): readonly T[] {
    if (!layer) return seeds;
    return seeds.filter((s) =>
        layer === 'near' ? s.d >= NEAR_MIN_D : s.d < NEAR_MIN_D,
    );
}

const TWINKLE_RANGE_NEAR = pingPong(1, TWINKLE_MIN_NEAR);
const TWINKLE_RANGE_FAR = pingPong(1, TWINKLE_MIN_FAR);

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

interface Star {
    /** Absolute box for the star's own Svg, in canvas points. */
    box: ViewStyle;
    span: number;
    fill: string;
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
    };
}

/** The star's geometry. Static once mounted — only the wrapper's opacity moves. */
function Sparkle({ span, fill }: Omit<Star, 'box'>) {
    return (
        <Svg
            viewBox='0 0 100 100'
            width={span}
            height={span}
        >
            <Path
                fill={fill}
                d={SPARKLE_D}
            />
        </Svg>
    );
}

/**
 * One natively-looped 0→1 progress value per phase. Raw — not mapped to an
 * opacity curve here, because near and far stars apply different amplitudes
 * (TWINKLE_RANGE_NEAR / _FAR) to the same six drivers rather than each
 * getting their own loop.
 */
function useTwinkleProgress(animate: boolean): Animated.Value[] {
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

    return values;
}

interface StarFieldProps {
    width: number;
    height: number;
    color: string;
    animate: boolean;
    /** Restrict the field to one depth band. Omit to render every seed. */
    layer?: StarLayer;
}

function StarField({ width, height, color, animate, layer }: StarFieldProps) {
    // progress[i] resting at 0 maps to full opacity below, so a non-animating
    // field renders as a still sky rather than a dimmed one.
    const progress = useTwinkleProgress(animate);

    const twinkling = useMemo(() => {
        const seeds = seedsForLayer(STAR_SEEDS, layer);
        let fast = 0;
        let slow = 0;
        return seeds.map((seed) => {
            const star = makeStar(seed.xf, seed.yf, seed.d, width, height, color);
            const near = seed.d >= NEAR_MIN_D;
            const pool = near ? FAST_PHASE_INDICES : SLOW_PHASE_INDICES;
            const phaseIndex = pool[(near ? fast++ : slow++) % pool.length];
            const range = near ? TWINKLE_RANGE_NEAR : TWINKLE_RANGE_FAR;
            return { star, opacity: progress[phaseIndex].interpolate(range) };
        });
    }, [width, height, color, layer, progress]);

    // Plain Views: no animated node, no opacity binding, nothing per-frame.
    const fixed = useMemo(
        () =>
            seedsForLayer(STATIC_STAR_SEEDS, layer).map((seed) =>
                makeStar(seed.xf, seed.yf, seed.d, width, height, color),
            ),
        [width, height, color, layer],
    );

    return (
        <>
            {twinkling.map((t, i) => (
                <Animated.View
                    key={i}
                    style={[t.star.box, { opacity: t.opacity }]}
                    pointerEvents='none'
                >
                    <Sparkle
                        span={t.star.span}
                        fill={t.star.fill}
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
    /**
     * Restrict the star field to one depth band — 'near' (bigger, brighter,
     * faster/deeper twinkle) or 'far' (the bulk of the field, dimmer and
     * slower). Lets a caller mount two instances at different scroll-parallax
     * depths for real motion-parallax separation. Omit to render every star,
     * which is what every non-full-screen caller wants.
     */
    starLayer?: StarLayer;
    decorative?: boolean;
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
    starLayer,
    decorative = false,
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
        () =>
            moonPhase !== undefined
                ? moonPhasePath(MOON_CX, MOON_CY, MOON_R, moonPhase)
                : MOON_D_FULL,
        [moonPhase],
    );

    return (
        <View
            style={{ width, height }}
            accessibilityLabel='Clear night'
            accessibilityElementsHidden={decorative}
            importantForAccessibility={decorative ? 'no' : 'auto'}
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
                    layer={starLayer}
                />
            )}
        </View>
    );
}
