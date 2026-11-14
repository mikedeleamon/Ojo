/**
 * StyleDnaArt — the generative Style DNA poster art: an aura of the colors
 * someone wears, growth rings for the outfits they've logged, and a double helix
 * whose rungs are their real color pairings. Layout in lib/styleArt.
 *
 * Layers, so only what moves moves:
 *   ground · aura (breathes and drifts) · rings + grain · helix · vignette
 *
 * The helix turns in 3D on one linear native loop, with no redraw:
 *   - The strands slide. Side-on, a strand turning on its axis traces exactly
 *     the curve of one sliding along it, so each strand layer is drawn one turn
 *     wider than the art and slid left by one turn, then wrapped.
 *   - The rungs don't slide: in a turning helix each base pair stays where it
 *     is along the axis and swings around it. Each rung is its own view pinned
 *     at its x, stretched by sin(angle) (negative flips it, swapping which
 *     strand's end is on top) and dimmed as it turns edge-on.
 *   - Back strands, then rungs, then front strands, so the rungs pass between.
 * The JS thread is never involved once it starts.
 *
 * A share capture renders it all still (`animate` off).
 */

import { memo, useEffect, useId, useMemo, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, G, Line, LinearGradient, Path, RadialGradient, Rect, Stop } from 'react-native-svg';
import { nativeLoop, pingPong } from '../../lib/animation/nativeLoop';
import { ART_GROUND, layoutStyleArt, type StyleArtLayout } from '../../lib/styleArt';
import type { StyleArchetype } from '../../lib/styleArchetype';

interface Props {
    archetype: StyleArchetype;
    width: number;
    height: number;
    animate?: boolean;
    /** Dim the art, e.g. behind the locked teaser's text. */
    dim?: boolean;
}

const DRIFT_MS = 14000;
const DRIFT_X = pingPong(-6, 6);
const BREATHE = pingPong(1, 1.06);
/** One full turn of the helix. Slow enough to read as calm, not busy. */
const TURN_MS = 9000;

const useSvgId = (prefix: string) => `${prefix}${useId().replace(/[^a-zA-Z0-9]/g, '')}`;

/** One side of the strands: the back halves, or the front halves with their light core. */
const Strands = ({ art, width, part }: { art: StyleArtLayout; width: number; part: 'back' | 'front' }) => (
    <Svg width={width} height={art.height}>
        <G opacity={0.9}>
            {(part === 'back' ? art.strands.back : art.strands.front).map((d, s) =>
                d ? (
                    <G key={s}>
                        <Path
                            d={d}
                            fill='none'
                            stroke={art.strands.hex[s]}
                            strokeOpacity={part === 'back' ? 0.35 : 1}
                            strokeWidth={part === 'back' ? 1.6 : 2.6}
                            strokeLinecap='round'
                        />
                        {part === 'front' && (
                            <Path d={d} fill='none' stroke='#ffffff' strokeOpacity={0.3} strokeWidth={0.8} strokeLinecap='round' />
                        )}
                    </G>
                ) : null,
            )}
        </G>
    </Svg>
);

/** sin(phase + 2π·t) over one turn, sampled finely enough to read as smooth. */
const SIN_STEPS = 24;
function turnCurve(phase: number, map: (s: number) => number) {
    const inputRange: number[] = [];
    const outputRange: number[] = [];
    for (let i = 0; i <= SIN_STEPS; i++) {
        const t = i / SIN_STEPS;
        inputRange.push(t);
        outputRange.push(map(Math.sin(phase + t * Math.PI * 2)));
    }
    return { inputRange, outputRange };
}

/**
 * A rung pinned at its x, swinging around the axis as the helix turns: strand
 * 0's end below the axis, strand 1's above, scaled by sin(angle).
 */
const TurningRung = ({
    rung,
    axis,
    turn,
}: {
    rung: StyleArtLayout['turningRungs'][number];
    axis: StyleArtLayout['axis'];
    turn: Animated.Value;
}) => {
    const dot = rung.width * 1.8 + 1.6;
    const w = Math.max(dot, rung.width);
    const h = axis.amp * 2 + dot;
    const scaleY = useMemo(() => turn.interpolate(turnCurve(rung.phase, (s) => s)), [turn, rung.phase]);
    // Broadside rungs read clearly; edge-on ones fade back.
    const opacity = useMemo(
        () => turn.interpolate(turnCurve(rung.phase, (s) => 0.3 + 0.65 * Math.abs(s))),
        [turn, rung.phase],
    );
    return (
        <Animated.View
            pointerEvents='none'
            style={{
                position: 'absolute',
                left: rung.x - w / 2,
                top: axis.y0 - h / 2,
                width: w,
                height: h,
                alignItems: 'center',
                opacity,
                transform: [{ scaleY }],
            }}
        >
            <View style={{ width: dot, height: dot, borderRadius: dot / 2, backgroundColor: rung.hexB }} />
            <View style={{ flex: 1, width: rung.width, marginTop: -dot / 2, backgroundColor: rung.hexB, borderTopLeftRadius: rung.width / 2, borderTopRightRadius: rung.width / 2 }} />
            <View style={{ flex: 1, width: rung.width, marginBottom: -dot / 2, backgroundColor: rung.hexA, borderBottomLeftRadius: rung.width / 2, borderBottomRightRadius: rung.width / 2 }} />
            <View style={{ width: dot, height: dot, borderRadius: dot / 2, backgroundColor: rung.hexA }} />
        </Animated.View>
    );
};

/** The still helix (share poster, Reduce Motion): back halves, rungs, front halves, light core. */
const Helix = ({ art, width }: { art: StyleArtLayout; width: number }) => (
    <Svg width={width} height={art.height}>
        <G opacity={0.9}>
            {art.strands.back.map((d, s) =>
                d ? (
                    <Path key={`b${s}`} d={d} fill='none' stroke={art.strands.hex[s]} strokeOpacity={0.35} strokeWidth={1.6} strokeLinecap='round' />
                ) : null,
            )}
            {art.rungs.map((r, i) => {
                const mid = (r.y1 + r.y2) / 2;
                return (
                    <G key={`r${i}`} opacity={r.opacity}>
                        <Line x1={r.x} y1={r.y1} x2={r.x} y2={mid} stroke={r.hexA} strokeWidth={r.width} strokeLinecap='round' />
                        <Line x1={r.x} y1={mid} x2={r.x} y2={r.y2} stroke={r.hexB} strokeWidth={r.width} strokeLinecap='round' />
                        <Circle cx={r.x} cy={r.y1} r={r.width * 0.9 + 0.8} fill={r.hexA} />
                        <Circle cx={r.x} cy={r.y2} r={r.width * 0.9 + 0.8} fill={r.hexB} />
                    </G>
                );
            })}
            {art.strands.front.map((d, s) =>
                d ? (
                    <Path key={`f${s}`} d={d} fill='none' stroke={art.strands.hex[s]} strokeWidth={2.6} strokeLinecap='round' />
                ) : null,
            )}
            {art.strands.front.map((d, s) =>
                d ? (
                    <Path key={`c${s}`} d={d} fill='none' stroke='#ffffff' strokeOpacity={0.3} strokeWidth={0.8} strokeLinecap='round' />
                ) : null,
            )}
        </G>
    </Svg>
);

function StyleDnaArt({ archetype, width, height, animate = false, dim = false }: Props) {
    const art = useMemo(() => layoutStyleArt(archetype, width, height), [archetype, width, height]);
    const groundId = useSvgId('ground');
    const vignetteId = useSvgId('vignette');
    const orbId = useSvgId('orb');

    // Aura: breathes and drifts.
    const drift = useRef(new Animated.Value(0.25)).current;
    useEffect(() => {
        drift.setValue(0.25);
        if (!animate) return;
        const loop = nativeLoop(drift, DRIFT_MS);
        loop.start();
        return () => loop.stop();
    }, [animate, drift]);
    const translateX = useMemo(() => drift.interpolate(DRIFT_X), [drift]);
    const scale = useMemo(() => drift.interpolate(BREATHE), [drift]);

    // Helix: one turn per loop.
    const turn = useRef(new Animated.Value(0)).current;
    useEffect(() => {
        turn.setValue(0);
        if (!animate) return;
        const loop = nativeLoop(turn, TURN_MS);
        loop.start();
        return () => loop.stop();
    }, [animate, turn]);
    const slide = useMemo(
        () => turn.interpolate({ inputRange: [0, 1], outputRange: [0, -art.helixPeriod] }),
        [turn, art.helixPeriod],
    );
    const helixWidth = Math.ceil(width + art.helixPeriod + 4);

    return (
        <View style={[styles.frame, { width, height, opacity: dim ? 0.55 : 1 }]}>
            <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
                <Defs>
                    <LinearGradient id={groundId} x1='0' y1='0' x2='0' y2='1'>
                        <Stop offset='0' stopColor={ART_GROUND[0]} />
                        <Stop offset='0.5' stopColor={ART_GROUND[1]} />
                        <Stop offset='1' stopColor={ART_GROUND[2]} />
                    </LinearGradient>
                </Defs>
                <Rect x={0} y={0} width={width} height={height} fill={`url(#${groundId})`} />
            </Svg>

            {/* The aura, on its own layer so it can drift without the rest. */}
            <Animated.View
                style={[StyleSheet.absoluteFill, animate && { transform: [{ translateX }, { scale }] }]}
                pointerEvents='none'
                shouldRasterizeIOS={animate}
            >
                <Svg width={width} height={height}>
                    <Defs>
                        {art.orbs.map((o, i) => (
                            <RadialGradient key={i} id={`${orbId}${i}`} cx='50%' cy='50%' r='50%'>
                                <Stop offset='0' stopColor={o.hex} stopOpacity={o.opacity} />
                                <Stop offset='0.45' stopColor={o.hex} stopOpacity={o.opacity * 0.45} />
                                <Stop offset='1' stopColor={o.hex} stopOpacity={0} />
                            </RadialGradient>
                        ))}
                    </Defs>
                    {/* Least worn first, so the signature color glows on top. */}
                    {[...art.orbs].reverse().map((o, ri) => {
                        const i = art.orbs.length - 1 - ri;
                        return <Circle key={i} cx={o.cx} cy={o.cy} r={o.r} fill={`url(#${orbId}${i})`} />;
                    })}
                </Svg>
            </Animated.View>

            <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
                {art.rings.map((r, i) => (
                    <Circle
                        key={`ring${i}`}
                        cx={r.cx}
                        cy={r.cy}
                        r={r.r}
                        fill='none'
                        stroke='#ffffff'
                        strokeOpacity={0.05 + 0.02 * (i % 2)}
                        strokeWidth={0.8}
                    />
                ))}
                {art.grain.map((g, i) => (
                    <Circle key={`g${i}`} cx={g.x} cy={g.y} r={g.r} fill='#ffffff' fillOpacity={g.o} />
                ))}
            </Svg>

            {animate ? (
                <>
                    {/* Back strands, rungs turning in place, front strands. */}
                    <Animated.View
                        style={[styles.helix, { width: helixWidth, height, transform: [{ translateX: slide }] }]}
                        pointerEvents='none'
                        // Static art, moving wrapper: cache it as a texture.
                        shouldRasterizeIOS
                        renderToHardwareTextureAndroid
                    >
                        <Strands art={art} width={helixWidth} part='back' />
                    </Animated.View>
                    {art.turningRungs.map((r, i) => (
                        <TurningRung key={i} rung={r} axis={art.axis} turn={turn} />
                    ))}
                    <Animated.View
                        style={[styles.helix, { width: helixWidth, height, transform: [{ translateX: slide }] }]}
                        pointerEvents='none'
                        shouldRasterizeIOS
                        renderToHardwareTextureAndroid
                    >
                        <Strands art={art} width={helixWidth} part='front' />
                    </Animated.View>
                </>
            ) : (
                <View style={[styles.helix, { width: helixWidth, height }]} pointerEvents='none'>
                    <Helix art={art} width={helixWidth} />
                </View>
            )}

            <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
                <Defs>
                    <RadialGradient id={vignetteId} cx='50%' cy='45%' r='75%'>
                        <Stop offset='0.55' stopColor='#000000' stopOpacity={0} />
                        <Stop offset='1' stopColor='#000000' stopOpacity={0.45} />
                    </RadialGradient>
                </Defs>
                <Rect x={0} y={0} width={width} height={height} fill={`url(#${vignetteId})`} />
            </Svg>
        </View>
    );
}

export default memo(StyleDnaArt);

const styles = StyleSheet.create({
    // Clips the helix layer, which is wider than the art.
    frame: { overflow: 'hidden' },
    helix: { position: 'absolute', left: 0, top: 0 },
});
