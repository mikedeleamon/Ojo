/**
 * FlakeFall — full-screen falling snow, or the ice pellets in sleet, behind
 * WeatherHUD.
 *
 * Built the same way as the rain in StormIconLightning (see its RainLayer):
 * each group is one Animated.View holding a static SVG of stacked particles,
 * translated down one segment by a single native loop and snapped back. The
 * whole field costs one animated node per group, however many flakes it draws
 * (perf-guardrails: count the animated views, not the particles). The same
 * progress value also drives the sideways sway through a memoised
 * interpolation, so swaying costs nothing extra.
 *
 * Numbers live in lib/weather/backdropSpec, which the Instagram-story loop
 * renderer reads too — keep the geometry rules here and in
 * scripts/visual-library/render_loops.py in step.
 */

import { useEffect, useMemo, useRef } from 'react';
import { Animated, StyleSheet, useWindowDimensions, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { useReduceMotion } from '../../hooks/useReduceMotion';
import { nativeLoop } from '../../lib/animation/nativeLoop';
import { FLAKES_PER_COLUMN, FLAKE_STROKE, type FlakeGroup } from '../../lib/weather/backdropSpec';

/** Samples per sway cycle; the native driver interpolates linearly between them. */
const SWAY_STEPS = 12;

/**
 * translateX over one segment of fall: a full sine swing of `sway` points, plus
 * `slant` × distance fallen for wind-driven pellets. Columns are pre-offset by
 * the same slant (see `particles` below), so the snap back at the end of each
 * segment lands every particle exactly where its neighbour started.
 */
function driftRange(sway: number, slant: number, segmentH: number) {
    const inputRange: number[] = [];
    const outputRange: number[] = [];
    for (let i = 0; i <= SWAY_STEPS; i++) {
        const t = i / SWAY_STEPS;
        inputRange.push(t);
        outputRange.push(sway * Math.sin(2 * Math.PI * t) + slant * segmentH * t);
    }
    return { inputRange, outputRange };
}

/** Three strokes through the centre — vertical and ±60° — for a six-arm flake. */
function flakeArms(cx: number, cy: number, span: number): string {
    const r = span / 2;
    return [90, 30, 150]
        .map((deg) => {
            const a = (deg * Math.PI) / 180;
            const dx = r * Math.cos(a);
            const dy = r * Math.sin(a);
            return `M${cx - dx},${cy - dy} L${cx + dx},${cy + dy}`;
        })
        .join(' ');
}

interface FlakeLayerProps {
    group: FlakeGroup;
    width: number;
    height: number;
    color: string;
    slant: number;
    animate: boolean;
}

function FlakeLayer({ group, width, height, color, slant, animate }: FlakeLayerProps) {
    const progress = useRef(new Animated.Value(0)).current;
    const segmentH = height / FLAKES_PER_COLUMN;

    useEffect(() => {
        progress.setValue(0);
        if (!animate) return;
        // Linear, like the rain: an eased cycle would stutter once per segment.
        const loop = nativeLoop(progress, group.duration);
        const timer = setTimeout(() => loop.start(), group.startDelay);
        return () => {
            clearTimeout(timer);
            loop.stop();
        };
    }, [animate, progress, group.duration, group.startDelay]);

    // Memoised: AnimatedProps is keyed on node identity (perf-guardrails #6).
    const translateY = useMemo(
        () => progress.interpolate({ inputRange: [0, 1], outputRange: [0, segmentH] }),
        [progress, segmentH],
    );
    const translateX = useMemo(
        () => progress.interpolate(driftRange(group.sway, slant, segmentH)),
        [progress, group.sway, slant, segmentH],
    );

    // FLAKES_PER_COLUMN + 1 particles per column, the extra one a segment above
    // the canvas, so the loop is seamless: after one segment each particle sits
    // where the one below it started. The column phase staggers rows. With a
    // slant, each particle also sits slant × segment to the right of the one
    // above (the column leans with the wind, centred on its xOffset), which is
    // what keeps wind-blown pellets seamless horizontally too.
    const particles = useMemo(() => {
        const out: { x: number; y: number; key: string }[] = [];
        group.xOffsets.forEach((xf, ci) => {
            const phase = group.phases[ci] ?? 0;
            for (let i = -1; i < FLAKES_PER_COLUMN; i++) {
                const y = (i + phase) * segmentH;
                out.push({
                    x: xf * width + slant * (y - height / 2),
                    y,
                    key: `${ci}-${i}`,
                });
            }
        });
        return out;
    }, [group.xOffsets, group.phases, width, height, slant, segmentH]);

    const arms = useMemo(
        () => (group.shape === 'flake'
            ? particles.map((p) => flakeArms(p.x, p.y, group.size)).join(' ')
            : ''),
        [group.shape, group.size, particles],
    );

    return (
        <Animated.View
            style={[StyleSheet.absoluteFill, { transform: [{ translateY }, { translateX }] }]}
            pointerEvents='none'
            // Static art, moving wrapper: cache it as a texture, as RainLayer does.
            shouldRasterizeIOS
            renderToHardwareTextureAndroid
        >
            <Svg viewBox={`0 0 ${width} ${height}`} width={width} height={height}>
                {group.shape === 'flake' ? (
                    <Path
                        d={arms}
                        stroke={color}
                        strokeWidth={FLAKE_STROKE}
                        strokeLinecap='round'
                        strokeOpacity={group.opacity}
                        fill='none'
                    />
                ) : (
                    particles.map((p) => (
                        <Circle
                            key={p.key}
                            cx={p.x}
                            cy={p.y}
                            r={group.size / 2}
                            fill={color}
                            fillOpacity={group.opacity}
                        />
                    ))
                )}
            </Svg>
        </Animated.View>
    );
}

interface FlakeFallProps {
    groups: readonly FlakeGroup[];
    /** Wind drift per unit of fall, as for rain. 0 for snow, which sways instead. */
    slant?: number;
    color?: string;
    animate?: boolean;
}

export default function FlakeFall({ groups, slant = 0, color = '#fefefe', animate = true }: FlakeFallProps) {
    const reduceMotion = useReduceMotion();
    const { width, height } = useWindowDimensions();
    return (
        <View style={StyleSheet.absoluteFill} pointerEvents='none'>
            {groups.map((g) => (
                <FlakeLayer
                    key={g.id}
                    group={g}
                    width={width}
                    height={height}
                    color={color}
                    slant={slant}
                    animate={animate && !reduceMotion}
                />
            ))}
        </View>
    );
}
