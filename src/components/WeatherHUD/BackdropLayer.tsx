import { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet } from 'react-native';
import { useReduceMotion } from '../../hooks/useReduceMotion';

// ─── Backdrop cross-fade ────────────────────────────────────────────────────
// Full-screen weather backdrops (star field, storm rain) used to be mounted and
// unmounted directly off the condition flags. That put a React commit, a native
// view teardown and a fresh rasterization on the exact frame the weather
// changed — a visible hitch, and jarring next to the gradient, which glides to
// its new colours over ~2s.
//
// This keeps the layer mounted for the length of the fade, animates opacity on
// the native driver (no JS or UI-thread work per frame), then unmounts. Staying
// mounted at opacity 0 would be worse: an invisible full-screen translucent
// layer still costs GPU fill rate on every frame.

const FADE_MS = 900;

interface Props {
    /** Whether this backdrop should be showing. */
    visible: boolean;
    children: React.ReactNode;
}

export default function BackdropLayer({ visible, children }: Props) {
    const reduceMotion = useReduceMotion();
    // Rendered while visible, and kept alive through the fade-out afterwards.
    const [mounted, setMounted] = useState(visible);
    const opacity = useRef(new Animated.Value(visible ? 1 : 0)).current;

    useEffect(() => {
        if (visible) setMounted(true);

        if (reduceMotion) {
            opacity.setValue(visible ? 1 : 0);
            if (!visible) setMounted(false);
            return;
        }

        const anim = Animated.timing(opacity, {
            toValue: visible ? 1 : 0,
            duration: FADE_MS,
            useNativeDriver: true,
        });
        anim.start(({ finished }) => {
            // Only unmount on a fade-out that actually ran to completion —
            // an interrupted fade means the condition flipped back.
            if (finished && !visible) setMounted(false);
        });

        return () => anim.stop();
    }, [visible, reduceMotion, opacity]);

    if (!mounted) return null;

    return (
        <Animated.View
            style={[StyleSheet.absoluteFill, { opacity }]}
            pointerEvents='none'
        >
            {children}
        </Animated.View>
    );
}
