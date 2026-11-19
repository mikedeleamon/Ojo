/**
 * CloudDrift — cloud drifting sideways behind WeatherHUD: separate cumulus on a
 * partly cloudy sky, one deck of soft grey lumps on an overcast one.
 *
 * Built like FogDrift. Each layer is one Animated.View two screens wide whose
 * clouds repeat every screen width, so translating it left by one width and
 * snapping back is seamless: one native loop per layer, two layers.
 *
 * Unlike the fog, a layer is drawn small and scaled up. Clouds are all soft
 * edges, so nothing is lost, and the Svg's backing store is a ninth of the
 * size it would be at full scale (a full-screen Svg is a full-screen bitmap,
 * and these are two screens wide).
 *
 * Numbers live in lib/weather/backdropSpec (CLOUD_LAYERS); lib/weather/cloudField
 * lays the puffs out and measures them (the tests hold overcast to an even
 * deck: see meanCloudCover).
 */

import { useEffect, useId, useMemo, useRef } from 'react';
import { Animated, StyleSheet, useWindowDimensions, View } from 'react-native';
import Svg, { Defs, Ellipse, RadialGradient, Stop } from 'react-native-svg';
import { useReduceMotion } from '../../hooks/useReduceMotion';
import { nativeLoop } from '../../lib/animation/nativeLoop';
import {
    CLOUD_LAYERS,
    CLOUD_PUFF_FALLOFF,
    type CloudCover,
    type CloudLayerSpec,
    type OvercastLayerSpec,
} from '../../lib/weather/backdropSpec';
import { bellyOpacity, cloudShapes, type CloudShape } from '../../lib/weather/cloudField';
import { DIM_CLOUD } from '../../lib/weather/skyContrast';

/** The layer is drawn at this share of its size and scaled back up. */
const DETAIL = 1 / 3;

interface CloudLayerProps {
    cover: CloudCover;
    index: number;
    spec: CloudLayerSpec | OvercastLayerSpec;
    width: number;
    height: number;
    /** Share of the spec's opacity to draw at. */
    strength: number;
    animate: boolean;
}

function CloudLayer({ cover, index, spec, width, height, strength, animate }: CloudLayerProps) {
    const progress = useRef(new Animated.Value(0)).current;
    // react-native-svg gradient ids are effectively global, so suffix them per
    // instance. useId's colons aren't valid in url(#…).
    const idPrefix = `cloud${useId().replace(/[^a-zA-Z0-9]/g, '')}`;

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

    // Laid out at the small size the Svg is drawn at.
    const w = width * DETAIL;
    const h = height * DETAIL;
    const shapes = useMemo(() => cloudShapes(cover, index, w, h), [cover, index, w, h]);
    // One gradient per cloud or lump, shared by its copies: each overcast lump
    // has its own shade, which is where the deck's texture comes from.
    const tones = useMemo(() => {
        const seen = new Map<number, CloudShape>();
        for (const s of shapes) if (!seen.has(s.cloud)) seen.set(s.cloud, s);
        return [...seen.values()];
    }, [shapes]);

    return (
        <Animated.View
            style={[
                styles.layer,
                { width: w * 2, height: h, transform: [{ translateX }, { scale: 1 / DETAIL }] },
            ]}
            pointerEvents='none'
        >
            <Svg width={w * 2} height={h} viewBox={`0 0 ${w * 2} ${h}`}>
                <Defs>
                    {tones.map((c) => (
                        <RadialGradient key={`p${c.cloud}`} id={`${idPrefix}-p${c.cloud}`} cx='50%' cy='50%' rx='50%' ry='50%'>
                            {CLOUD_PUFF_FALLOFF.map((s) => (
                                <Stop
                                    key={s.offset}
                                    offset={s.offset}
                                    stopColor={spec.color}
                                    stopOpacity={c.opacity * s.share * strength}
                                />
                            ))}
                        </RadialGradient>
                    ))}
                    {tones.filter((c) => c.belly).map((c) => (
                        <RadialGradient key={`b${c.cloud}`} id={`${idPrefix}-b${c.cloud}`} cx='50%' cy='50%' rx='50%' ry='50%'>
                            <Stop offset='0' stopColor={spec.belly} stopOpacity={bellyOpacity(c.opacity) * strength} />
                            <Stop offset='1' stopColor={spec.belly} stopOpacity={0} />
                        </RadialGradient>
                    ))}
                </Defs>
                {shapes.map((s, si) => (
                    // Puffs first, then the shade under the base.
                    [
                        ...s.puffs.map((p, pi) => (
                            <Ellipse
                                key={`${si}:${pi}`}
                                cx={p.cx}
                                cy={p.cy}
                                rx={p.rx}
                                ry={p.ry}
                                fill={`url(#${idPrefix}-p${s.cloud})`}
                            />
                        )),
                        s.belly && (
                            <Ellipse
                                key={`${si}:b`}
                                cx={s.belly.cx}
                                cy={s.belly.cy}
                                rx={s.belly.rx}
                                ry={s.belly.ry}
                                fill={`url(#${idPrefix}-b${s.cloud})`}
                            />
                        ),
                    ]
                ))}
            </Svg>
        </Animated.View>
    );
}

interface CloudDriftProps {
    cover: CloudCover;
    /**
     * Draw the cloud dim (DIM_CLOUD), for a sky without Home's light-sky
     * treatment. Folded into the gradients' own opacity rather than set on the
     * container, where it would be a group opacity over two full-screen layers.
     */
    dim?: boolean;
    animate?: boolean;
}

export default function CloudDrift({ cover, dim = false, animate = true }: CloudDriftProps) {
    const reduceMotion = useReduceMotion();
    const { width, height } = useWindowDimensions();
    return (
        // Exactly the screen's size, not absoluteFill: BackdropLayer's container
        // overscans the screen top and bottom for parallax and centres its
        // child, and filling it would start the sky that far above the screen.
        // Where cloud sits matters here: it is kept faint behind the header.
        <View style={{ width, height }} pointerEvents='none'>
            {CLOUD_LAYERS[cover].map((spec, index) => (
                <CloudLayer
                    key={spec.id}
                    cover={cover}
                    index={index}
                    spec={spec}
                    width={width}
                    height={height}
                    strength={dim ? DIM_CLOUD : 1}
                    animate={animate && !reduceMotion}
                />
            ))}
        </View>
    );
}

const styles = StyleSheet.create({
    // Scaled from the top-left corner, so the small layer grows to fill the screen.
    layer: { position: 'absolute', top: 0, left: 0, transformOrigin: 'top left' },
});
