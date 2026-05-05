import { useRef, useEffect } from 'react';
import { Animated, Easing } from 'react-native';

/**
 * Returns an interpolated rotate string that perpetually spins.
 * One full rotation every `durationMs` milliseconds (default 10 s).
 */
export const useSpinAnimation = (durationMs = 10_000) => {
    const anim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.loop(
            Animated.timing(anim, {
                toValue: 1,
                duration: durationMs,
                easing: Easing.linear,
                useNativeDriver: true,
            }),
        ).start();
    }, []);

    const rotate = anim.interpolate({
        inputRange: [0, 1],
        outputRange: ['0deg', '360deg'],
    });

    return rotate;
};
