import { useRef, useEffect } from 'react';
import { Animated, PanResponder, View, StyleSheet, ViewStyle } from 'react-native';

const THUMB = 22;
const TRACK = 3;

interface AppSliderProps {
    value: number;
    minimumValue: number;
    maximumValue: number;
    step?: number;
    onValueChange?: (v: number) => void;
    onSlidingComplete?: (v: number) => void;
    minimumTrackTintColor?: string;
    maximumTrackTintColor?: string;
    thumbTintColor?: string;
    style?: ViewStyle;
}

export function AppSlider({
    value,
    minimumValue,
    maximumValue,
    step = 1,
    onValueChange,
    onSlidingComplete,
    minimumTrackTintColor = '#ffffff',
    maximumTrackTintColor = '#555555',
    thumbTintColor = '#ffffff',
    style,
}: AppSliderProps) {
    // Keep always-current refs for values accessed inside PanResponder closures
    const minRef = useRef(minimumValue);
    const maxRef = useRef(maximumValue);
    const stepRef = useRef(step);
    const onChangeRef = useRef(onValueChange);
    const onCompleteRef = useRef(onSlidingComplete);

    // Update refs synchronously during render so PanResponder always sees fresh values
    minRef.current = minimumValue;
    maxRef.current = maximumValue;
    stepRef.current = step;
    onChangeRef.current = onValueChange;
    onCompleteRef.current = onSlidingComplete;

    const trackWidth = useRef(0);
    const animX = useRef(new Animated.Value(0)).current;
    const sliding = useRef(false);
    const dragStartX = useRef(0);
    // Mirror of animX so we can read the current pixel position synchronously
    const lastX = useRef(0);

    const clamp = (n: number, lo: number, hi: number) =>
        Math.min(Math.max(n, lo), hi);

    const xToValue = (x: number) => {
        const ratio = clamp(x / (trackWidth.current || 1), 0, 1);
        const raw = minRef.current + ratio * (maxRef.current - minRef.current);
        return Math.round(raw / stepRef.current) * stepRef.current;
    };

    const valueToX = (v: number, width = trackWidth.current) => {
        const range = maxRef.current - minRef.current || 1;
        return (clamp(v, minRef.current, maxRef.current) - minRef.current) / range * width;
    };

    const setX = (x: number) => {
        lastX.current = x;
        animX.setValue(x);
    };

    // Smoothly animate thumb whenever value/min/max changes externally (e.g. unit toggle)
    useEffect(() => {
        if (sliding.current || trackWidth.current === 0) return;
        const target = valueToX(value);
        Animated.timing(animX, {
            toValue: target,
            duration: 200,
            useNativeDriver: false,
        }).start(({ finished }) => {
            if (finished) lastX.current = target;
        });
        // Also update immediately for short/skipped animations
        lastX.current = target;
    }, [value, minimumValue, maximumValue]);

    const panResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onMoveShouldSetPanResponder: () => true,
            onPanResponderGrant: () => {
                sliding.current = true;
                animX.stopAnimation();
                // Start from wherever the thumb currently sits
                dragStartX.current = lastX.current;
            },
            onPanResponderMove: (_, gs) => {
                const x = clamp(
                    dragStartX.current + gs.dx,
                    0,
                    trackWidth.current,
                );
                setX(x);
                onChangeRef.current?.(xToValue(x));
            },
            onPanResponderRelease: (_, gs) => {
                const x = clamp(
                    dragStartX.current + gs.dx,
                    0,
                    trackWidth.current,
                );
                setX(x);
                sliding.current = false;
                onCompleteRef.current?.(xToValue(x));
            },
            onPanResponderTerminate: (_, gs) => {
                const x = clamp(
                    dragStartX.current + gs.dx,
                    0,
                    trackWidth.current,
                );
                setX(x);
                sliding.current = false;
                onCompleteRef.current?.(xToValue(x));
            },
        }),
    ).current;

    return (
        <View
            style={[styles.container, style]}
            onLayout={(e) => {
                const w = e.nativeEvent.layout.width - THUMB;
                const changed = w !== trackWidth.current;
                trackWidth.current = w;
                if (changed) setX(valueToX(value, w));
            }}
            {...panResponder.panHandlers}
        >
            {/* Inactive track */}
            <View style={[styles.track, { backgroundColor: maximumTrackTintColor }]}>
                {/* Active fill — width is the Animated.Value directly in pixels */}
                <Animated.View
                    style={[
                        styles.fill,
                        { width: animX, backgroundColor: minimumTrackTintColor },
                    ]}
                />
            </View>
            {/* Thumb */}
            <Animated.View
                style={[
                    styles.thumb,
                    {
                        backgroundColor: thumbTintColor,
                        transform: [{ translateX: animX }],
                    },
                ]}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        height: 40,
        justifyContent: 'center',
    },
    track: {
        position: 'absolute',
        left: THUMB / 2,
        right: THUMB / 2,
        height: TRACK,
        borderRadius: TRACK / 2,
        overflow: 'hidden',
    },
    fill: {
        height: TRACK,
        borderRadius: TRACK / 2,
    },
    thumb: {
        position: 'absolute',
        width: THUMB,
        height: THUMB,
        borderRadius: THUMB / 2,
        top: (40 - THUMB) / 2,
        // subtle shadow so thumb is visible on any background
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.25,
        shadowRadius: 2,
        elevation: 3,
    },
});
