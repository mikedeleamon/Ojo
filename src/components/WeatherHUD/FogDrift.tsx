/**
 * FogDrift — soft fog banks drifting sideways behind WeatherHUD.
 *
 * Each layer is one Animated.View two screens wide. Its bands repeat every
 * screen width (drawn at every whole-width offset that can reach the canvas),
 * so translating left by one width and snapping back is seamless — one native
 * loop per layer. A band is an ellipse filled with a radial fade from its
 * opacity to nothing, which keeps the flat look: no texture, no noise.
 *
 * Numbers live in lib/weather/backdropSpec (FOG_LAYERS), which the
 * Instagram-story loop renderer reads too.
 */

import { useEffect, useId, useMemo, useRef } from 'react';
import { Animated, StyleSheet, useWindowDimensions, View } from 'react-native';
import Svg, { Defs, Ellipse, RadialGradient, Stop } from 'react-native-svg';
import { useReduceMotion } from '../../hooks/useReduceMotion';
import { nativeLoop } from '../../lib/animation/nativeLoop';
import { FOG_LAYERS, type FogLayerSpec } from '../../lib/weather/backdropSpec';

/** Whole-width copies of each band. Enough that any band (up to ~2 widths wide) tiles the 2-width canvas. */
const COPIES = [-2, -1, 0, 1, 2];

interface FogLayerProps {
    spec: FogLayerSpec;
    width: number;
    height: number;
    color: string;
    animate: boolean;
}

function FogLayer({ spec, width, height, color, animate }: FogLayerProps) {
    const progress = useRef(new Animated.Value(0)).current;
    // react-native-svg gradient ids are effectively global (see OjoLogo), so
    // suffix them per instance. useId's colons aren't valid in url(#…).
    const idPrefix = `fog${useId().replace(/[^a-zA-Z0-9]/g, '')}`;

    useEffect(() => {
        progress.setValue(0);
        if (!animate) return;
        const loop = nativeLoop(progress, spec.duration);
        loop.start();
        return () => loop.stop();
    }, [animate, progress, spec.duration]);

    const translateX = useMemo(
        () => progress.interpolate({ inputRange: [0, 1], outputRange: [0, -width] }),
        [progress, width],
    );

    const ellipses = useMemo(
        () =>
            spec.bands.flatMap((b, bi) =>
                COPIES.map((copy) => ({
                    key: `${bi}:${copy}`,
                    gradient: `${idPrefix}-${bi}`,
                    cx: (b.xf + b.wf / 2 + copy) * width,
                    cy: b.yf * height,
                    rx: (b.wf * width) / 2,
                    ry: (b.hf * height) / 2,
                })),
            ),
        [spec.bands, idPrefix, width, height],
    );

    return (
        <Animated.View
            style={[styles.layer, { width: width * 2, height, transform: [{ translateX }] }]}
            pointerEvents='none'
            shouldRasterizeIOS
            renderToHardwareTextureAndroid
        >
            <Svg width={width * 2} height={height} viewBox={`0 0 ${width * 2} ${height}`}>
                <Defs>
                    {spec.bands.map((b, bi) => (
                        <RadialGradient key={bi} id={`${idPrefix}-${bi}`} cx='50%' cy='50%' rx='50%' ry='50%'>
                            <Stop offset='0' stopColor={color} stopOpacity={b.opacity} />
                            <Stop offset='1' stopColor={color} stopOpacity={0} />
                        </RadialGradient>
                    ))}
                </Defs>
                {ellipses.map((e) => (
                    <Ellipse key={e.key} cx={e.cx} cy={e.cy} rx={e.rx} ry={e.ry} fill={`url(#${e.gradient})`} />
                ))}
            </Svg>
        </Animated.View>
    );
}

interface FogDriftProps {
    color?: string;
    animate?: boolean;
}

export default function FogDrift({ color = '#ffffff', animate = true }: FogDriftProps) {
    const reduceMotion = useReduceMotion();
    const { width, height } = useWindowDimensions();
    return (
        <View style={StyleSheet.absoluteFill} pointerEvents='none'>
            {FOG_LAYERS.map((spec) => (
                <FogLayer
                    key={spec.id}
                    spec={spec}
                    width={width}
                    height={height}
                    color={color}
                    animate={animate && !reduceMotion}
                />
            ))}
        </View>
    );
}

const styles = StyleSheet.create({
    layer: { position: 'absolute', top: 0, left: 0 },
});
