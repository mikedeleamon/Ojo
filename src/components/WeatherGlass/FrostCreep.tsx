/**
 * FrostCreep — ice crystals growing in from the outfit card's corners on a
 * freezing day.
 *
 * Each corner is its own small Svg (art drawn for the top-left corner, mirrored
 * for the others), so the frost costs four corner-sized canvases, not a
 * card-sized one. On arrival every corner grows out of its corner once, staggered,
 * in one native timing each; after that the crystals hold still and only their
 * tips glint, one shared native loop for all of them.
 *
 * Harder freezes reach further and frost more of the card. Every level frosts
 * up the sides from the bottom (SIDE_SHARE), each side one more small canvas:
 *   1 (32–21°F): the two bottom corners, where cold glass frosts first
 *   2 (20–6°F):  all four, the top two kept small
 *   3 (5°F and below): all four, the bottom two in full, with a rim of
 *      crystals along the top and bottom edges
 * The top corners never reach far: the card's badge and headline sit there.
 *
 * Geometry is in lib/weather/weatherGlass.
 */

import { memo, useEffect, useId, useMemo, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, G, LinearGradient, Mask, Path, RadialGradient, Rect, Stop } from 'react-native-svg';
import { nativeLoop, pingPong } from '../../lib/animation/nativeLoop';
import {
    FROST_REACH,
    frostCorner,
    frostEdge,
    transposeArt,
    type FrostArt,
    type FrostLevel,
} from '../../lib/weather/weatherGlass';

type CornerKey = 'tl' | 'tr' | 'bl' | 'br';

interface CornerDef {
    key: CornerKey;
    flipX: boolean;
    flipY: boolean;
    origin: string;
    seed: number;
}

const CORNERS: Record<CornerKey, CornerDef> = {
    bl: { key: 'bl', flipX: false, flipY: true, origin: 'left bottom', seed: 1201 },
    br: { key: 'br', flipX: true, flipY: true, origin: 'right bottom', seed: 1307 },
    tl: { key: 'tl', flipX: false, flipY: false, origin: 'left top', seed: 1409 },
    tr: { key: 'tr', flipX: true, flipY: false, origin: 'right top', seed: 1511 },
};

/** Which corners frost, and how far each reaches relative to the level's reach. */
/**
 * Which corners frost, and how far each reaches relative to the level's reach.
 * The top corners stay small: the outfit card's closet badge, score and
 * headline sit there, and frost over them would cost the words.
 */
const LAYOUT: Record<FrostLevel, { key: CornerKey; scale: number }[]> = {
    1: [{ key: 'bl', scale: 1 }, { key: 'br', scale: 0.85 }],
    2: [{ key: 'bl', scale: 1 }, { key: 'br', scale: 1 }, { key: 'tl', scale: 0.5 }, { key: 'tr', scale: 0.45 }],
    3: [{ key: 'bl', scale: 1 }, { key: 'br', scale: 1 }, { key: 'tl', scale: 0.65 }, { key: 'tr', scale: 0.6 }],
};

const GROW_MS = 2800;
const GROW_STAGGER_MS = 260;
const GLINT_MS = 4200;
const GLINT = pingPong(0.25, 1);

/** Stroke per depth: spines, branches, twigs. */
const STROKES = [
    { width: 0.9, opacity: 0.5 },
    { width: 0.6, opacity: 0.4 },
    { width: 0.45, opacity: 0.3 },
] as const;

const useGradientId = (prefix: string) => `${prefix}${useId().replace(/[^a-zA-Z0-9]/g, '')}`;

/**
 * The crystals and specks, plus a frosted haze pooled in the corner they grow
 * from. A radial mask thins everything out with distance from the corner, so
 * the frost feathers away instead of ending in hard tips.
 */
const FrostArtSvg = ({ art, haze }: { art: FrostArt; haze: number }) => {
    const gradient = useGradientId('frost');
    const fade = useGradientId('fade');
    const mask = useGradientId('mask');
    return (
        <Svg width={art.size} height={art.size}>
            <Defs>
                <RadialGradient id={gradient} cx='0' cy='0' r='1' gradientUnits='objectBoundingBox'>
                    <Stop offset='0' stopColor='#ffffff' stopOpacity={haze} />
                    <Stop offset='0.55' stopColor='#ffffff' stopOpacity={haze * 0.35} />
                    <Stop offset='1' stopColor='#ffffff' stopOpacity={0} />
                </RadialGradient>
                <RadialGradient id={fade} cx='0' cy='0' r='1' gradientUnits='objectBoundingBox'>
                    <Stop offset='0' stopColor='#ffffff' stopOpacity={1} />
                    <Stop offset='0.45' stopColor='#ffffff' stopOpacity={0.85} />
                    <Stop offset='0.9' stopColor='#ffffff' stopOpacity={0} />
                </RadialGradient>
                <Mask id={mask} x={0} y={0} width={art.size} height={art.size} maskUnits='userSpaceOnUse'>
                    <Rect x={0} y={0} width={art.size} height={art.size} fill={`url(#${fade})`} />
                </Mask>
            </Defs>
            <Rect x={0} y={0} width={art.size} height={art.size} fill={`url(#${gradient})`} />
            <G mask={`url(#${mask})`}>
                {art.specks ? (
                    <Path d={art.specks} fill='none' stroke='#f4fbff' strokeOpacity={0.45} strokeWidth={0.45} strokeLinecap='round' />
                ) : null}
                {art.paths.map((d, depth) =>
                    d ? (
                        <Path
                            key={depth}
                            d={d}
                            fill='none'
                            stroke='#f4fbff'
                            strokeOpacity={STROKES[depth].opacity}
                            strokeWidth={STROKES[depth].width}
                            strokeLinecap='round'
                            strokeLinejoin='round'
                        />
                    ) : null,
                )}
            </G>
        </Svg>
    );
};

/** The tips that catch the light: a dot and a tiny four-point star. */
const SparkleSvg = ({ art }: { art: FrostArt }) => (
    <Svg width={art.size} height={art.size}>
        {art.sparkles.map((p, i) => (
            <G key={i}>
                <Circle cx={p.x} cy={p.y} r={p.s * 0.55} fill='#ffffff' fillOpacity={0.9} />
                {p.s > 1.2 && (
                    <Path
                        d={`M${p.x - p.s * 2.2} ${p.y}L${p.x + p.s * 2.2} ${p.y}M${p.x} ${p.y - p.s * 2.2}L${p.x} ${p.y + p.s * 2.2}`}
                        stroke='#ffffff'
                        strokeOpacity={0.55}
                        strokeWidth={0.5}
                        strokeLinecap='round'
                    />
                )}
            </G>
        ))}
    </Svg>
);

interface CornerProps {
    def: CornerDef;
    art: FrostArt;
    haze: number;
    width: number;
    height: number;
    order: number;
    animate: boolean;
    glint: Animated.Value;
}

/**
 * Frost grows in once per mount, staggered by `order`; it starts grown when
 * there's no motion to show. Returns the scale and opacity it grows through.
 */
function useGrowIn(animate: boolean, order: number) {
    const grow = useRef(new Animated.Value(animate ? 0 : 1)).current;
    const grown = useRef(!animate);
    useEffect(() => {
        if (grown.current) return;
        if (!animate) {
            grow.setValue(1);
            grown.current = true;
            return;
        }
        const anim = Animated.timing(grow, {
            toValue: 1,
            duration: GROW_MS,
            delay: order * GROW_STAGGER_MS,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
        });
        anim.start(({ finished }) => {
            if (finished) grown.current = true;
        });
        return () => anim.stop();
    }, [animate, grow, order]);

    const scale = useMemo(() => grow.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }), [grow]);
    const opacity = useMemo(
        () => grow.interpolate({ inputRange: [0, 0.35, 1], outputRange: [0, 0.85, 1] }),
        [grow],
    );
    return { scale, opacity };
}

const FrostCorner = ({ def, art, haze, width, height, order, animate, glint }: CornerProps) => {
    const { scale, opacity } = useGrowIn(animate, order);
    const glintOpacity = useMemo(() => glint.interpolate(GLINT), [glint]);

    const size = art.size;
    const mirror = [{ scaleX: def.flipX ? -1 : 1 }, { scaleY: def.flipY ? -1 : 1 }];
    const position = {
        left: def.flipX ? width - size : 0,
        top: def.flipY ? height - size : 0,
        width: size,
        height: size,
    };

    return (
        <Animated.View
            pointerEvents='none'
            style={[styles.corner, position, { opacity, transformOrigin: def.origin, transform: [{ scale }] }]}
        >
            <View style={[StyleSheet.absoluteFill, { transform: mirror }]}>
                <FrostArtSvg art={art} haze={haze} />
            </View>
            <Animated.View style={[StyleSheet.absoluteFill, { opacity: glintOpacity, transform: mirror }]}>
                <SparkleSvg art={art} />
            </Animated.View>
        </Animated.View>
    );
};

/** A rim of crystals along the top or bottom edge, between the corners. */
const FrostRim = ({ art, edge, width, haze }: { art: FrostArt; edge: 'top' | 'bottom'; width: number; haze: number }) => {
    const gradient = useGradientId('rim');
    return (
        <View
            pointerEvents='none'
            style={[styles.rim, edge === 'top' ? styles.top : styles.bottom, { height: art.size, transform: [{ scaleY: edge === 'top' ? 1 : -1 }] }]}
        >
            <Svg width={width} height={art.size}>
                <Defs>
                    <LinearGradient id={gradient} x1='0' y1='0' x2='0' y2='1'>
                        <Stop offset='0' stopColor='#ffffff' stopOpacity={haze * 0.7} />
                        <Stop offset='1' stopColor='#ffffff' stopOpacity={0} />
                    </LinearGradient>
                </Defs>
                <Rect x={0} y={0} width={width} height={art.size} fill={`url(#${gradient})`} />
                {art.paths.map((d, depth) =>
                    d ? (
                        <Path
                            key={depth}
                            d={d}
                            fill='none'
                            stroke='#f4fbff'
                            strokeOpacity={STROKES[depth].opacity * 0.85}
                            strokeWidth={STROKES[depth].width}
                            strokeLinecap='round'
                        />
                    ) : null,
                )}
            </Svg>
        </View>
    );
};

/**
 * Crystals up one side of the card, growing in from the edge and up from the
 * bottom corner. `art` is an edge rim turned to run vertically (transposeArt).
 */
const FrostSide = ({ art, side, length, haze, order, animate, glint }: {
    art: FrostArt;
    side: 'left' | 'right';
    length: number;
    haze: number;
    order: number;
    animate: boolean;
    glint: Animated.Value;
}) => {
    const gradient = useGradientId('side');
    const fade = useGradientId('sidefade');
    const mask = useGradientId('sidemask');
    const { scale, opacity } = useGrowIn(animate, order);
    const glintOpacity = useMemo(() => glint.interpolate(GLINT), [glint]);
    const w = art.size;
    const mirror = side === 'right' ? [{ scaleX: -1 }] : [];
    return (
        <Animated.View
            pointerEvents='none'
            style={[
                styles.side,
                side === 'left' ? styles.left : styles.right,
                { width: w, height: length, opacity, transformOrigin: side === 'left' ? 'left bottom' : 'right bottom', transform: [{ scale }] },
            ]}
        >
            <View style={[StyleSheet.absoluteFill, { transform: mirror }]}>
                <Svg width={w} height={length}>
                    <Defs>
                        <LinearGradient id={gradient} x1='0' y1='0' x2='1' y2='0'>
                            <Stop offset='0' stopColor='#ffffff' stopOpacity={haze * 0.7} />
                            <Stop offset='1' stopColor='#ffffff' stopOpacity={0} />
                        </LinearGradient>
                        {/* Thins out toward the top, so a side that stops short
                            of the top corner feathers away instead of ending. */}
                        <LinearGradient id={fade} x1='0' y1='0' x2='0' y2='1'>
                            <Stop offset='0' stopColor='#ffffff' stopOpacity={0} />
                            <Stop offset={String(Math.min(0.35, 160 / Math.max(length, 1)))} stopColor='#ffffff' stopOpacity={1} />
                            <Stop offset='1' stopColor='#ffffff' stopOpacity={1} />
                        </LinearGradient>
                        <Mask id={mask} x={0} y={0} width={w} height={length} maskUnits='userSpaceOnUse'>
                            <Rect x={0} y={0} width={w} height={length} fill={`url(#${fade})`} />
                        </Mask>
                    </Defs>
                    <G mask={`url(#${mask})`}>
                    <Rect x={0} y={0} width={w} height={length} fill={`url(#${gradient})`} />
                    {art.paths.map((d, depth) =>
                        d ? (
                            <Path
                                key={depth}
                                d={d}
                                fill='none'
                                stroke='#f4fbff'
                                strokeOpacity={STROKES[depth].opacity * 0.85}
                                strokeWidth={STROKES[depth].width}
                                strokeLinecap='round'
                            />
                        ) : null,
                    )}
                    </G>
                </Svg>
            </View>
            <Animated.View style={[StyleSheet.absoluteFill, { opacity: glintOpacity, transform: mirror }]}>
                <Svg width={w} height={length}>
                    {art.sparkles.map((p, i) => (
                        <Circle key={i} cx={p.x} cy={p.y} r={p.s * 0.5} fill='#ffffff' fillOpacity={0.85} />
                    ))}
                </Svg>
            </Animated.View>
        </Animated.View>
    );
};

/**
 * How much of each side frosts: the lower part first, since cold glass frosts
 * from the bottom; the whole side in a hard freeze.
 */
const SIDE_SHARE: Record<FrostLevel, number> = { 1: 0.45, 2: 0.8, 3: 1 };

interface FrostCreepProps {
    level: FrostLevel;
    width: number;
    height: number;
    animate: boolean;
}

function FrostCreep({ level, width, height, animate }: FrostCreepProps) {
    const reach = Math.min(width * FROST_REACH[level], height / 3);
    // Haze strength: enough to read as frosted glass, never enough to wash out
    // the white text it may sit under.
    const haze = level === 1 ? 0.1 : level === 2 ? 0.13 : 0.16;

    const corners = useMemo(
        () =>
            LAYOUT[level].map(({ key, scale }) => ({
                def: CORNERS[key],
                art: frostCorner(reach * scale, level, CORNERS[key].seed),
            })),
        [level, reach],
    );
    const rims = useMemo(
        () => (level === 3 ? { top: frostEdge(width, 1601), bottom: frostEdge(width, 1709) } : null),
        [level, width],
    );
    const sideLength = Math.round(height * SIDE_SHARE[level]);
    const sides = useMemo(
        () => ({
            left: transposeArt(frostEdge(sideLength, 1811)),
            right: transposeArt(frostEdge(sideLength, 1913)),
        }),
        [sideLength],
    );

    const glint = useRef(new Animated.Value(0)).current;
    useEffect(() => {
        glint.setValue(0.5);
        if (!animate) return;
        const loop = nativeLoop(glint, GLINT_MS);
        loop.start();
        return () => loop.stop();
    }, [animate, glint]);

    return (
        <View style={StyleSheet.absoluteFill} pointerEvents='none'>
            {rims && (
                <>
                    <FrostRim art={rims.top} edge='top' width={width} haze={haze} />
                    <FrostRim art={rims.bottom} edge='bottom' width={width} haze={haze} />
                </>
            )}
            <FrostSide art={sides.left} side='left' length={sideLength} haze={haze} order={corners.length} animate={animate} glint={glint} />
            <FrostSide art={sides.right} side='right' length={sideLength} haze={haze} order={corners.length + 1} animate={animate} glint={glint} />
            {corners.map(({ def, art }, i) => (
                <FrostCorner
                    key={def.key}
                    def={def}
                    art={art}
                    haze={haze}
                    width={width}
                    height={height}
                    order={i}
                    animate={animate}
                    glint={glint}
                />
            ))}
        </View>
    );
}

export default memo(FrostCreep);

const styles = StyleSheet.create({
    corner: { position: 'absolute' },
    rim: { position: 'absolute', left: 0, right: 0 },
    side: { position: 'absolute', bottom: 0 },
    left: { left: 0 },
    right: { right: 0 },
    top: { top: 0 },
    bottom: { bottom: 0 },
});
