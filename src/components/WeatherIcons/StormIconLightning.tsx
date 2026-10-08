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
    DEFAULT_RAIN_ANGLE,
    FLASH_CURVE,
    FLASH_GAP_MIN_MS,
    FLASH_GAP_SPREAD_MS,
    FLASH_MS,
    type RainVariant,
} from '../../lib/weather/backdropSpec';
import { rainTiles, streakTiltDeg, type RainTile } from '../../lib/weather/rainField';
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
// One speed band of the rain (lib/weather/rainField): a static SVG of drops,
// `period` taller than the canvas, translated down and sideways by one period
// per loop. One Animated.Value drives both axes, so a band is a single native
// animation however many drops it holds.

interface RainLayerProps {
    tile: RainTile;
    fill: string;
    width: number;
    rainAngle: number;
    animate: boolean;
}

function RainLayer({ tile, fill, width, rainAngle, animate }: RainLayerProps) {
    const progress = useRef(new Animated.Value(0)).current;
    const { period, loopMs, height, drops } = tile;

    useEffect(() => {
        progress.setValue(0);
        if (!animate) return;
        // Linear, so the fall holds a constant velocity: an ease-in-out cycle
        // accelerates then decelerates once per period, which reads as a
        // stutter rather than as rain.
        const loop = nativeLoop(progress, loopMs);
        loop.start();
        return () => loop.stop();
    }, [animate, progress, loopMs]);

    // Memoised for the same reason as Bolt's `opacity` just above: AnimatedProps
    // is keyed on animated-node identity, so returning fresh interpolation nodes
    // each render rebuilt this layer's native node chain every time the parent
    // re-rendered.
    const translateY = useMemo(
        () => progress.interpolate({ inputRange: [0, 1], outputRange: [0, period] }),
        [progress, period],
    );
    const translateX = useMemo(
        () => progress.interpolate({ inputRange: [0, 1], outputRange: [0, rainAngle * period] }),
        [progress, rainAngle, period],
    );

    const tilt = streakTiltDeg(rainAngle);

    return (
        <Animated.View
            style={{
                position: 'absolute',
                left: 0,
                top: -period,
                width,
                height,
                transform: [{ translateY }, { translateX }],
            }}
            pointerEvents="none"
            // The drop SVG never changes — only this wrapper's transform moves.
            // Caching the layer as a GPU texture lets scroll/animation frames just
            // re-position a bitmap instead of re-rasterizing the full-screen SVG,
            // which is what was dropping frames while scrolling over the backdrop.
            shouldRasterizeIOS
            renderToHardwareTextureAndroid
        >
            <Svg viewBox={`0 0 ${width} ${height}`} width={width} height={height}>
                {drops.map((d, i) => (
                    <Rect
                        key={i}
                        x={d.x}
                        y={d.y}
                        width={d.w}
                        height={d.len}
                        rx={d.w / 2}
                        fill={fill}
                        opacity={d.opacity}
                        transform={tilt ? `rotate(${tilt} ${d.x + d.w / 2} ${d.y + d.len / 2})` : undefined}
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
            const gap = FLASH_GAP_MIN_MS + Math.random() * FLASH_GAP_SPREAD_MS;
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
     * 'storm' is the dense, fast, long-streaked rain behind thunderstorms.
     * 'light' is plain rain. 'drizzle' is many short, faint droplets. 'sleet'
     * is short quick streaks with round ice pellets among them. Pair
     * everything but 'storm' with showBolts={false} showFlash={false}.
     * Default 'storm'. Values: RAIN_VARIANTS in lib/weather/backdropSpec.
     */
    rainVariant?: RainVariant;
    decorative?: boolean;
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
    rainAngle = DEFAULT_RAIN_ANGLE,
    rainVariant = 'storm',
    decorative = false,
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

    const rain = useMemo(
        () => (showRain ? rainTiles(rainVariant, width, height, rainAngle) : []),
        [showRain, rainVariant, width, height, rainAngle],
    );

    return (
        <View
            // The rain tiles reach above and beside the canvas; keep them in it.
            style={{ width, height, overflow: showRain ? 'hidden' : 'visible' }}
            accessibilityLabel="Storm"
            accessibilityElementsHidden={decorative}
            importantForAccessibility={decorative ? 'no' : 'auto'}
        >
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

            {/* Rain — one native-driver layer per speed band; the bands'
                different speeds give the fall its depth. */}
            {showRain && rain.map((tile, i) => (
                <RainLayer
                    key={`${rainVariant}-${i}`}
                    tile={tile}
                    fill={color}
                    width={width}
                    rainAngle={rainAngle}
                    animate={animateOn}
                />
            ))}

            {/* Sheet flash — full-screen white pulse, sits above rain */}
            {showFlash && <SheetFlash animate={animateOn} />}
        </View>
    );
}
