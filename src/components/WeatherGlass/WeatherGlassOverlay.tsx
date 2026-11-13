/**
 * WeatherGlassOverlay — the weather, on the glass. Laid over a glass card (the
 * Home outfit card), it draws rain beads, frost or heat shimmer for the current
 * conditions, or nothing on an ordinary day.
 *
 * Sits on top of the card's content with pointer events off: the glass is the
 * pane in front, so that's where water and frost collect. Frost and the
 * heaviest beading keep to the card's padding (GLASS_BAND); rain also beads
 * across the face, lightly, so the content stays readable. Rain hitting the
 * card's top edge is drawn outside the card, by RainEdgeSplash.
 *
 * `animate` should follow the sky's own gate (WeatherHUD's backdropAnimate), so
 * the loops stop on other tabs. Reduce Motion draws every effect still.
 */

import { memo, useCallback, useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { useReduceMotion } from '../../hooks/useReduceMotion';
import type { GlassEffect } from '../../lib/weather/weatherGlass';
import RainBeads from './RainBeads';
import FrostCreep from './FrostCreep';
import HeatShimmer from './HeatShimmer';

interface Props {
    effect: GlassEffect | null;
    animate: boolean;
}

/** Below this the card hasn't laid out for real yet. */
const MIN_SIDE = 80;

function WeatherGlassOverlay({ effect, animate }: Props) {
    const reduceMotion = useReduceMotion();
    const [size, setSize] = useState<{ width: number; height: number } | null>(null);

    // Whole points: sub-point changes from text layout would otherwise rebuild
    // the art for nothing.
    const onLayout = useCallback((e: LayoutChangeEvent) => {
        const width = Math.round(e.nativeEvent.layout.width);
        const height = Math.round(e.nativeEvent.layout.height);
        setSize((prev) => (prev && prev.width === width && prev.height === height ? prev : { width, height }));
    }, []);

    if (!effect) return null;
    const ready = size && size.width >= MIN_SIDE && size.height >= MIN_SIDE;
    const moving = animate && !reduceMotion;

    return (
        <View style={StyleSheet.absoluteFill} pointerEvents='none' onLayout={onLayout}>
            {ready && effect.kind === 'rain' && (
                <RainBeads density={effect.density} width={size.width} height={size.height} animate={moving} />
            )}
            {ready && effect.kind === 'frost' && (
                <FrostCreep level={effect.level} width={size.width} height={size.height} animate={moving} />
            )}
            {ready && effect.kind === 'heat' && (
                <HeatShimmer intensity={effect.intensity} width={size.width} height={size.height} animate={moving} />
            )}
        </View>
    );
}

export default memo(WeatherGlassOverlay);
