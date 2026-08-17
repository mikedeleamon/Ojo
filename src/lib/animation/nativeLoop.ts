import { Animated, Easing } from 'react-native';

// ─── Natively-looped animations ─────────────────────────────────────────────
//
// `Animated.loop` only hands the loop to the native driver when its child
// reports `_isUsingNativeDriver() === true`. `Animated.sequence` hard-codes that
// to `false`:
//
//     // react-native/Libraries/Animated/AnimatedImplementation.js
//     const sequenceImpl = function (animations) { return {
//       ...
//       _isUsingNativeDriver: function (): boolean { return false; },
//     }; };
//
// so `Animated.loop(Animated.sequence([...]))` — however many of its legs pass
// `useNativeDriver: true` — silently takes loopImpl's JS branch, the one whose
// own comment reads "Start looping recursively on the js thread". Every leg
// boundary then costs a native→JS completion event, a rebuild of the next leg's
// frames array, and a JS→native start call.
//
// Each individual leg still animates natively, so this never shows up as
// per-frame JS work. It shows up as the animation *freezing at a turnaround*
// whenever the JS thread is busy, and then snapping — which reads as chop. It
// is worst where the legs are shortest: the lightning bolt's strike pattern was
// nine legs, four of them `duration: 0`, so a single strike needed nine
// round-trips inside about 250 ms.
//
// A single `Animated.timing` does implement `_startNativeLoop`. So everything
// here drives one linear 0→1 progress value and expresses the shape of the
// animation as an interpolation, which the native driver evaluates itself.
// After `start()`, the JS thread is not involved again for the life of the loop.

export { pingPong, stepped, steppedDuration } from './curves';
export type { Range, Segment } from './curves';

/** A 0→1 progress loop that runs entirely on the native driver. */
export function nativeLoop(
    value: Animated.Value,
    duration: number,
): Animated.CompositeAnimation {
    return Animated.loop(
        Animated.timing(value, {
            toValue: 1,
            duration,
            easing: Easing.linear,
            useNativeDriver: true,
        }),
    );
}
