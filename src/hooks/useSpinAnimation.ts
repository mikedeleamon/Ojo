import { useRef, useEffect } from 'react';
import { Animated, Easing } from 'react-native';
import { useReduceMotion } from './useReduceMotion';

export const useSpinAnimation = (durationMs = 10_000) => {
    const reduceMotion = useReduceMotion();
    const anim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (reduceMotion || durationMs <= 0) {
            anim.stopAnimation();
            anim.setValue(0);
            return;
        }
        const loop = Animated.loop(
            Animated.timing(anim, {
                toValue: 1,
                duration: durationMs,
                easing: Easing.linear,
                useNativeDriver: true,
            }),
        );
        loop.start();
        return () => loop.stop();
    }, [reduceMotion, durationMs]);

    const rotate = anim.interpolate({
        inputRange: [0, 1],
        outputRange: ['0deg', '360deg'],
    });

    return rotate;
};
