import { useEffect, useMemo, useRef } from 'react';
import {
    Animated,
    StyleSheet,
    useWindowDimensions,
    View,
} from 'react-native';
import Svg, { Path, Polygon, Rect } from 'react-native-svg';
import {
    CLOUD_D,
    BOLT_LEFT_PTS,
    BOLT_CENTER_PTS,
    BOLT_RIGHT_PTS,
} from './StormIcon';
import { useReduceMotion } from '../../hooks/useReduceMotion';

// ─── Bolt strike configurations ─────────────────────────────────────────────
// Each bolt has its own opacity loop with a unique strike pattern. Cycles are
// coprime so the three never lock into a repeating rhythm.

const BOLT_CONFIGS = [
    {
        id: 'left',
        points: BOLT_LEFT_PTS,
        startDelay: 0,
        flash1: 60,
        gap1: 40,
        flash2: 70,
        gap2: 30,
        longGap: 5200,
    },
    {
        id: 'center',
        points: BOLT_CENTER_PTS,
        startDelay: 1700,
        flash1: 80,
        gap1: 50,
        flash2: 60,
        gap2: 40,
        longGap: 6600,
    },
    {
        id: 'right',
        points: BOLT_RIGHT_PTS,
        startDelay: 3400,
        flash1: 70,
        gap1: 30,
        flash2: 50,
        gap2: 40,
        longGap: 7700,
    },
] as const;

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

const DROPS_PER_GROUP = 6;
const STREAK_WIDTH = 3;   // viewBox units
const STREAK_HEIGHT = 36; // viewBox units

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
    flash1: number;
    gap1: number;
    flash2: number;
    gap2: number;
    longGap: number;
    animate: boolean;
}

function Bolt({
    points, fill, vbW, vbH, width, height, polygonTransform,
    startDelay, flash1, gap1, flash2, gap2, longGap, animate,
}: BoltProps) {
    const opacity = useRef(new Animated.Value(animate ? 0 : 1)).current;

    useEffect(() => {
        if (!animate) {
            opacity.setValue(1);
            return;
        }
        opacity.setValue(0);
        // Strike sequence: snap-on (flash) → snap-off (gap) ×2, then long dark gap.
        // `duration: 0` toggles produce the harsh on/off of real lightning while
        // staying fully native-driver compatible.
        const loop = Animated.loop(
            Animated.sequence([
                Animated.timing(opacity, { toValue: 1, duration: 0,      useNativeDriver: true }),
                Animated.timing(opacity, { toValue: 1, duration: flash1, useNativeDriver: true }),
                Animated.timing(opacity, { toValue: 0, duration: 0,      useNativeDriver: true }),
                Animated.timing(opacity, { toValue: 0, duration: gap1,   useNativeDriver: true }),
                Animated.timing(opacity, { toValue: 1, duration: 0,      useNativeDriver: true }),
                Animated.timing(opacity, { toValue: 1, duration: flash2, useNativeDriver: true }),
                Animated.timing(opacity, { toValue: 0, duration: 0,      useNativeDriver: true }),
                Animated.timing(opacity, { toValue: 0, duration: gap2,   useNativeDriver: true }),
                Animated.timing(opacity, { toValue: 0, duration: longGap, useNativeDriver: true }),
            ]),
        );
        const timer = setTimeout(() => loop.start(), startDelay);
        return () => {
            clearTimeout(timer);
            loop.stop();
        };
    }, [animate, opacity, startDelay, flash1, gap1, flash2, gap2, longGap]);

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
    vbW: number;
    vbH: number;
    width: number;
    height: number;
    rainAngle: number;
    animate: boolean;
}

function RainLayer({
    xOffsets, duration, startDelay, fill, vbW, vbH, width, height, rainAngle, animate,
}: RainLayerProps) {
    const progress = useRef(new Animated.Value(0)).current;
    const segmentH = vbH / DROPS_PER_GROUP;

    useEffect(() => {
        if (!animate) {
            progress.setValue(0);
            return;
        }
        progress.setValue(0);
        const loop = Animated.loop(
            Animated.sequence([
                Animated.timing(progress, { toValue: 1, duration,        useNativeDriver: true }),
                Animated.timing(progress, { toValue: 0, duration: 0,     useNativeDriver: true }),
            ]),
        );
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
        outputRange: [0, segmentH * (height / vbH)],
    });
    const translateX = progress.interpolate({
        inputRange: [0, 1],
        outputRange: [0, rainAngle * segmentH * (width / vbW)],
    });

    // Pre-stack DROPS_PER_GROUP+1 streaks per column, starting one segment ABOVE
    // the viewBox. After translating one segment downward and snapping back, the
    // visual pattern is identical (the extra top streak replaces the one that
    // moved out of frame), so the loop is seamless.
    const streaks = useMemo(() => {
        const result: { x: number; y: number; key: string }[] = [];
        xOffsets.forEach((xf, ci) => {
            const cx = xf * vbW;
            for (let i = -1; i < DROPS_PER_GROUP; i++) {
                result.push({
                    x: cx - STREAK_WIDTH / 2,
                    y: i * segmentH,
                    key: `${ci}-${i}`,
                });
            }
        });
        return result;
    }, [xOffsets, vbW, segmentH]);

    return (
        <Animated.View
            style={[StyleSheet.absoluteFill, { transform: [{ translateY }, { translateX }] }]}
            pointerEvents="none"
        >
            <Svg viewBox={`0 0 ${vbW} ${vbH}`} width={width} height={height}>
                {streaks.map((s) => (
                    <Rect
                        key={s.key}
                        x={s.x}
                        y={s.y}
                        width={STREAK_WIDTH}
                        height={STREAK_HEIGHT}
                        rx={STREAK_WIDTH / 2}
                        fill={fill}
                        opacity={0.55}
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

function SheetFlash({ animate }: SheetFlashProps) {
    const opacity = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (!animate) {
            opacity.setValue(0);
            return;
        }
        let cancelled = false;
        let timer: ReturnType<typeof setTimeout> | null = null;
        let currentAnim: Animated.CompositeAnimation | null = null;

        const scheduleNext = () => {
            if (cancelled) return;
            const gap = 4500 + Math.random() * 4500;
            timer = setTimeout(() => {
                if (cancelled) return;
                currentAnim = Animated.sequence([
                    Animated.timing(opacity, { toValue: 0.35, duration: 50,  useNativeDriver: true }),
                    Animated.timing(opacity, { toValue: 0.05, duration: 60,  useNativeDriver: true }),
                    Animated.timing(opacity, { toValue: 0.30, duration: 70,  useNativeDriver: true }),
                    Animated.timing(opacity, { toValue: 0,    duration: 220, useNativeDriver: true }),
                ]);
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
            opacity.setValue(0);
        };
    }, [animate, opacity]);

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
                    flash1={b.flash1}
                    gap1={b.gap1}
                    flash2={b.flash2}
                    gap2={b.gap2}
                    longGap={b.longGap}
                    animate={animateOn}
                />
            ))}

            {/* Rain — 3 parallax groups, each native-driver translateY+translateX */}
            {showRain && RAIN_GROUPS.map((g) => (
                <RainLayer
                    key={g.id}
                    xOffsets={g.xOffsets}
                    duration={g.duration}
                    startDelay={g.startDelay}
                    fill={color}
                    vbW={vbW}
                    vbH={vbH}
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
