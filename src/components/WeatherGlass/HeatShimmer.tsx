/**
 * HeatShimmer — the outfit card's glass on a scorching day: warmed through,
 * with heat haze wavering up it and a slow mirage sheen sliding across.
 *
 * Real heat shimmer bends what's behind it, which no overlay can do to a native
 * glass view (see lib/weather/weatherGlass), so this draws haze rather than
 * distortion:
 *   - a static warm wash, strongest at the top;
 *   - five faint heat lines spread down the card, each a static Svg that rises a
 *     short way, wavers sideways and fades, on its own native loop;
 *   - one sheen, a diagonal band of light crossing the card now and then.
 * That's six animated views. Nothing re-renders while it runs.
 */

import { memo, useEffect, useMemo, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path } from 'react-native-svg';
import { nativeLoop } from '../../lib/animation/nativeLoop';
import { heatWaves, wavePath, type HeatWave } from '../../lib/weather/weatherGlass';

const WAVE_OVERHANG = 24;
const WAVE_BOX = 28;
const SHEEN_MS = 9000;
/** Share of the sheen's loop spent crossing; it's off-card the rest. */
const SHEEN_CROSS = 0.38;

interface WaveProps {
    wave: HeatWave;
    width: number;
    height: number;
    intensity: number;
    animate: boolean;
}

const HeatLine = ({ wave, width, height, intensity, animate }: WaveProps) => {
    const progress = useRef(new Animated.Value(0)).current;
    useEffect(() => {
        progress.setValue(0.5);
        if (!animate) return;
        const loop = nativeLoop(progress, wave.durationMs);
        const timer = setTimeout(() => loop.start(), wave.delayMs);
        return () => {
            clearTimeout(timer);
            loop.stop();
        };
    }, [animate, progress, wave.durationMs, wave.delayMs]);

    const translateY = useMemo(
        () => progress.interpolate({ inputRange: [0, 1], outputRange: [0, -wave.rise] }),
        [progress, wave.rise],
    );
    const translateX = useMemo(
        () =>
            progress.interpolate({
                inputRange: [0, 0.25, 0.5, 0.75, 1],
                outputRange: [0, 6, -4, 5, 0],
            }),
        [progress],
    );
    const peak = wave.opacity * intensity;
    const opacity = useMemo(
        () =>
            progress.interpolate({
                inputRange: [0, 0.3, 0.7, 1],
                outputRange: [0, peak, peak, 0],
            }),
        [progress, peak],
    );

    const svgWidth = width + WAVE_OVERHANG * 2;
    const mid = WAVE_BOX / 2;
    const d = useMemo(
        () => wavePath(svgWidth, mid, wave.amp, wave.wavelength),
        [svgWidth, mid, wave.amp, wave.wavelength],
    );
    // A second line half a wave behind, fainter: haze is never one clean stroke.
    const d2 = useMemo(
        () => wavePath(svgWidth, mid + 5, wave.amp * 0.7, wave.wavelength * 1.3, 0.5),
        [svgWidth, mid, wave.amp, wave.wavelength],
    );

    const top = wave.yF * height - mid;
    return (
        <Animated.View
            pointerEvents='none'
            style={[
                styles.wave,
                { top, left: -WAVE_OVERHANG, width: svgWidth, opacity: animate ? opacity : peak * 0.6 },
                animate && { transform: [{ translateY }, { translateX }] },
            ]}
            shouldRasterizeIOS
            renderToHardwareTextureAndroid
        >
            <Svg width={svgWidth} height={WAVE_BOX}>
                {/* Wide and faint under thin and brighter reads as a soft blur. */}
                <Path d={d} fill='none' stroke='#fff3e0' strokeOpacity={0.35} strokeWidth={7} strokeLinecap='round' />
                <Path d={d} fill='none' stroke='#fff7ed' strokeOpacity={1} strokeWidth={1.1} strokeLinecap='round' />
                <Path d={d2} fill='none' stroke='#fed7aa' strokeOpacity={0.6} strokeWidth={0.8} strokeLinecap='round' />
            </Svg>
        </Animated.View>
    );
};

const Sheen = ({ width, height, intensity, animate }: { width: number; height: number; intensity: number; animate: boolean }) => {
    const progress = useRef(new Animated.Value(0)).current;
    useEffect(() => {
        progress.setValue(0);
        if (!animate) return;
        const loop = nativeLoop(progress, SHEEN_MS);
        const timer = setTimeout(() => loop.start(), 1200);
        return () => {
            clearTimeout(timer);
            loop.stop();
        };
    }, [animate, progress]);

    // The band only spans the card's first ~900 pt: that's the part on screen
    // when the sheen is worth seeing, and a card-tall band would be wasted fill.
    const bandW = Math.max(120, width * 0.55);
    const bandH = Math.min(height, 900);
    const translateX = useMemo(
        () =>
            progress.interpolate({
                inputRange: [0, SHEEN_CROSS, 1],
                outputRange: [-bandW * 1.4, width + bandW * 0.4, width + bandW * 0.4],
            }),
        [progress, bandW, width],
    );
    if (!animate) return null;
    return (
        <Animated.View
            pointerEvents='none'
            style={[
                styles.sheen,
                { width: bandW, height: bandH + 200, opacity: 0.9 * intensity, transform: [{ translateX }, { rotate: '18deg' }] },
            ]}
        >
            <LinearGradient
                colors={['rgba(255,255,255,0)', 'rgba(255,247,237,0.09)', 'rgba(255,255,255,0)']}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
                style={StyleSheet.absoluteFill}
            />
        </Animated.View>
    );
};

interface HeatShimmerProps {
    /** 0.4 at 90°F up to 1 at 105°F and above. */
    intensity: number;
    width: number;
    height: number;
    animate: boolean;
}

function HeatShimmer({ intensity, width, height, animate }: HeatShimmerProps) {
    const waves = useMemo(() => heatWaves(1801), []);
    return (
        <View style={StyleSheet.absoluteFill} pointerEvents='none'>
            {/* Warmed glass: amber at the top easing to nothing. Kept faint so the
                card's white text stays white. */}
            <LinearGradient
                colors={[
                    `rgba(251,146,60,${(0.12 * intensity).toFixed(3)})`,
                    `rgba(251,191,36,${(0.05 * intensity).toFixed(3)})`,
                    'rgba(251,191,36,0)',
                ]}
                locations={[0, 0.35, 0.8]}
                style={StyleSheet.absoluteFill}
            />
            {waves.map((w, i) => (
                <HeatLine key={i} wave={w} width={width} height={height} intensity={intensity} animate={animate} />
            ))}
            <Sheen width={width} height={height} intensity={intensity} animate={animate} />
        </View>
    );
}

export default memo(HeatShimmer);

const styles = StyleSheet.create({
    wave: { position: 'absolute', height: WAVE_BOX },
    sheen: { position: 'absolute', top: -100, left: 0 },
});
