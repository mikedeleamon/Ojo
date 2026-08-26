import { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, StyleSheet, useWindowDimensions, View } from 'react-native';
import Svg, { Path, Polygon, Rect } from 'react-native-svg';
import {
    CLOUD_D,
    BOLT_LEFT_PTS,
    BOLT_CENTER_PTS,
    BOLT_RIGHT_PTS,
} from './StormIcon';
import { useReduceMotion } from '../../hooks/useReduceMotion';
import {
    nativeLoop,
    stepped,
    steppedDuration,
} from '../../lib/animation/nativeLoop';

// ─── Bolt strike configurations ─────────────────────────────────────────────
// Each bolt has its own opacity loop with a unique strike pattern. Cycles are
// coprime so the three never lock into a repeating rhythm.
//
// The pattern is a list of [durationMs, opacity] holds, starting dark: the long
// gap, then flash / dark / flash / dark. Cuts between holds are instantaneous —
// that staccato is the whole character of lightning.
//
// It used to be nine chained `Animated.timing` legs, four of them `duration: 0`.
// `Animated.loop` can't drive a sequence natively (see lib/animation/nativeLoop),
// so every strike cost nine round-trips through the JS thread inside ~250 ms and
// the snap timings landed wherever JS got to them. As one interpolation over a
// single looping progress value, the native driver plays the whole pattern.

const BOLT_CONFIGS = [
    {
        id: 'left',
        points: BOLT_LEFT_PTS,
        startDelay: 0,
        pattern: [
            [5200, 0],
            [60, 1],
            [40, 0],
            [70, 1],
            [30, 0],
        ],
    },
    {
        id: 'center',
        points: BOLT_CENTER_PTS,
        startDelay: 1700,
        pattern: [
            [6600, 0],
            [80, 1],
            [50, 0],
            [60, 1],
            [40, 0],
        ],
    },
    {
        id: 'right',
        points: BOLT_RIGHT_PTS,
        startDelay: 3400,
        pattern: [
            [7700, 0],
            [70, 1],
            [30, 0],
            [50, 1],
            [40, 0],
        ],
    },
] as const satisfies readonly {
    id: string;
    points: string;
    startDelay: number;
    pattern: readonly (readonly [number, number])[];
}[];

// ─── Rain group configurations ──────────────────────────────────────────────
// Each group is one Animated.View loop translating an SVG of stacked streaks.
// Within a group, streaks are pre-offset vertically so the falling stream looks
// continuous as the group translates by one segment. Different durations
// across groups give a parallax / depth feel.

const RAIN_GROUPS = [
    { id: 'A', xOffsets: [0.07, 0.22, 0.38, 0.55, 0.71, 0.88], duration: 820,  startDelay: 0   },
    { id: 'B', xOffsets: [0.13, 0.29, 0.45, 0.61, 0.78, 0.94], duration: 950,  startDelay: 210 },
    { id: 'C', xOffsets: [0.04, 0.19, 0.34, 0.50, 0.66, 0.83], duration: 1100, startDelay: 420 },
] as const;

// Plain-rain variant: fewer columns and a slower fall than the storm rain
// above, so ordinary rain/drizzle reads as gentler without touching the
// thunderstorm backdrop's look. No sheet flash or bolts accompany this one —
// callers pass showFlash={false} showBolts={false}.
const RAIN_GROUPS_LIGHT = [
    { id: 'A', xOffsets: [0.10, 0.35, 0.60, 0.85], duration: 1300, startDelay: 0   },
    { id: 'B', xOffsets: [0.22, 0.48, 0.73],       duration: 1550, startDelay: 260 },
] as const;

// Drizzle variant: NOT the slow fall above — fine droplets fall quickly, just
// short and faint. Denser columns than the light-rain variant (closer to the
// storm count) since drizzle reads as a mist of many tiny drops rather than a
// few long streaks.
const RAIN_GROUPS_DRIZZLE = [
    { id: 'A', xOffsets: [0.08, 0.24, 0.40, 0.56, 0.72, 0.88], duration: 620, startDelay: 0   },
    { id: 'B', xOffsets: [0.16, 0.32, 0.48, 0.64, 0.80, 0.96], duration: 700, startDelay: 140 },
] as const;

const STREAK_OPACITY_STORM = 0.55;
const STREAK_OPACITY_LIGHT = 0.32;
const STREAK_OPACITY_DRIZZLE = 0.30;

const DROPS_PER_GROUP = 6;

// Streak dimensions in POINTS. The rain SVG is given a viewBox in points (see
// RainLayer) rather than the component's 1280-unit artwork space, which the
// full-screen canvas scaled by ~0.14: a 3-unit-wide streak came out 0.42 pt
// across — a sub-pixel hairline that aliases and shimmers as it translates,
// which is its own source of visible chop independent of frame rate.
const STREAK_WIDTH = 1.5;
const STREAK_HEIGHT_STORM = 14;
const STREAK_HEIGHT_DRIZZLE = 6;

// ─── Bolt component ──────────────────────────────────────────────────────────
// A single bolt polygon wrapped in an Animated.View whose opacity is driven by
// a real-lightning staccato loop (flash → snap-dim → flash → snap-dim → gap).

interface BoltProps {
    points: string;
    fill: string;
    vbW: number;
    vbH: number;
    width: number;
    height: number;
    polygonTransform: string;
    startDelay: number;
    pattern: readonly (readonly [number, number])[];
    animate: boolean;
}

function Bolt({
    points, fill, vbW, vbH, width, height, polygonTransform,
    startDelay, pattern, animate,
}: BoltProps) {
    const progress = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (!animate) return;
        progress.setValue(0);
        const loop = nativeLoop(progress, steppedDuration(pattern));
        // The start delay staggers the three bolts. It fires once per mount —
        // the strike pattern itself never touches the JS thread again.
        const timer = setTimeout(() => loop.start(), startDelay);
        return () => {
            clearTimeout(timer);
            loop.stop();
        };
    }, [animate, progress, startDelay, pattern]);

    // Static icon: the bolt is simply drawn. Animated: the pattern starts on a
    // dark hold, so a bolt waiting out its startDelay is correctly invisible.
    const opacity = useMemo(
        () => (animate ? progress.interpolate(stepped(pattern)) : 1),
        [animate, progress, pattern],
    );

    return (
        <Animated.View
            style={[StyleSheet.absoluteFill, { opacity }]}
            pointerEvents="none"
        >
            <Svg viewBox={`0 0 ${vbW} ${vbH}`} width={width} height={height}>
                <Polygon fill={fill} points={points} transform={polygonTransform} />
            </Svg>
        </Animated.View>
    );
}

// ─── Rain layer component ────────────────────────────────────────────────────
// One Animated.Value drives both translateY and translateX (via interpolate),
// so wind-blown rain is still a single native animation per group.

interface RainLayerProps {
    xOffsets: readonly number[];
    duration: number;
    startDelay: number;
    fill: string;
    opacity: number;
    streakHeight: number;
    width: number;
    height: number;
    rainAngle: number;
    animate: boolean;
}

function RainLayer({
    xOffsets, duration, startDelay, fill, opacity, streakHeight, width, height, rainAngle, animate,
}: RainLayerProps) {
    const progress = useRef(new Animated.Value(0)).current;
    // The rain SVG's viewBox is the layer in points, so STREAK_WIDTH/HEIGHT and
    // everything derived here are already in the units they render at — no
    // scale factor between what's written and what lands on screen.
    const segmentH = height / DROPS_PER_GROUP;

    useEffect(() => {
        if (!animate) {
            progress.setValue(0);
            return;
        }
        progress.setValue(0);
        // Linear, so the fall holds a constant velocity: an ease-in-out cycle
        // accelerates then decelerates once per segment, which reads as a
        // stutter rather than as rain.
        const loop = nativeLoop(progress, duration);
        const timer = setTimeout(() => loop.start(), startDelay);
        return () => {
            clearTimeout(timer);
            loop.stop();
        };
    }, [animate, progress, duration, startDelay]);

    // The SVG itself stays in place; we translate the Animated.View wrapper.
    // Y travels one segment (drops slot back to start), X travels rainAngle * segment.
    const translateY = progress.interpolate({
        inputRange: [0, 1],
        outputRange: [0, segmentH],
    });
    const translateX = progress.interpolate({
        inputRange: [0, 1],
        outputRange: [0, rainAngle * segmentH],
    });

    // Pre-stack DROPS_PER_GROUP+1 streaks per column, starting one segment ABOVE
    // the viewBox. After translating one segment downward and snapping back, the
    // visual pattern is identical (the extra top streak replaces the one that
    // moved out of frame), so the loop is seamless.
    const streaks = useMemo(() => {
        const result: { x: number; y: number; key: string }[] = [];
        xOffsets.forEach((xf, ci) => {
            const cx = xf * width;
            for (let i = -1; i < DROPS_PER_GROUP; i++) {
                result.push({
                    x: cx - STREAK_WIDTH / 2,
                    y: i * segmentH,
                    key: `${ci}-${i}`,
                });
            }
        });
        return result;
    }, [xOffsets, width, segmentH]);

    return (
        <Animated.View
            style={[StyleSheet.absoluteFill, { transform: [{ translateY }, { translateX }] }]}
            pointerEvents="none"
            // The streak SVG never changes — only this wrapper's transform moves.
            // Caching the layer as a GPU texture lets scroll/animation frames just
            // re-position a bitmap instead of re-rasterizing the full-screen SVG,
            // which is what was dropping frames while scrolling over the backdrop.
            shouldRasterizeIOS
            renderToHardwareTextureAndroid
        >
            <Svg viewBox={`0 0 ${width} ${height}`} width={width} height={height}>
                {streaks.map((s) => (
                    <Rect
                        key={s.key}
                        x={s.x}
                        y={s.y}
                        width={STREAK_WIDTH}
                        height={streakHeight}
                        rx={STREAK_WIDTH / 2}
                        fill={fill}
                        opacity={opacity}
                    />
                ))}
            </Svg>
        </Animated.View>
    );
}

// ─── Sheet lightning overlay ─────────────────────────────────────────────────
// One full-screen white Animated.View. After each strike sequence finishes,
// schedule the next one with a fresh randomized gap so flashes feel sporadic.

interface SheetFlashProps {
    animate: boolean;
}

/**
 * One strike: bright, near-dark, bright again, then a slow decay. Expressed as
 * a single interpolated timing rather than four chained ones, so a strike costs
 * one JS round-trip instead of four and its shape can't be stretched by a busy
 * JS thread mid-flash.
 */
const FLASH_MS = 400;
const FLASH_CURVE = {
    inputRange: [0, 50 / FLASH_MS, 110 / FLASH_MS, 180 / FLASH_MS, 1],
    outputRange: [0, 0.35, 0.05, 0.3, 0],
};

function SheetFlash({ animate }: SheetFlashProps) {
    const progress = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (!animate) {
            progress.setValue(0);
            return;
        }
        let cancelled = false;
        let timer: ReturnType<typeof setTimeout> | null = null;
        let currentAnim: Animated.CompositeAnimation | null = null;

        // The randomized gap is the point of this effect, so scheduling stays on
        // a JS timer — but it runs once per strike, ~every 4.5–9 s.
        const scheduleNext = () => {
            if (cancelled) return;
            const gap = 4500 + Math.random() * 4500;
            timer = setTimeout(() => {
                if (cancelled) return;
                progress.setValue(0);
                currentAnim = Animated.timing(progress, {
                    toValue: 1,
                    duration: FLASH_MS,
                    easing: Easing.linear,
                    useNativeDriver: true,
                });
                currentAnim.start(({ finished }) => {
                    if (finished && !cancelled) scheduleNext();
                });
            }, gap);
        };
        scheduleNext();

        return () => {
            cancelled = true;
            if (timer) clearTimeout(timer);
            if (currentAnim) currentAnim.stop();
            progress.setValue(0);
        };
    }, [animate, progress]);

    const opacity = progress.interpolate(FLASH_CURVE);

    return (
        <Animated.View
            style={[StyleSheet.absoluteFill, { backgroundColor: '#ffffff', opacity }]}
            pointerEvents="none"
        />
    );
}

// ─── Component ───────────────────────────────────────────────────────────────

interface StormIconLightningProps {
    size?: number;
    color?: string;
    /** Stretch the canvas to the full screen width. */
    fullWidth?: boolean;
    /** Stretch the canvas to the full screen height. */
    fullHeight?: boolean;
    /** Run animations. Default true. */
    animate?: boolean;
    /** Render the static cloud. Default true. */
    showCloud?: boolean;
    /** Render the 3 animated lightning bolts. Default true. */
    showBolts?: boolean;
    /** Render the falling-rain backdrop. Default false. */
    showRain?: boolean;
    /** Render the sheet-lightning overlay. Default false. */
    showFlash?: boolean;
    /** 0–0.3 wind-drift fraction (translateX / translateY per rain segment). */
    rainAngle?: number;
    /**
     * 'storm' is the dense, fast rain used behind thunderstorms. 'light' is
     * fewer streaks falling much slower and fainter, for plain rain. 'drizzle'
     * is dense but short, faint, quick-falling droplets. Pair 'light'/'drizzle'
     * with showBolts={false} showFlash={false}. Default 'storm'.
     */
    rainVariant?: 'storm' | 'light' | 'drizzle';
}

export default function StormIconLightning({
    size = 180,
    color = '#fefefe',
    fullWidth = false,
    fullHeight = false,
    animate = true,
    showCloud = true,
    showBolts = true,
    showRain = false,
    showFlash = false,
    rainAngle = 0.12,
    rainVariant = 'storm',
}: StormIconLightningProps) {
    const reduceMotion = useReduceMotion();
    const animateOn = animate && !reduceMotion;
    const { width: screenWidth, height: screenHeight } = useWindowDimensions();

    const vbW = fullWidth  ? Math.round((screenWidth  / size) * 1280) : 1280;
    const vbH = fullHeight ? Math.round((screenHeight / size) * 1280) : 1280;
    const offsetX = (vbW - 1280) / 2;
    const offsetY = (vbH - 1280) / 2;

    const width  = fullWidth  ? screenWidth  : size;
    const height = fullHeight ? screenHeight : size;

    return (
        <View style={{ width, height }} accessibilityLabel="Storm">
            {/* Cloud — static, sits at the bottom of the stack */}
            {showCloud && (
                <Svg viewBox={`0 0 ${vbW} ${vbH}`} width={width} height={height}>
                    <Path
                        fill={color}
                        d={CLOUD_D}
                        transform={`translate(${offsetX}, ${offsetY})`}
                    />
                </Svg>
            )}

            {/* Bolts — each in its own Animated.View, opacity-looped */}
            {showBolts && BOLT_CONFIGS.map((b) => (
                <Bolt
                    key={b.id}
                    points={b.points}
                    fill={color}
                    vbW={vbW}
                    vbH={vbH}
                    width={width}
                    height={height}
                    polygonTransform={`translate(${offsetX}, ${offsetY})`}
                    startDelay={b.startDelay}
                    pattern={b.pattern}
                    animate={animateOn}
                />
            ))}

            {/* Rain — parallax groups, each native-driver translateY+translateX.
                'light' swaps in fewer, much slower, fainter columns for plain
                rain. 'drizzle' keeps storm-like density and speed but with
                short, faint droplets instead of long streaks. */}
            {showRain && (
                rainVariant === 'light' ? RAIN_GROUPS_LIGHT
                : rainVariant === 'drizzle' ? RAIN_GROUPS_DRIZZLE
                : RAIN_GROUPS
            ).map((g) => (
                <RainLayer
                    key={g.id}
                    xOffsets={g.xOffsets}
                    duration={g.duration}
                    startDelay={g.startDelay}
                    fill={color}
                    opacity={
                        rainVariant === 'light' ? STREAK_OPACITY_LIGHT
                        : rainVariant === 'drizzle' ? STREAK_OPACITY_DRIZZLE
                        : STREAK_OPACITY_STORM
                    }
                    streakHeight={rainVariant === 'drizzle' ? STREAK_HEIGHT_DRIZZLE : STREAK_HEIGHT_STORM}
                    width={width}
                    height={height}
                    rainAngle={rainAngle}
                    animate={animateOn}
                />
            ))}

            {/* Sheet flash — full-screen white pulse, sits above rain */}
            {showFlash && <SheetFlash animate={animateOn} />}
        </View>
    );
}
