import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useReduceMotion } from '../../hooks/useReduceMotion';

// ─── Path data ────────────────────────────────────────────────────────────────

const CLOUD_D =
    'M823.69,613.72c-47.55,49.66-112.15,79.24-180.92,83.84h-37.54c-59.28-3.89-113.5-25.91-159.18-63.4-11.79,3.94-23.19,5.82-35.29,7.63l-11.6.43c-5.15.19-9.2.25-14.32.03l-11.71-.51c-36.48-4.11-70.52-18.4-98.17-42.69l-19.46-19.54c-24.42-28.5-38.79-63.33-42.22-100.67l.06-30.26c7.49-88.65,79.1-158.2,167.64-163.7,9.67-17.5,21.08-33.46,34.48-48.4l23.94-24.03c46.96-40.79,103.63-64.94,165.83-68.98h37.54c36.67,2.45,71.83,11.66,104.62,28.07,22.37,11.2,42.51,24.36,61.13,40.98l23.52,23.45c16.15,16.11,27.7,35.23,38.87,55.8,10.67-3.44,21.79-4.81,33.36-6.62l34.43.3c63.01,6.28,117.77,45.14,144.62,102.22l119.08,73.86-116.6,72.36c-10.04,23.53-24.27,43.61-43.09,60.92-28.21,26.7-64.26,42.65-102.86,46.94l-11.77.5c-4.83.21-9.38,1.64-14.15-.33l-11.77-.21c-28.01-3.28-54.4-12.27-78.48-27.95ZM652.77,670.05c53.5-6,102.38-28.81,141.71-64.49l15.53-15.51c3.1-3.09,5.93-6.17,9.87-6.89,4.48-.82,7.59.96,11.67,3.87,42.82,30.58,97.6,38.18,148.83,17.04,42.05-17.35,77.1-55.68,88.7-103.39l-.06-74.67c-5.99-23.33-16.82-44.37-32.7-62.27-4.37-6.01-9.44-10.25-15-15.12-24.21-21.19-54.11-33.73-86.24-36.87-23.32-2.28-45.36,1.4-67.47,8.83-5.18,1.74-12.02-.5-14.55-5.65-14.73-29.89-33.76-57.07-58.45-79.43-39.77-36.03-89.08-58.83-142.45-64.61l-16.16-1.16c-8.24-.59-15.72-.58-23.97,0l-16.17,1.15c-53.32,5.82-102.7,28.55-142.43,64.61-21.13,19.18-38.29,41.86-51.83,66.91-3.43,6.34-8.12,9.59-15.83,8.65l-7.81.9c-39.1,3.16-75.72,22.23-101.36,51.72-21.53,24.77-34.19,55.46-36.89,88.29-4.34,52.86,20.81,106.54,65.1,136.85,41.93,28.69,92.64,34.67,138.73,18.16,7.44-2.66,11.54.07,16.91,4.62,38.46,32.65,85.24,53.03,135.42,58.54l16.18,1.15c8.24.58,15.73.59,23.96,0l16.79-1.21Z';

const DROP_CENTER_D =
    'M681.35,854.14c46.13,17.8,72.04,64.85,63.12,112.6s-50.25,81.3-97.98,81.53c-47.51.23-89.16-33.51-98.64-79.91-9.8-48,15.87-95.42,61.61-113.82l36.04-57.93,35.85,57.53ZM713.28,940.9c-3.93-37.13-37.28-64.11-74.38-60.18-31.71,3.36-56.82,28.47-60.18,60.18-3.93,37.1,23.06,70.47,60.18,74.37,42.83,4.5,78.89-31.68,74.37-74.37Z';

const DROP_LEFT_D =
    'M498.08,833.86c2.49,45.66-32.36,84.21-76.89,87.16-52.13,3.45-93.51-40.88-87.92-91.86,3.41-31.13,24.96-58.54,55.71-69.01l26.08-41.74,25.94,41.4c32.64,10.73,55.23,40.04,57.08,74.04ZM420.68,888.1c23.13-1.28,43.51-22.37,44.48-44.92,1.18-3,1.18-6.35,0-9.35-1.05-23.06-21.92-43.95-44.98-44.97-2.99-1.2-6.35-1.19-9.34,0-23.06,1.05-43.95,21.92-44.97,44.98-1.2,2.99-1.2,6.35,0,9.34,1.03,23.06,21.91,43.94,44.97,44.98,2.96,1.21,6.36,1.14,9.85-.06Z';

const DROP_RIGHT_D =
    'M959.08,833.86c2.49,45.66-32.36,84.21-76.89,87.16-52.13,3.45-93.51-40.88-87.92-91.86,3.41-31.13,24.96-58.54,55.71-69.01l26.08-41.74,25.94,41.4c32.64,10.73,55.23,40.04,57.08,74.04ZM881.68,888.1c23.13-1.28,43.51-22.37,44.48-44.92,1.18-3,1.18-6.35,0-9.35-1.05-23.06-21.92-43.95-44.98-44.97-2.99-1.2-6.35-1.2-9.34,0-23.06,1.03-43.94,21.91-44.98,44.97-1.18,3-1.18,6.35,0,9.34,1.05,23.06,21.92,43.95,44.98,44.97,2.95,1.22,6.37,1.14,9.84-.05Z';

// ─── Drop animation configs ───────────────────────────────────────────────────
// amplitude: downward screen-pixel travel from rest position; duration: full cycle ms.
// Drops oscillate 0 → +amplitude → 0 (fall then return), never going above their
// rest y — keeping them clear of the cloud bottom (y≈698 SVG) at all times.
// LEFT/RIGHT stem tips sit only ~21 SVG units below the cloud; a negative
// translateY of even 3 px would carry them into the cloud shape, so we
// constrain all motion to the downward direction.
// Staggered delays keep the three drops out of phase so they look like falling rain.

const DROP_CONFIGS = [
    { d: DROP_LEFT_D,   amplitude: 12, duration: 2200, delay: 450 },
    { d: DROP_CENTER_D, amplitude: 14, duration: 1850, delay: 0   },
    { d: DROP_RIGHT_D,  amplitude: 11, duration: 2650, delay: 750 },
] as const;

// ─── DropLayer ────────────────────────────────────────────────────────────────
// Each drop lives in its own Animated.View so translateY runs on the native
// thread (useNativeDriver: true) — zero JS/UI-thread work per frame.

interface DropLayerProps {
    d: string;
    size: number;
    color: string;
    amplitude: number;
    duration: number;
    delay: number;
    animate: boolean;
}

function DropLayer({ d, size, color, amplitude, duration, delay, animate }: DropLayerProps) {
    const translateY = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (!animate) {
            translateY.setValue(0);
            return;
        }
        const half = duration / 2;
        const loop = Animated.loop(
            Animated.sequence([
                // Fall down — translateY stays ≥ 0, never above the rest position.
                Animated.timing(translateY, {
                    toValue: amplitude,
                    duration: half,
                    useNativeDriver: true,
                }),
                // Return up to rest.
                Animated.timing(translateY, {
                    toValue: 0,
                    duration: half,
                    useNativeDriver: true,
                }),
            ]),
        );
        const timer = setTimeout(() => loop.start(), delay);
        return () => {
            clearTimeout(timer);
            loop.stop();
        };
    }, [animate, amplitude, duration, delay, translateY]);

    return (
        <Animated.View
            style={[StyleSheet.absoluteFill, { transform: [{ translateY }] }]}
            pointerEvents='none'
        >
            <Svg
                viewBox='0 0 1280 1280'
                width={size}
                height={size}
            >
                <Path
                    fill={color}
                    fillRule='evenodd'
                    d={d}
                />
            </Svg>
        </Animated.View>
    );
}

// ─── Component ────────────────────────────────────────────────────────────────

interface RainyIconProps {
    size?: number;
    color?: string;
    /** Run the drop animation. Pass false for small/list instances to avoid
     *  per-frame cost across many rendered cells. Defaults to true. */
    animate?: boolean;
}

export default function RainyIcon({ size = 180, color = '#fefefe', animate = true }: RainyIconProps) {
    const reduceMotion = useReduceMotion();
    const shouldAnimate = animate && !reduceMotion;

    return (
        <View
            style={{ width: size, height: size }}
            accessibilityLabel='Rainy'
        >
            {/* Cloud — static base layer */}
            <Svg
                viewBox='0 0 1280 1280'
                width={size}
                height={size}
                style={StyleSheet.absoluteFill}
            >
                <Path
                    fill={color}
                    d={CLOUD_D}
                />
            </Svg>

            {/* Drops — each in its own native-animated layer */}
            {DROP_CONFIGS.map((cfg, i) => (
                <DropLayer
                    key={i}
                    d={cfg.d}
                    size={size}
                    color={color}
                    amplitude={cfg.amplitude}
                    duration={cfg.duration}
                    delay={cfg.delay}
                    animate={shouldAnimate}
                />
            ))}
        </View>
    );
}
