/**
 * RainEdgeSplash — rain hitting the outfit card's top edge: a drop streaks
 * down, splats flat where it lands, and a few droplets arc up and fall back
 * onto the card.
 *
 * Only for steady rain and storms (edgeSplashes): drizzle and light rain don't
 * splash. Unlike the beads, which sit behind the card's glass, it's in front.
 *
 * Lives outside the card (WeatherHUD lays it over the card's top edge), since
 * the card clips its children and a splash rises above it. Plain views, no Svg.
 *
 * Each splash point is one native loop. It hits SPLASH_HITS times per loop,
 * each time somewhere new along its stretch of the edge: the x is held per
 * hit and cut while nothing is showing, so no JavaScript runs to move it. One
 * loop drives the point's streak, crown and droplets through interpolations.
 */

import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, StyleSheet, View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';
import { nativeLoop } from '../../lib/animation/nativeLoop';
import {
    BEAD_SPECS,
    SPLASH_HITS,
    holdPerHit,
    repeatKeys,
    splashEmitters,
    type Key,
    type RainDensity,
    type SplashDroplet,
    type SplashEmitter,
} from '../../lib/weather/weatherGlass';

/** Room above the card's edge for droplets to rise into. */
export const SPLASH_RISE = 34;
/** How far below the edge the layer reaches, for droplets landing on the card. */
const BELOW = 10;
const SEED = 1301;

// Within one hit (0–1): the streak falls in 0–0.08, lands at 0.08, the crown
// spreads to 0.3 and droplets fly until 0.5. The rest of the hit is a pause.
const LAND = 0.08;
const DROPLET_END = 0.5;

const STREAK_Y: readonly Key[] = [[0, -26], [LAND, -3], [LAND + 0.02, -3]];
const STREAK_O: readonly Key[] = [[0, 0], [0.015, 0.6], [LAND, 0.6], [LAND + 0.02, 0]];
// The splat: the drop flattens on impact and spreads thin along the edge.
const CROWN_SX: readonly Key[] = [[0, 0.3], [LAND, 0.3], [0.16, 1.3], [0.26, 1.8]];
const CROWN_O: readonly Key[] = [[0, 0], [LAND, 0], [LAND + 0.01, 0.6], [0.26, 0]];

/** A droplet's flight: out sideways, up and back down a little past the edge. */
function dropletKeys(d: SplashDroplet) {
    const xs: Key[] = [[0, 0], [LAND + 0.01, 0]];
    const ys: Key[] = [[0, 0], [LAND + 0.01, 0]];
    const steps = 6;
    for (let i = 1; i <= steps; i++) {
        const u = i / steps;
        const t = LAND + 0.01 + (DROPLET_END - LAND - 0.01) * u;
        xs.push([t, d.dx * u]);
        // A parabola peaking at `rise`, landing ~5 pt below the edge, on the card.
        ys.push([t, -4 * d.rise * u * (1 - u) + 5 * u * u]);
    }
    const os: Key[] = [[0, 0], [LAND + 0.005, 0], [LAND + 0.02, 0.85], [DROPLET_END - 0.06, 0.6], [DROPLET_END, 0]];
    return { xs, ys, os };
}

const Droplet = ({ d, progress }: { d: SplashDroplet; progress: Animated.Value }) => {
    const anim = useMemo(() => {
        const { xs, ys, os } = dropletKeys(d);
        return {
            translateX: progress.interpolate(repeatKeys(SPLASH_HITS, xs)),
            translateY: progress.interpolate(repeatKeys(SPLASH_HITS, ys)),
            opacity: progress.interpolate(repeatKeys(SPLASH_HITS, os)),
        };
    }, [d, progress]);
    return (
        <Animated.View
            style={[
                styles.droplet,
                {
                    width: d.size,
                    height: d.size,
                    borderRadius: d.size / 2,
                    left: -d.size / 2,
                    top: -d.size / 2,
                    opacity: anim.opacity,
                    transform: [{ translateX: anim.translateX }, { translateY: anim.translateY }],
                },
            ]}
        />
    );
};

const Emitter = memo(({ emitter, animate }: { emitter: SplashEmitter; animate: boolean }) => {
    const progress = useRef(new Animated.Value(0)).current;
    useEffect(() => {
        // Parked between hits, so a still frame shows nothing mid-splash.
        progress.setValue(0.9 / SPLASH_HITS);
        if (!animate) return;
        progress.setValue(0);
        const loop = nativeLoop(progress, emitter.cycleMs);
        const timer = setTimeout(() => loop.start(), emitter.delayMs);
        return () => {
            clearTimeout(timer);
            loop.stop();
        };
    }, [animate, progress, emitter.cycleMs, emitter.delayMs]);

    const anim = useMemo(
        () => ({
            x: progress.interpolate(holdPerHit(emitter.hits)),
            streakY: progress.interpolate(repeatKeys(SPLASH_HITS, STREAK_Y)),
            streakO: progress.interpolate(repeatKeys(SPLASH_HITS, STREAK_O)),
            crownSX: progress.interpolate(repeatKeys(SPLASH_HITS, CROWN_SX)),
            crownO: progress.interpolate(repeatKeys(SPLASH_HITS, CROWN_O)),
        }),
        [progress, emitter.hits],
    );

    return (
        <Animated.View style={[styles.emitter, { transform: [{ translateX: anim.x }] }]} pointerEvents='none'>
            <Animated.View style={[styles.streak, { opacity: anim.streakO, transform: [{ translateY: anim.streakY }] }]} />
            <Animated.View style={[styles.crown, { opacity: anim.crownO, transform: [{ scaleX: anim.crownSX }] }]} />
            {emitter.droplets.map((d, i) => (
                <Droplet key={i} d={d} progress={progress} />
            ))}
        </Animated.View>
    );
});
Emitter.displayName = 'Emitter';

interface Props {
    density: RainDensity;
    animate: boolean;
    /** Positions the layer: its top edge sits SPLASH_RISE above the card's. */
    style?: StyleProp<ViewStyle>;
}

function RainEdgeSplash({ density, animate, style }: Props) {
    const [width, setWidth] = useState(0);
    const onLayout = useCallback((e: LayoutChangeEvent) => {
        const w = Math.round(e.nativeEvent.layout.width);
        setWidth((prev) => (prev === w ? prev : w));
    }, []);
    const emitters = useMemo(
        () => (width > 0 ? splashEmitters(width, BEAD_SPECS[density], SEED) : []),
        [width, density],
    );
    // Still frames (Reduce Motion, other tabs) show no splashes at all: a frozen
    // splash reads as a smudge, not rain.
    return (
        <View style={[styles.layer, style]} pointerEvents='none' onLayout={onLayout}>
            {animate && emitters.map((e, i) => <Emitter key={i} emitter={e} animate={animate} />)}
        </View>
    );
}

export default memo(RainEdgeSplash);

const styles = StyleSheet.create({
    layer: { position: 'absolute', height: SPLASH_RISE + BELOW },
    // The emitter's origin is the landing point, on the card's top edge.
    emitter: { position: 'absolute', left: 0, top: SPLASH_RISE, width: 0, height: 0 },
    streak: {
        position: 'absolute',
        left: -0.6,
        top: -14,
        width: 1.2,
        height: 14,
        borderRadius: 0.6,
        backgroundColor: 'rgba(255,255,255,0.75)',
    },
    crown: {
        position: 'absolute',
        left: -6,
        top: -1.5,
        width: 12,
        height: 2.5,
        borderRadius: 1.25,
        backgroundColor: 'rgba(255,255,255,0.7)',
    },
    droplet: { position: 'absolute', backgroundColor: 'rgba(255,255,255,0.8)' },
});
