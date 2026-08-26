import { useEffect, useState } from 'react';
import Animated, {
    Extrapolation,
    interpolate,
    runOnJS,
    useAnimatedStyle,
    useSharedValue,
    withTiming,
    type SharedValue,
} from 'react-native-reanimated';
import { useReduceMotion } from '../../hooks/useReduceMotion';

// ─── Backdrop cross-fade + scroll parallax ──────────────────────────────────
// Full-screen weather backdrops (star field, storm rain) used to be mounted and
// unmounted directly off the condition flags. That put a React commit, a native
// view teardown and a fresh rasterization on the exact frame the weather
// changed — a visible hitch, and jarring next to the gradient, which glides to
// its new colours over ~2s.
//
// This keeps the layer mounted for the length of the fade, then unmounts.
// Staying mounted at opacity 0 would be worse: an invisible full-screen
// translucent layer still costs GPU fill rate on every frame.
//
// Opacity and parallax share ONE Reanimated animated style, so both run on the
// UI thread with no JS-thread work per frame. (This component previously used
// RN Animated; the two systems can't be composed on a single view, and scrollY
// is already a Reanimated shared value driving the sticky header.)
//
// The scroll dim was once moved out of here — onto a full-screen gradient scrim
// in WeatherHUD — on the theory that group opacity over the 32-view star field
// was forcing a per-frame offscreen composite. Measured on an iPhone 16, that
// made scrolling *worse*, not better: the scrim added a full-screen alpha-
// blended layer beneath the glass, and its cost outweighed whatever the
// offscreen pass had been costing. The dim lives here again. If this is
// revisited, the lesson is that full-screen fill under a glass surface is the
// expensive thing on this screen — adding any layer there has to pay for itself.

const FADE_MS = 900;

/**
 * Maximum parallax travel in either direction, in px.
 *
 * The child renders at exactly screen height, so translating it would expose an
 * edge. The container is inset by this amount top AND bottom and centres the
 * child, giving it that much overscan in both directions — the edge can never
 * come into frame.
 */
const MAX_PARALLAX = 48;

/**
 * Scroll offset at which parallax and dimming reach their limit.
 * Exported because WeatherHUD freezes the clear-night twinkle at exactly this
 * point — past here the backdrop is at MIN_DIM and holds still.
 */
export const SCROLL_RANGE = 420;
/** Rubber-band range above the top (pull-to-refresh) that drifts the sky down. */
const OVERSCROLL_RANGE = 160;

/** How far the backdrop dims once scrolled into the content. */
const MIN_DIM = 0.55;

interface Props {
    /** Whether this backdrop should be showing. */
    visible: boolean;
    /** Scroll offset of the content above this layer. */
    scrollY: SharedValue<number>;
    /**
     * Apparent nearness, 0–1. 0 = infinitely distant (holds still), 1 = closest
     * (full MAX_PARALLAX travel). Stars sit far back; rain is right in front of
     * you, so they should not move together.
     */
    depth: number;
    /**
     * Apply the scroll-driven parallax and dim. Only the dev perf panel passes
     * false — it's one of the levers for isolating what actually costs frames
     * on this screen (see lib/debug/perfFlags).
     */
    parallax?: boolean;
    children: React.ReactNode;
}

export default function BackdropLayer({
    visible,
    scrollY,
    depth,
    parallax = true,
    children,
}: Props) {
    const reduceMotion = useReduceMotion();
    // Rendered while visible, and kept alive through the fade-out afterwards.
    const [mounted, setMounted] = useState(visible);
    const fade = useSharedValue(visible ? 1 : 0);

    useEffect(() => {
        if (visible) setMounted(true);

        if (reduceMotion) {
            fade.value = visible ? 1 : 0;
            if (!visible) setMounted(false);
            return;
        }

        fade.value = withTiming(visible ? 1 : 0, { duration: FADE_MS }, (finished) => {
            'worklet';
            // Only unmount on a fade-out that actually ran to completion — an
            // interrupted fade means the condition flipped back, and starting a
            // new withTiming fires this with finished === false.
            if (finished && !visible) runOnJS(setMounted)(false);
        });
    }, [visible, reduceMotion, fade]);

    const style = useAnimatedStyle(() => {
        // Parallax is motion tied to the finger and is a known vestibular
        // trigger, so it goes away under reduce-motion. The dim is not motion
        // and stays — it's there for text legibility.
        const translateY = reduceMotion || !parallax
            ? 0
            : interpolate(
                  scrollY.value,
                  [-OVERSCROLL_RANGE, 0, SCROLL_RANGE],
                  [MAX_PARALLAX * depth, 0, -MAX_PARALLAX * depth],
                  Extrapolation.CLAMP,
              );

        // Thin the backdrop as content slides over it: keeps the glass cards and
        // body copy legible against a busy sky, and reads as depth rather than
        // as a compromise.
        const dim = parallax
            ? interpolate(
                  scrollY.value,
                  [0, SCROLL_RANGE],
                  [1, MIN_DIM],
                  Extrapolation.CLAMP,
              )
            : 1;

        return { opacity: fade.value * dim, transform: [{ translateY }] };
    }, [depth, reduceMotion, parallax]);

    if (!mounted) return null;

    return (
        <Animated.View
            style={[
                {
                    position: 'absolute',
                    left: 0,
                    right: 0,
                    // Overscan so parallax never pulls an edge into frame.
                    top: -MAX_PARALLAX,
                    bottom: -MAX_PARALLAX,
                    justifyContent: 'center',
                },
                style,
            ]}
            pointerEvents='none'
        >
            {children}
        </Animated.View>
    );
}
