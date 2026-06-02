import { useMemo } from 'react';
import { useWindowDimensions } from 'react-native';
import Svg, { Path, G } from 'react-native-svg';
import Animated, {
    useSharedValue,
    useAnimatedProps,
    useFrameCallback,
    SharedValue,
} from 'react-native-reanimated';
import { useReduceMotion } from '../../hooks/useReduceMotion';

const AnimatedPath = Animated.createAnimatedComponent(Path);

// ─── Path data ───────────────────────────────────────────────────────────────

const MOON_D =
    'M662.97,832.52h-36.75c-118-8.77-212.63-102.78-221.74-220.8l-.08-36.01c8.47-118.89,103.45-213.68,222.32-222.29l36.06.04c118.04,8.82,212.63,102.8,221.75,220.82l.08,36.02c-8.45,118.51-102.93,213.28-221.64,222.22Z';

// ─── Generated sparkle geometry ─────────────────────────────────────────────
// Produces a thin 4-pointed star path centred at (cx, cy) with outer radius r.
// The waist ratio (0.12) keeps the points needle-thin, matching the Illustrator
// sparkle aesthetic at any size.

function generateSparkle(cx: number, cy: number, r: number): string {
    const w = r * 0.12;
    return [
        `M ${cx},${(cy - r).toFixed(2)}`,
        `L ${(cx + w).toFixed(2)},${(cy - w).toFixed(2)}`,
        `L ${(cx + r).toFixed(2)},${cy}`,
        `L ${(cx + w).toFixed(2)},${(cy + w).toFixed(2)}`,
        `L ${cx},${(cy + r).toFixed(2)}`,
        `L ${(cx - w).toFixed(2)},${(cy + w).toFixed(2)}`,
        `L ${(cx - r).toFixed(2)},${cy}`,
        `L ${(cx - w).toFixed(2)},${(cy - w).toFixed(2)}`,
        'Z',
    ].join(' ');
}

// Star seeds use xf and yf (0–1 fractions of the viewBox dimensions) so paths
// can be recomputed for any canvas size. When vbW=vbH=1280, xf*1280 and
// yf*1280 reproduce the original absolute positions.
// Stars in the moon zone (y 350–840, x 390–890 in the 1280² space) stay at
// xf < 0.38 or xf > 0.62 to clear the centred moon on any canvas width.
const EXTRA_STAR_SEEDS: {
    xf: number;
    yf: number;
    r: number;
    delay: number;
    duration: number;
}[] = [
    // ── Top strip ─────────────────────────────────────────────────────────────
    { xf: 0.02, yf: 0.02, r: 14, delay: 600, duration: 3600 },
    { xf: 0.18, yf: 0.012, r: 12, delay: 2100, duration: 2800 },
    { xf: 0.35, yf: 0.027, r: 16, delay: 900, duration: 3400 },
    { xf: 0.5, yf: 0.014, r: 14, delay: 1400, duration: 4000 },
    { xf: 0.65, yf: 0.023, r: 18, delay: 3000, duration: 2600 },
    { xf: 0.82, yf: 0.016, r: 12, delay: 500, duration: 3200 },
    { xf: 0.98, yf: 0.022, r: 16, delay: 1800, duration: 3800 },
    // ── Upper ─────────────────────────────────────────────────────────────────
    { xf: 0.02, yf: 0.125, r: 15, delay: 1700, duration: 3800 },
    { xf: 0.12, yf: 0.156, r: 12, delay: 300, duration: 3200 },
    { xf: 0.25, yf: 0.07, r: 16, delay: 2400, duration: 2800 },
    { xf: 0.75, yf: 0.078, r: 14, delay: 700, duration: 4200 },
    { xf: 0.88, yf: 0.172, r: 18, delay: 1900, duration: 3000 },
    { xf: 0.97, yf: 0.133, r: 14, delay: 2600, duration: 2600 },
    // ── Middle band sides (avoid xf 0.38–0.62 to clear the centred moon) ──────
    { xf: 0.02, yf: 0.352, r: 16, delay: 2700, duration: 2600 },
    { xf: 0.08, yf: 0.5, r: 14, delay: 500, duration: 3800 },
    { xf: 0.15, yf: 0.609, r: 12, delay: 1300, duration: 3400 },
    { xf: 0.25, yf: 0.406, r: 15, delay: 2200, duration: 2800 },
    { xf: 0.75, yf: 0.391, r: 15, delay: 3400, duration: 3600 },
    { xf: 0.85, yf: 0.563, r: 14, delay: 800, duration: 4000 },
    { xf: 0.92, yf: 0.352, r: 16, delay: 2000, duration: 2600 },
    { xf: 0.98, yf: 0.5, r: 18, delay: 1100, duration: 3200 },
    // ── Lower ─────────────────────────────────────────────────────────────────
    { xf: 0.03, yf: 0.684, r: 16, delay: 2800, duration: 2800 },
    { xf: 0.2, yf: 0.719, r: 14, delay: 400, duration: 3800 },
    { xf: 0.5, yf: 0.703, r: 20, delay: 1600, duration: 3400 },
    { xf: 0.8, yf: 0.734, r: 16, delay: 2600, duration: 2600 },
    { xf: 0.97, yf: 0.684, r: 18, delay: 650, duration: 4200 },
    // ── Bottom strip ──────────────────────────────────────────────────────────
    { xf: 0.07, yf: 0.813, r: 18, delay: 1800, duration: 3000 },
    { xf: 0.3, yf: 0.875, r: 14, delay: 3100, duration: 2800 },
    { xf: 0.5, yf: 0.836, r: 22, delay: 900, duration: 3600 },
    { xf: 0.72, yf: 0.875, r: 16, delay: 2300, duration: 3200 },
    { xf: 0.93, yf: 0.813, r: 20, delay: 600, duration: 4000 },
];

function getGeneratedStars(vbW: number, vbH: number, count: number) {
    return EXTRA_STAR_SEEDS.slice(0, count).map((s, i) => ({
        id: `gen-${i}`,
        delay: s.delay,
        duration: s.duration,
        d: generateSparkle(Math.round(s.xf * vbW), Math.round(s.yf * vbH), s.r),
    }));
}

// ─── Animated star ───────────────────────────────────────────────────────────
// All stars derive their opacity from a single shared `clock` value (ms since
// mount, driven by a single useFrameCallback). This replaces the previous
// per-star setup of useSharedValue + withDelay(withRepeat(withSequence(...)))
// — mounting 40 of those simultaneously was a significant chunk of the
// MainPage mount cost.

interface TwinklingStarProps {
    d: string;
    delay: number;
    duration: number;
    fill: string;
    animate: boolean;
    clock: SharedValue<number>;
}

function TwinklingStar({
    d,
    delay,
    duration,
    fill,
    animate,
    clock,
}: TwinklingStarProps) {
    const animatedProps = useAnimatedProps(() => {
        'worklet';
        if (!animate) return { opacity: 1 };
        const half = duration * 0.5;
        const t = (clock.value + delay) % duration;
        // Triangle wave 1 → 0.15 → 1, with cubic ease-in-out per half to match
        // the perceptual feel of withTiming's default easing.
        const p = t < half ? t / half : (t - half) / half;
        const eased = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
        const opacity = t < half ? 1 - 0.85 * eased : 0.15 + 0.85 * eased;
        return { opacity };
    });

    return (
        <AnimatedPath
            animatedProps={animatedProps}
            fill={fill}
            fillRule='evenodd'
            d={d}
        />
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
    /** Render the generated sparkle stars. Pass false when a separate full-screen
     *  star layer is already behind the content — e.g. in the hero while
     *  WeatherHUD renders the star backdrop independently. */
    showStars?: boolean;
    /** Render the moon disc. Pass false on the background star layer so only
     *  one moon appears (the hero instance). */
    showMoon?: boolean;
}

export default function ClearNightIcon({
    size = 180,
    color = '#fefefe',
    fullWidth = false,
    fullHeight = false,
    animate = true,
    showStars = true,
    showMoon = true,
}: ClearNightIconProps) {
    const reduceMotion = useReduceMotion();
    const animateStars = animate && showStars && !reduceMotion;
    const { width: screenWidth, height: screenHeight } = useWindowDimensions();

    // Expand the viewBox to match the physical screen dimensions while keeping
    // the scale factor (1280/size units per pixel) identical in both axes so
    // the moon always renders at the same physical size.
    const vbW = fullWidth ? Math.round((screenWidth / size) * 1280) : 1280;
    const vbH = fullHeight ? Math.round((screenHeight / size) * 1280) : 1280;
    // Translate the moon so it remains visually centred in any canvas size.
    const offsetX = (vbW - 1280) / 2;
    const offsetY = (vbH - 1280) / 2;

    // Recompute generated star paths whenever the canvas dimensions change.
    // Returns [] when showStars is false so no star geometry is allocated.
    const generatedStars = useMemo(
        () => (showStars ? getGeneratedStars(vbW, vbH, 20) : []),
        [vbW, vbH, showStars],
    );

    // Single UI-thread clock driving every star's twinkle.
    const clock = useSharedValue(0);
    useFrameCallback((frameInfo) => {
        'worklet';
        clock.value = frameInfo.timeSinceFirstFrame ?? 0;
    }, animateStars);

    return (
        <Svg
            viewBox={`0 0 ${vbW} ${vbH}`}
            width={fullWidth ? screenWidth : size}
            height={fullHeight ? screenHeight : size}
            accessibilityLabel='Clear night'
        >
            {showMoon && (
                <G transform={`translate(${offsetX}, ${offsetY})`}>
                    <Path
                        fill={color}
                        d={MOON_D}
                    />
                </G>
            )}
            {showStars &&
                generatedStars.map((star) => (
                    <TwinklingStar
                        key={star.id}
                        d={star.d}
                        delay={star.delay}
                        duration={star.duration}
                        fill={color}
                        animate={animateStars}
                        clock={clock}
                    />
                ))}
        </Svg>
    );
}
