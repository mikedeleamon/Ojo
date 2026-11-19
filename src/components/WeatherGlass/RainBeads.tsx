/**
 * RainBeads — water beaded all over the outfit card's glass: heavier along the
 * edges where it collects, scattered across the face, and now and then a bead
 * on the top border that grows heavy and runs down the face.
 *
 * Built for the perf notes in StormIconLightning and SunGlare:
 *   - Static beads live in four thin edge strips plus one tiny Svg per bead on
 *     the face, never one card-sized Svg. The outfit card can be 1,200 pt tall,
 *     and a canvas that size would be a 12 MB backing store for some dots.
 *   - Motion is static Svgs moved on the native driver: two "fresh beads"
 *     strips fading in and out on the sides as drops land, on one loop, and a
 *     running drop per lane (RunningLane), each run one timing. A run's art is
 *     a column a few points wide, never the card's width. The bead count costs
 *     nothing per frame.
 *
 * Rain hitting the card's top edge is RainEdgeSplash, outside the card, since
 * the card clips everything inside it. Geometry is in lib/weather/weatherGlass.
 */

import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient as SvgGradient, Path, Stop } from 'react-native-svg';
import { nativeLoop, pingPong } from '../../lib/animation/nativeLoop';
import {
    BEAD_SPECS,
    GLASS_BAND,
    TEAR_MAX,
    interiorBeads,
    planRun,
    runBucket,
    runKeyframes,
    runLanes,
    stripBeads,
    type Bead,
    type InteriorBead as InteriorBeadSpec,
    type RainDensity,
    type RunKeys,
    type RunLane,
    type RunSpot,
    type TrailStretch,
} from '../../lib/weather/weatherGlass';
import { BeadGradient, BeadShape, BeadUpperRim, TearTail, useGradientId } from './beadArt';

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

/** A resting bead at one of a lane's starting spots. */
const SpotBead = memo(({ spot }: { spot: RunSpot }) => {
    const s = Math.ceil(spot.r * 2 + 2);
    return (
        <View style={[styles.pin, { left: spot.x - s / 2, top: spot.y - s / 2 }]}>
            <InteriorBead r={spot.r} o={1} />
        </View>
    );
});
SpotBead.displayName = 'SpotBead';

/**
 * The running drop's art is drawn this much bigger than the bead at rest and
 * scaled down, so it stays sharp as it swells and swallows other beads (a
 * small bitmap scaled up goes soft).
 */
const ART = 1.6;
/** The trail's half-width as a share of the drop's radius, and its opacity where it's wettest. */
const TRAIL_HALF = 0.36;
const TRAIL_OPACITY = 0.15;

interface StretchProps {
    stretch: TrailStretch;
    /** The trail's outline for this stretch, in the stretch's own coordinates. */
    d: string;
    width: number;
    progress: Animated.Value;
}

/** One stretch of the wet trail. It dries on its own clock, so the trail dries from the top. */
const Stretch = ({ stretch, d, width, progress }: StretchProps) => {
    const gradient = useGradientId('wet');
    const opacity = useMemo(() => progress.interpolate(stretch.opacity), [progress, stretch]);
    // Half a point over, so neighbours leave no hairline between them.
    const h = stretch.to - stretch.from + 0.5;
    return (
        <Animated.View pointerEvents='none' style={[styles.runner, { top: stretch.from, left: 0, opacity }]}>
            <Svg width={width} height={h}>
                <Defs>
                    <SvgGradient id={gradient} gradientUnits='userSpaceOnUse' x1={0} y1={0} x2={0} y2={h}>
                        <Stop offset='0' stopColor='#ffffff' stopOpacity={TRAIL_OPACITY * (1 - stretch.lead)} />
                        <Stop offset='1' stopColor='#ffffff' stopOpacity={TRAIL_OPACITY} />
                    </SvgGradient>
                </Defs>
                <Path d={d} fill={`url(#${gradient})`} />
            </Svg>
        </Animated.View>
    );
};

const n1 = (v: number) => Math.round(v * 10) / 10;

/** The trail's outline as one closed path, shifted up by `top` and left by `left`. */
function trailOutline(trail: RunKeys['trail'], left: number, top: number, from: number, to: number): string {
    // Only the part near this stretch; the Svg clips the rest.
    const pts = trail.filter((p) => p.d >= from - 24 && p.d <= to + 24);
    if (pts.length < 2) return '';
    // Narrow where it leaves the bead, full width a few points on.
    const half = (p: { d: number; r: number }) => Math.max(0.5, p.r * TRAIL_HALF * Math.min(1, 0.25 + p.d / 10));
    const down = pts.map((p) => `${n1(p.x - left - half(p))} ${n1(p.d - top)}`);
    const up = pts.map((p) => `${n1(p.x - left + half(p))} ${n1(p.d - top)}`).reverse();
    return `M${down.join('L')}L${up.join('L')}Z`;
}

interface LaneProps {
    lane: RunLane;
    index: number;
    /** How many runs this lane has finished. */
    run: number;
    /** The card height runs are planned for (runBucket). */
    bucket: number;
    /** The beads on the card's face, for that height. */
    interior: readonly InteriorBeadSpec[];
    animate: boolean;
    onDone: (index: number) => void;
}

/**
 * One lane of the card: its starting beads on the top border and, one at a
 * time, the drop that runs from them. See "Running drops" in
 * lib/weather/weatherGlass for what a run is.
 *
 * A run is a single 0→1 timing on the native driver; everything that moves is
 * an interpolation of it. JavaScript is only involved between runs, to plan
 * the next one from the next bead.
 *
 * While nothing moves (Reduce Motion, other tabs) the spots are simply beads on
 * the edge, like their neighbours.
 */
const RunningLane = memo(({ lane, index, run, bucket, interior, animate, onDone }: LaneProps) => {
    const progress = useRef(new Animated.Value(0)).current;
    const gradient = useGradientId('run');
    const plan = useMemo(
        () => planRun(lane, index, run, bucket, interior, SEED.runners),
        [lane, index, run, bucket, interior],
    );
    // Only its first run waits; after that the rest at the top of each run is the gap.
    const delayMs = run === 0 ? lane.delayMs : 0;

    useEffect(() => {
        progress.setValue(0);
        if (!animate) return;
        let alive = true;
        const timing = Animated.timing(progress, {
            toValue: 1,
            duration: plan.cycleMs,
            easing: Easing.linear,
            useNativeDriver: true,
            isInteraction: false,
        });
        const timer = setTimeout(
            () => timing.start(({ finished }) => { if (finished && alive) onDone(index); }),
            delayMs,
        );
        return () => {
            alive = false;
            clearTimeout(timer);
            timing.stop();
        };
    }, [animate, progress, plan, delayMs, index, onDone]);

    const view = useMemo(() => {
        const keys = runKeyframes(plan);
        const maxR = Math.max(...plan.samples.map((p) => p.r));
        const xs = [...plan.samples.map((p) => p.x), ...plan.eaten.map((b) => b.x), ...plan.crumbs.map((c) => c.x)];
        const left = Math.floor(Math.min(...xs) - maxR - 4);
        const width = Math.ceil(Math.max(...xs) + maxR + 4) - left;
        const scaled = (k: { inputRange: number[]; outputRange: number[] }, f: (v: number) => number) =>
            progress.interpolate({ inputRange: k.inputRange, outputRange: k.outputRange.map(f) });
        const L = keys.trailLength;
        return {
            keys,
            left,
            width,
            outlines: keys.stretches.map((s) => trailOutline(keys.trail, left, s.from, s.from, s.to)),
            drop: {
                opacity: progress.interpolate(keys.opacity),
                transform: [
                    { translateX: progress.interpolate(keys.dx) },
                    { translateY: progress.interpolate(keys.dy) },
                    { scale: scaled(keys.scale, (v) => v / ART) },
                    { scaleY: progress.interpolate(keys.stretch) },
                ],
            },
            rimOpacity: progress.interpolate(keys.rimOpacity),
            tail: { opacity: progress.interpolate(keys.tailOpacity), transform: [{ scaleY: progress.interpolate(keys.tail) }] },
            // The window comes down with the drop while its contents are pushed
            // back up by as much, so they stay where they are on the card.
            revealWindow: scaled(keys.reveal, (v) => v - L),
            revealHold: scaled(keys.reveal, (v) => L - v),
            crumbsOpacity: progress.interpolate(keys.crumbsOpacity),
            eatWindow: progress.interpolate(keys.eat),
            eatHold: scaled(keys.eat, (v) => -v),
            eatOpacity: progress.interpolate(keys.eatOpacity),
        };
    }, [plan, progress]);

    if (!animate) {
        return <>{lane.spots.map((spot) => <SpotBead key={spot.bead} spot={spot} />)}</>;
    }

    const { spot } = plan;
    const { keys, left, width } = view;
    const a = spot.r * ART;
    const box = Math.ceil(a * 2 + 4);
    const tailW = a * 2 + 2;
    const tailH = TEAR_MAX * a;
    const rimWidth = 0.5 * ART;
    return (
        <>
            {lane.spots.map((other) => (other === spot ? null : <SpotBead key={other.bead} spot={other} />))}

            {/* The beads it swallows: gone as its head reaches each, back later. */}
            {plan.eaten.length > 0 && (
                <Animated.View
                    pointerEvents='none'
                    style={[
                        styles.window,
                        { left, top: keys.eatTop, width, height: keys.eatLength, opacity: view.eatOpacity, transform: [{ translateY: view.eatWindow }] },
                    ]}
                >
                    <Animated.View style={{ transform: [{ translateY: view.eatHold }] }}>
                        <Svg width={width} height={keys.eatLength}>
                            <Defs>
                                <BeadGradient id={`${gradient}e`} />
                            </Defs>
                            {plan.eaten.map((b) => (
                                <BeadShape key={b.bead} x={b.x - left} y={b.y - keys.eatTop} r={b.r} o={b.o} gradient={`${gradient}e`} />
                            ))}
                        </Svg>
                    </Animated.View>
                </Animated.View>
            )}

            {/* The wet trail and the beads left on it, appearing behind the drop. */}
            <Animated.View
                pointerEvents='none'
                style={[
                    styles.window,
                    { left, top: keys.trailTop, width, height: keys.trailLength, transform: [{ translateY: view.revealWindow }] },
                ]}
            >
                <Animated.View style={{ width, height: keys.trailLength, transform: [{ translateY: view.revealHold }] }}>
                    {keys.stretches.map((s, i) => (
                        <Stretch key={i} stretch={s} d={view.outlines[i]} width={width} progress={progress} />
                    ))}
                    {plan.crumbs.length > 0 && (
                        <Animated.View style={[styles.runner, { top: 0, left: 0, opacity: view.crumbsOpacity }]}>
                            <Svg width={width} height={keys.trailLength}>
                                <Defs>
                                    <BeadGradient id={`${gradient}c`} />
                                </Defs>
                                {plan.crumbs.map((c, i) => (
                                    <BeadShape key={i} x={c.x - left} y={c.y - keys.trailTop} r={c.r} o={0.9} gradient={`${gradient}c`} />
                                ))}
                            </Svg>
                        </Animated.View>
                    )}
                </Animated.View>
            </Animated.View>

            {/* The drop: a bead on the edge, then a teardrop on the way down. */}
            <Animated.View
                pointerEvents='none'
                style={[styles.runner, { left: spot.x - box / 2, top: spot.y - box / 2, width: box, height: box }, view.drop]}
            >
                <Animated.View
                    style={[
                        styles.runner,
                        { left: box / 2 - tailW / 2, top: box / 2 - tailH, width: tailW, height: tailH, transformOrigin: 'bottom' },
                        view.tail,
                    ]}
                >
                    <Svg width={tailW} height={tailH}>
                        <TearTail x={tailW / 2} bottom={tailH} r={a} length={tailH} rimWidth={rimWidth} />
                    </Svg>
                </Animated.View>
                <Svg width={box} height={box}>
                    <Defs>
                        <BeadGradient id={gradient} />
                    </Defs>
                    <BeadShape x={box / 2} y={box / 2} r={a} o={1} gradient={gradient} rim='lower' rimWidth={rimWidth} />
                </Svg>
                <Animated.View style={[StyleSheet.absoluteFill, { opacity: view.rimOpacity }]}>
                    <Svg width={box} height={box}>
                        <BeadUpperRim x={box / 2} y={box / 2} r={a} rimWidth={rimWidth} />
                    </Svg>
                </Animated.View>
            </Animated.View>
        </>
    );
});
RunningLane.displayName = 'RunningLane';

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
    const bucket = runBucket(height);

    // The top border and its lanes depend on the width alone, and the runs are
    // planned against the card's bucketed height: a card that grows by a row
    // must not hand a lane new inputs, which would restart its drop.
    const edge = useMemo(() => {
        const top = stripBeads(width, band, spec, SEED.top);
        const lanes = runLanes(top, width, band, spec.runners, SEED.runners);
        // The beads drops start from are drawn by their lanes, not the strip.
        const spots = new Set(lanes.flatMap((l) => l.spots.map((s) => s.bead)));
        return { top: top.filter((_, i) => !spots.has(i)), lanes };
    }, [width, band, spec]);
    const planInterior = useMemo(
        () => interiorBeads(width, bucket, band, spec, SEED.interior),
        [width, bucket, band, spec],
    );

    const art = useMemo(
        () => ({
            bottom: stripBeads(width, band, spec, SEED.bottom),
            left: stripBeads(sideLength, band, spec, SEED.left),
            right: stripBeads(sideLength, band, spec, SEED.right),
            // The same walk as planInterior, stopped at the card's real height,
            // so a bead has the same index in both.
            interior: interiorBeads(width, height, band, spec, SEED.interior),
            freshLeft: stripBeads(sideLength, band, spec, SEED.freshL, FRESH_SPARSENESS),
            freshRight: stripBeads(sideLength, band, spec, SEED.freshR, FRESH_SPARSENESS),
        }),
        [width, height, sideLength, band, spec],
    );

    // Runs finished per lane. Each lane bumps its own count when its run ends,
    // which plans its next one: the only JavaScript the drops need.
    const [runs, setRuns] = useState<number[]>([]);
    const onRunDone = useCallback((index: number) => {
        setRuns((prev) => {
            const next = prev.slice();
            next[index] = (prev[index] ?? 0) + 1;
            return next;
        });
    }, []);

    // Beads a drop swallows on its current run are drawn by its lane.
    const swallowed = useMemo(() => {
        const out = new Set<number>();
        if (!animate) return out;
        edge.lanes.forEach((lane, n) => {
            for (const b of planRun(lane, n, runs[n] ?? 0, bucket, planInterior, SEED.runners).eaten) out.add(b.bead);
        });
        return out;
    }, [animate, edge.lanes, runs, bucket, planInterior]);

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
                <BeadStrip edge='top' beads={edge.top} width={width} height={band} band={band} />
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
                if (swallowed.has(i)) return null;
                const s = Math.ceil(b.r * 2 + 2);
                return (
                    <View key={i} style={[styles.pin, { left: b.x - s / 2, top: b.y - s / 2 }]}>
                        <InteriorBead r={b.r} o={b.o} />
                    </View>
                );
            })}

            <FreshStrip edge='left' beads={art.freshLeft} height={sideLength} band={band} progress={fresh} />
            <FreshStrip edge='right' beads={art.freshRight} height={sideLength} band={band} progress={fresh} />

            {edge.lanes.map((lane, n) => (
                <RunningLane
                    key={n}
                    lane={lane}
                    index={n}
                    run={runs[n] ?? 0}
                    bucket={bucket}
                    interior={planInterior}
                    animate={animate}
                    onDone={onRunDone}
                />
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
    // A clipping window that slides over art held still inside it.
    window: { position: 'absolute', overflow: 'hidden' },
});
