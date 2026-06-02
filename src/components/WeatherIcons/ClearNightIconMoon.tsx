import { useEffect, useMemo, useRef } from 'react';
import { Animated, StyleSheet, useWindowDimensions, View } from 'react-native';
import Svg, { Path, G } from 'react-native-svg';
import { useReduceMotion } from '../../hooks/useReduceMotion';

// ─── Path data ───────────────────────────────────────────────────────────────

const MOON_D =
    'M662.97,832.52h-36.75c-118-8.77-212.63-102.78-221.74-220.8l-.08-36.01c8.47-118.89,103.45-213.68,222.32-222.29l36.06.04c118.04,8.82,212.63,102.8,221.75,220.82l.08,36.02c-8.45,118.51-102.93,213.28-221.64,222.22Z';

// ─── Generated sparkle geometry ─────────────────────────────────────────────

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

// xf/yf are 0–1 fractions of the viewBox so paths recompute for any canvas size.
// Middle-band seeds (yf 0.35–0.66) stay outside xf 0.38–0.62 to clear the moon.
const EXTRA_STAR_SEEDS: {
    xf: number; yf: number; r: number;
}[] = [
    // ── Top strip ──────────────────────────────────────────────────────────
    { xf: 0.02, yf: 0.020, r: 14 },
    { xf: 0.18, yf: 0.012, r: 12 },
    { xf: 0.35, yf: 0.027, r: 16 },
    { xf: 0.50, yf: 0.014, r: 14 },
    { xf: 0.65, yf: 0.023, r: 18 },
    { xf: 0.82, yf: 0.016, r: 12 },
    { xf: 0.98, yf: 0.022, r: 16 },
    // ── Upper ──────────────────────────────────────────────────────────────
    { xf: 0.02, yf: 0.125, r: 15 },
    { xf: 0.12, yf: 0.156, r: 12 },
    { xf: 0.25, yf: 0.070, r: 16 },
    { xf: 0.75, yf: 0.078, r: 14 },
    { xf: 0.88, yf: 0.172, r: 18 },
    { xf: 0.97, yf: 0.133, r: 14 },
    // ── Middle sides ───────────────────────────────────────────────────────
    { xf: 0.02, yf: 0.352, r: 16 },
    { xf: 0.08, yf: 0.500, r: 14 },
    { xf: 0.15, yf: 0.609, r: 12 },
    { xf: 0.25, yf: 0.406, r: 15 },
    { xf: 0.75, yf: 0.391, r: 15 },
    { xf: 0.85, yf: 0.563, r: 14 },
    { xf: 0.92, yf: 0.352, r: 16 },
    { xf: 0.98, yf: 0.500, r: 18 },
    // ── Lower ──────────────────────────────────────────────────────────────
    { xf: 0.03, yf: 0.684, r: 16 },
    { xf: 0.20, yf: 0.719, r: 14 },
    { xf: 0.50, yf: 0.703, r: 20 },
    { xf: 0.80, yf: 0.734, r: 16 },
    { xf: 0.97, yf: 0.684, r: 18 },
    // ── Bottom strip ───────────────────────────────────────────────────────
    { xf: 0.07, yf: 0.813, r: 18 },
    { xf: 0.30, yf: 0.875, r: 14 },
    { xf: 0.50, yf: 0.836, r: 22 },
    { xf: 0.72, yf: 0.875, r: 16 },
    { xf: 0.93, yf: 0.813, r: 20 },
];

function getGeneratedStars(vbW: number, vbH: number, count: number) {
    return EXTRA_STAR_SEEDS.slice(0, count).map((s, i) => ({
        id: `gen-${i}`,
        d: generateSparkle(Math.round(s.xf * vbW), Math.round(s.yf * vbH), s.r),
    }));
}

// ─── Star layer ──────────────────────────────────────────────────────────────
// Stars partitioned into NUM_GROUPS layers, each rendered in its own <Svg>
// wrapped in an Animated.View. Opacity is animated with useNativeDriver:true,
// so the entire twinkle runs on the native main thread (CoreAnimation on iOS)
// with zero JS/UI-thread work per frame — no contention with scroll gestures.
// react-native-svg's SMIL <Animate> element isn't actually implemented natively
// (see issue #833), so this is the only "fire-and-forget" path that twinkles.

const NUM_GROUPS = 5;
const GROUP_CONFIGS = [
    { delay: 0,    duration: 3200 },
    { delay: 700,  duration: 3800 },
    { delay: 1400, duration: 2800 },
    { delay: 2100, duration: 4200 },
    { delay: 2800, duration: 3400 },
] as const;

interface StarLayerProps {
    stars: { id: string; d: string }[];
    vbW: number;
    vbH: number;
    width: number;
    height: number;
    fill: string;
    delay: number;
    duration: number;
    animate: boolean;
}

function StarLayer({
    stars, vbW, vbH, width, height, fill, delay, duration, animate,
}: StarLayerProps) {
    const opacity = useRef(new Animated.Value(1)).current;

    useEffect(() => {
        if (!animate) {
            opacity.setValue(1);
            return;
        }
        const half = duration / 2;
        const loop = Animated.loop(
            Animated.sequence([
                Animated.timing(opacity, { toValue: 0.15, duration: half, useNativeDriver: true }),
                Animated.timing(opacity, { toValue: 1,    duration: half, useNativeDriver: true }),
            ]),
        );
        const timer = setTimeout(() => loop.start(), delay);
        return () => {
            clearTimeout(timer);
            loop.stop();
        };
    }, [animate, delay, duration, opacity]);

    return (
        <Animated.View style={[StyleSheet.absoluteFill, { opacity }]} pointerEvents="none">
            <Svg viewBox={`0 0 ${vbW} ${vbH}`} width={width} height={height}>
                {stars.map((star) => (
                    <Path key={star.id} fill={fill} fillRule="evenodd" d={star.d} />
                ))}
            </Svg>
        </Animated.View>
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
     *  star layer is already behind the content. */
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

    const vbW = fullWidth  ? Math.round((screenWidth  / size) * 1280) : 1280;
    const vbH = fullHeight ? Math.round((screenHeight / size) * 1280) : 1280;
    const offsetX = (vbW - 1280) / 2;
    const offsetY = (vbH - 1280) / 2;

    const width  = fullWidth  ? screenWidth  : size;
    const height = fullHeight ? screenHeight : size;

    const allStars = useMemo(
        () => (showStars ? getGeneratedStars(vbW, vbH, 31) : []),
        [vbW, vbH, showStars],
    );
    // Round-robin partition so each group spans every sky band rather than one
    // vertical slice — the shared-opacity grouping is then visually unobtrusive.
    const groups = useMemo(() => {
        const g: { id: string; d: string }[][] = Array.from({ length: NUM_GROUPS }, () => []);
        allStars.forEach((s, i) => g[i % NUM_GROUPS].push(s));
        return g;
    }, [allStars]);

    return (
        <View style={{ width, height }} accessibilityLabel="Clear night">
            {showMoon && (
                <Svg viewBox={`0 0 ${vbW} ${vbH}`} width={width} height={height}>
                    <G transform={`translate(${offsetX}, ${offsetY})`}>
                        <Path fill={color} d={MOON_D} />
                    </G>
                </Svg>
            )}
            {showStars && groups.map((stars, gi) => (
                <StarLayer
                    key={gi}
                    stars={stars}
                    vbW={vbW}
                    vbH={vbH}
                    width={width}
                    height={height}
                    fill={color}
                    delay={GROUP_CONFIGS[gi].delay}
                    duration={GROUP_CONFIGS[gi].duration}
                    animate={animateStars}
                />
            ))}
        </View>
    );
}
