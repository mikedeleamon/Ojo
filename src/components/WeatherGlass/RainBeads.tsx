/**
 * RainBeads — water beaded all over the outfit card's glass: heavier along the
 * edges where it collects, scattered across the face, and now and then a bead
 * on the top border that grows heavy and runs down the face.
 *
 * Built for the perf notes in StormIconLightning and SunGlare:
 *   - Static beads live in four thin edge strips plus one tiny Svg per bead on
 *     the face, never one card-sized Svg. The outfit card can be 1,200 pt tall,
 *     and a canvas that size would be a 12 MB backing store for some dots.
 *   - Motion is a handful of animated views, each a static Svg moved by one
 *     native loop: the runners, and two "fresh beads" strips fading in and out
 *     on the sides as drops land. The bead count costs nothing per frame.
 *
 * Rain hitting the card's top edge is RainEdgeSplash, outside the card, since
 * the card clips everything inside it. Geometry is in lib/weather/weatherGlass.
 */

import { memo, useEffect, useMemo, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Defs } from 'react-native-svg';
import { nativeLoop, pingPong } from '../../lib/animation/nativeLoop';
import {
    BEAD_SPECS,
    GLASS_BAND,
    SWELL_SCALE,
    borderRunners,
    interiorBeads,
    runnerTimeline,
    stripBeads,
    type Bead,
    type BorderRunner,
    type RainDensity,
} from '../../lib/weather/weatherGlass';
import { BeadGradient, BeadShape, useGradientId } from './beadArt';

const SEED = { top: 101, bottom: 211, left: 307, right: 401, interior: 503, runners: 601, freshL: 701, freshR: 809 };
/** Fresh beads are this much sparser than the settled ones. */
const FRESH_SPARSENESS = 2.6;
const FRESH_MS = 5600;
const FRESH_FADE = pingPong(0.15, 1);

type Edge = 'top' | 'bottom' | 'left' | 'right';

interface StripProps {
    edge: Edge;
    beads: Bead[];
    width: number;
    height: number;
    band: number;
}

/** One edge's beads in a band-deep Svg along that edge. */
const BeadStrip = memo(({ edge, beads, width, height, band }: StripProps) => {
    const gradient = useGradientId('bead');
    const horizontal = edge === 'top' || edge === 'bottom';
    const w = horizontal ? width : band;
    const h = horizontal ? band : height;
    const pos = (b: Bead) => {
        switch (edge) {
            case 'top':    return { x: b.along, y: b.across };
            case 'bottom': return { x: b.along, y: band - b.across };
            case 'left':   return { x: b.across, y: b.along };
            case 'right':  return { x: band - b.across, y: b.along };
        }
    };
    return (
        <Svg width={w} height={h}>
            <Defs>
                <BeadGradient id={gradient} />
            </Defs>
            {beads.map((b, i) => {
                const p = pos(b);
                return <BeadShape key={i} x={p.x} y={p.y} r={b.r} o={b.o} gradient={gradient} />;
            })}
        </Svg>
    );
});
BeadStrip.displayName = 'BeadStrip';

/** A pinprick inside the card, in its own few-point Svg. */
const InteriorBead = memo(({ r, o }: { r: number; o: number }) => {
    const gradient = useGradientId('pin');
    const s = Math.ceil(r * 2 + 2);
    return (
        <Svg width={s} height={s}>
            <Defs>
                <BeadGradient id={gradient} />
            </Defs>
            <BeadShape x={s / 2} y={s / 2} r={r} o={o} gradient={gradient} />
        </Svg>
    );
});
InteriorBead.displayName = 'InteriorBead';

interface RunnerProps {
    runner: BorderRunner;
    height: number;
    animate: boolean;
}

/** Tiny step for a hard cut inside an interpolation. */
const CUT = 1e-4;

/**
 * A bead on the top border that swells as it gathers water, lets go, and runs
 * straight down the face at one steady speed, leaving a wet trail that dries
 * after it's gone; then a new bead forms in its place on the edge.
 *
 * While nothing moves (Reduce Motion, other tabs) it's simply a bead on the
 * edge, like its neighbours.
 */
const RunnerDrop = ({ runner, height, animate }: RunnerProps) => {
    const progress = useRef(new Animated.Value(0)).current;
    const gradient = useGradientId('run');
    const tl = runnerTimeline(height, runner);

    useEffect(() => {
        progress.setValue(0);
        if (!animate) return;
        const loop = nativeLoop(progress, tl.cycleMs);
        const timer = setTimeout(() => loop.start(), runner.delayMs);
        return () => {
            clearTimeout(timer);
            loop.stop();
        };
    }, [animate, progress, tl.cycleMs, runner.delayMs]);

    const anim = useMemo(() => {
        const { restEnd, swellEnd, runEnd, dryEnd, distance } = tl;
        return {
            // Sits, swells, runs linearly (one speed), then is back on the edge.
            translateY: progress.interpolate({
                inputRange: [0, swellEnd, runEnd, runEnd + CUT, 1],
                outputRange: [0, 0, distance, 0, 0],
            }),
            scale: progress.interpolate({
                inputRange: [0, restEnd, swellEnd, runEnd, runEnd + CUT, dryEnd, 1],
                outputRange: [1, 1, SWELL_SCALE, SWELL_SCALE, 0.3, 0.3, 1],
            }),
            opacity: progress.interpolate({
                inputRange: [0, runEnd, runEnd + CUT, dryEnd, 1],
                outputRange: [1, 1, 0, 0, 1],
            }),
            // The trail is the path the drop has run so far, then dries away.
            trailScale: progress.interpolate({
                inputRange: [0, swellEnd, runEnd, dryEnd, dryEnd + CUT, 1],
                outputRange: [0, 0, 1, 1, 0, 0],
            }),
            trailOpacity: progress.interpolate({
                inputRange: [0, swellEnd, swellEnd + CUT, runEnd, dryEnd, 1],
                outputRange: [0, 0, 1, 1, 0, 0],
            }),
        };
    }, [progress, tl]);

    const s = Math.ceil(runner.r * 2 * SWELL_SCALE + 4);
    const trailW = Math.max(1.2, runner.r * 0.7);
    const bead = (
        <Svg width={s} height={s}>
            <Defs>
                <BeadGradient id={gradient} />
            </Defs>
            <BeadShape x={s / 2} y={s / 2} r={runner.r} o={1} gradient={gradient} />
        </Svg>
    );

    if (!animate) {
        return <View style={[styles.runner, { left: runner.x - s / 2, top: runner.y - s / 2 }]}>{bead}</View>;
    }
    return (
        <>
            <Animated.View
                pointerEvents='none'
                style={[
                    styles.runner,
                    {
                        left: runner.x - trailW / 2,
                        top: runner.y,
                        width: trailW,
                        height: tl.distance,
                        opacity: anim.trailOpacity,
                        transformOrigin: 'top',
                        transform: [{ scaleY: anim.trailScale }],
                    },
                ]}
            >
                {/* Faint where the drop started, wetter just behind it. */}
                <LinearGradient
                    colors={['rgba(255,255,255,0.03)', 'rgba(255,255,255,0.13)']}
                    style={[StyleSheet.absoluteFill, { borderRadius: trailW / 2 }]}
                />
            </Animated.View>
            <Animated.View
                pointerEvents='none'
                style={[
                    styles.runner,
                    {
                        left: runner.x - s / 2,
                        top: runner.y - s / 2,
                        opacity: anim.opacity,
                        transform: [{ translateY: anim.translateY }, { scale: anim.scale }],
                    },
                ]}
                // Static art, moving wrapper, as RainLayer does.
                shouldRasterizeIOS
                renderToHardwareTextureAndroid
            >
                {bead}
            </Animated.View>
        </>
    );
};

interface FreshProps {
    edge: 'left' | 'right';
    beads: Bead[];
    height: number;
    band: number;
    progress: Animated.Value;
}

/** Beads that come and go, as new drops land and others run off. */
const FreshStrip = ({ edge, beads, height, band, progress }: FreshProps) => {
    const opacity = useMemo(() => progress.interpolate(FRESH_FADE), [progress]);
    return (
        <Animated.View
            pointerEvents='none'
            style={[styles.side, edge === 'left' ? styles.leftEdge : styles.rightEdge, { top: band, height, opacity }]}
        >
            <BeadStrip edge={edge} beads={beads} width={band} height={height} band={band} />
        </Animated.View>
    );
};

interface RainBeadsProps {
    density: RainDensity;
    width: number;
    height: number;
    animate: boolean;
}

function RainBeads({ density, width, height, animate }: RainBeadsProps) {
    const spec = BEAD_SPECS[density];
    const band = GLASS_BAND;
    const sideLength = Math.max(0, height - band * 2);

    const art = useMemo(() => {
        const top = stripBeads(width, band, spec, SEED.top);
        const runners = borderRunners(top, width, band, spec.runners, SEED.runners);
        // The beads that run are drawn by their runners, not the strip.
        const running = new Set(runners.map((r) => r.bead));
        return {
            top: top.filter((_, i) => !running.has(i)),
            bottom: stripBeads(width, band, spec, SEED.bottom),
            left: stripBeads(sideLength, band, spec, SEED.left),
            right: stripBeads(sideLength, band, spec, SEED.right),
            interior: interiorBeads(width, height, band, spec, SEED.interior),
            freshLeft: stripBeads(sideLength, band, spec, SEED.freshL, FRESH_SPARSENESS),
            freshRight: stripBeads(sideLength, band, spec, SEED.freshR, FRESH_SPARSENESS),
            runners,
        };
    }, [width, height, sideLength, band, spec]);

    // One loop drives both fresh strips.
    const fresh = useRef(new Animated.Value(0)).current;
    useEffect(() => {
        fresh.setValue(0.5);
        if (!animate) return;
        const loop = nativeLoop(fresh, FRESH_MS);
        loop.start();
        return () => loop.stop();
    }, [animate, fresh]);

    return (
        <View style={StyleSheet.absoluteFill} pointerEvents='none'>
            <View style={[styles.horizontal, styles.topEdge, { height: band }]}>
                <BeadStrip edge='top' beads={art.top} width={width} height={band} band={band} />
            </View>
            <View style={[styles.horizontal, styles.bottomEdge, { height: band }]}>
                <BeadStrip edge='bottom' beads={art.bottom} width={width} height={band} band={band} />
            </View>
            <View style={[styles.side, styles.leftEdge, { top: band, height: sideLength }]}>
                <BeadStrip edge='left' beads={art.left} width={band} height={sideLength} band={band} />
            </View>
            <View style={[styles.side, styles.rightEdge, { top: band, height: sideLength }]}>
                <BeadStrip edge='right' beads={art.right} width={band} height={sideLength} band={band} />
            </View>

            {art.interior.map((b, i) => {
                const s = Math.ceil(b.r * 2 + 2);
                return (
                    <View key={i} style={[styles.pin, { left: b.x - s / 2, top: b.y - s / 2 }]}>
                        <InteriorBead r={b.r} o={b.o} />
                    </View>
                );
            })}

            <FreshStrip edge='left' beads={art.freshLeft} height={sideLength} band={band} progress={fresh} />
            <FreshStrip edge='right' beads={art.freshRight} height={sideLength} band={band} progress={fresh} />

            {art.runners.map((r, i) => (
                <RunnerDrop key={i} runner={r} height={height} animate={animate} />
            ))}
        </View>
    );
}

export default memo(RainBeads);

const styles = StyleSheet.create({
    horizontal: { position: 'absolute', left: 0, right: 0 },
    topEdge: { top: 0 },
    bottomEdge: { bottom: 0 },
    side: { position: 'absolute', width: GLASS_BAND },
    leftEdge: { left: 0 },
    rightEdge: { right: 0 },
    pin: { position: 'absolute' },
    runner: { position: 'absolute' },
});
