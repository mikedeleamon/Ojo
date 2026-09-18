import { useRef, useEffect, useMemo } from 'react';
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

    // Memoised because `AnimatedProps` is keyed on the IDENTITY of the animated
    // nodes in its style (createAnimatedPropsMemoHook → areCompositeKeysEqual
    // compares AnimatedNode instances with ===). A fresh interpolation object
    // every render therefore tore down and rebuilt the whole native node chain
    // — createAnimatedNode + connect + disconnect + drop — on every render of
    // every caller, including mid-scroll re-renders of the weather HUD.
    const rotate = useMemo(
        () =>
            anim.interpolate({
                inputRange: [0, 1],
                outputRange: ['0deg', '360deg'],
            }),
        [anim],
    );

    return rotate;
};
