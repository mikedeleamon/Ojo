/**
 * SunGlare — a soft glow and faint lens-flare ghosts behind WeatherHUD on
 * clear and sunny days, as if the sun sat just past the top-right corner.
 *
 * Two layers, one native loop each:
 *   - the glow: a static radial gradient in a box only as big as the glow,
 *     rasterized once, whose opacity breathes;
 *   - the ghosts: one small Svg per ghost (the star field's pattern: a
 *     full-screen Svg would be a full-screen CPU backing store), inside a
 *     transparent container that slides a few points along the flare line.
 *     A translate needs no offscreen pass, so the container isn't rasterized.
 *
 * Numbers live in lib/weather/backdropSpec (SUN_GLARE), which the
 * Instagram-story loop renderer reads too.
 */

import { useEffect, useId, useMemo, useRef } from 'react';
import { Animated, StyleSheet, useWindowDimensions, View } from 'react-native';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';
import { useReduceMotion } from '../../hooks/useReduceMotion';
import { nativeLoop, pingPong } from '../../lib/animation/nativeLoop';
import { SUN_GLARE } from '../../lib/weather/backdropSpec';

const G = SUN_GLARE;
const BREATHE = pingPong(1, G.breatheMin);
const SLIDE = pingPong(0, 1);

interface SunGlareProps {
    animate: boolean;
}

export default function SunGlare({ animate }: SunGlareProps) {
    const reduceMotion = useReduceMotion();
    const { width, height } = useWindowDimensions();
    const progress = useRef(new Animated.Value(0)).current;
    const gradientId = `glare${useId().replace(/[^a-zA-Z0-9]/g, '')}`;

    useEffect(() => {
        progress.setValue(0);
        if (!animate || reduceMotion) return;
        const loop = nativeLoop(progress, G.breatheMs);
        loop.start();
        return () => loop.stop();
    }, [animate, reduceMotion, progress]);

    const geometry = useMemo(() => {
        const sx = G.source.xf * width;
        const sy = G.source.yf * height;
        // The flare line runs from the sun through the canvas centre to its mirror point.
        const dx = width - 2 * sx;
        const dy = height - 2 * sy;
        const len = Math.hypot(dx, dy);
        return {
            sx,
            sy,
            radius: G.glowRadiusF * width,
            ghosts: G.ghosts.map((g) => ({ ...g, x: sx + g.t * dx, y: sy + g.t * dy })),
            ux: dx / len,
            uy: dy / len,
        };
    }, [width, height]);

    const opacity = useMemo(() => progress.interpolate(BREATHE), [progress]);
    const slide = useMemo(
        () => ({
            translateX: progress.interpolate({ ...SLIDE, outputRange: SLIDE.outputRange.map((v) => v * G.drift * geometry.ux) }),
            translateY: progress.interpolate({ ...SLIDE, outputRange: SLIDE.outputRange.map((v) => v * G.drift * geometry.uy) }),
        }),
        [progress, geometry.ux, geometry.uy],
    );

    const r = geometry.radius;
    return (
        <View style={StyleSheet.absoluteFill} pointerEvents='none'>
            <Animated.View
                shouldRasterizeIOS
                renderToHardwareTextureAndroid
                style={{
                    position: 'absolute',
                    left: geometry.sx - r,
                    top: geometry.sy - r,
                    width: 2 * r,
                    height: 2 * r,
                    opacity,
                }}
            >
                <Svg width={2 * r} height={2 * r}>
                    <Defs>
                        <RadialGradient id={gradientId} cx='50%' cy='50%' rx='50%' ry='50%'>
                            {G.glowStops.map((s) => (
                                <Stop key={s.offset} offset={s.offset} stopColor={G.color} stopOpacity={s.opacity} />
                            ))}
                        </RadialGradient>
                    </Defs>
                    <Circle cx={r} cy={r} r={r} fill={`url(#${gradientId})`} />
                </Svg>
            </Animated.View>

            <Animated.View
                style={[
                    StyleSheet.absoluteFill,
                    { transform: [{ translateX: slide.translateX }, { translateY: slide.translateY }] },
                ]}
            >
                {geometry.ghosts.map((g, i) => {
                    const box = g.d + G.ringStroke * 2;
                    return (
                        <View
                            key={i}
                            style={{ position: 'absolute', left: g.x - box / 2, top: g.y - box / 2, width: box, height: box }}
                        >
                            <Svg width={box} height={box}>
                                {g.shape === 'ring' ? (
                                    <Circle
                                        cx={box / 2}
                                        cy={box / 2}
                                        r={g.d / 2}
                                        fill='none'
                                        stroke={G.color}
                                        strokeOpacity={g.opacity}
                                        strokeWidth={G.ringStroke}
                                    />
                                ) : (
                                    <Circle cx={box / 2} cy={box / 2} r={g.d / 2} fill={G.color} fillOpacity={g.opacity} />
                                )}
                            </Svg>
                        </View>
                    );
                })}
            </Animated.View>
        </View>
    );
}
