// ─── Interpolation curves for natively-driven animations ────────────────────
//
// Pure geometry, deliberately free of any react-native import so it stays
// unit-testable (the project's jest setup runs in node with no RN transform).
// The RN-facing half lives in ./nativeLoop.
//
// These build the `inputRange`/`outputRange` pairs handed to
// `Animated.Value.interpolate`. Because the native driver evaluates the
// interpolation itself (RCTInterpolationAnimatedNode), expressing the *shape*
// of an animation this way is what lets a single looping `Animated.timing`
// stand in for a multi-leg `Animated.sequence` — see ./nativeLoop for why that
// distinction decides whether the loop runs natively or from JavaScript.

export interface Range {
    inputRange: number[];
    outputRange: number[];
}

/**
 * A smooth there-and-back swing across one 0→1 cycle: `from` at t=0, `to` at
 * t=0.5, back to `from` at t=1.
 *
 * Sampled off a cosine, so the turnarounds ease like the `Easing.inOut` pair
 * this replaces and — because t=0 and t=1 produce the same value — the native
 * loop's wrap is invisible.
 */
export function pingPong(from: number, to: number, steps = 12): Range {
    const inputRange: number[] = [];
    const outputRange: number[] = [];
    for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        inputRange.push(t);
        outputRange.push(
            from + (to - from) * (0.5 - 0.5 * Math.cos(2 * Math.PI * t)),
        );
    }
    return { inputRange, outputRange };
}

/**
 * Smallest gap between two interpolation stops. `interpolate` needs a strictly
 * increasing input range, so an instantaneous jump is expressed as two stops
 * this far apart — at any realistic cycle length that is far under one frame,
 * i.e. a hard cut.
 */
const STEP_EPSILON = 1e-4;

/** One hold in a `stepped` pattern: `[durationMs, value]`. */
export type Segment = readonly [number, number];

/**
 * A hold-and-cut pattern: each segment is held flat for its duration and then
 * cut to the next value. The cycle length is the sum of the durations.
 *
 * Used for lightning, where instantaneous transitions are the entire character
 * of the effect — expressing them as zero-duration `Animated.timing` legs is
 * what forced a sequence, and therefore a JS-driven loop, in the first place.
 */
export function stepped(segments: readonly Segment[]): Range {
    const total = steppedDuration(segments);
    const inputRange: number[] = [];
    const outputRange: number[] = [];

    let elapsed = 0;
    segments.forEach(([ms, value], i) => {
        // Cut in to this segment's value. The first segment opens the cycle and
        // so needs no cut of its own.
        inputRange.push(i === 0 ? 0 : elapsed / total + STEP_EPSILON);
        outputRange.push(value);
        // Hold it until the segment ends.
        elapsed += ms;
        inputRange.push(elapsed / total);
        outputRange.push(value);
    });

    return { inputRange, outputRange };
}

/** Total cycle length of a `stepped` pattern, in ms. */
export function steppedDuration(segments: readonly Segment[]): number {
    return segments.reduce((sum, [ms]) => sum + ms, 0);
}
