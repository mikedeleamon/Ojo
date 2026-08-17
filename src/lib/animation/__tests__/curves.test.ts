import { pingPong, stepped, steppedDuration } from '../curves';

// These configs are handed straight to the native animation driver, which
// evaluates them itself (RCTInterpolationAnimatedNode). A malformed range there
// doesn't throw — it silently renders wrong — so the invariants the driver
// relies on are checked here.

const isStrictlyIncreasing = (xs: number[]) =>
    xs.every((x, i) => i === 0 || x > xs[i - 1]);

describe('pingPong', () => {
    it('starts and ends at `from`, peaking at `to` mid-cycle', () => {
        const { inputRange, outputRange } = pingPong(0, 14);
        expect(inputRange[0]).toBe(0);
        expect(inputRange[inputRange.length - 1]).toBe(1);
        expect(outputRange[0]).toBeCloseTo(0);
        expect(outputRange[outputRange.length - 1]).toBeCloseTo(0);
        expect(Math.max(...outputRange)).toBeCloseTo(14);
    });

    it('agrees at t=0 and t=1 so the native loop wraps seamlessly', () => {
        const { outputRange } = pingPong(1, 0.15);
        expect(outputRange[0]).toBeCloseTo(outputRange[outputRange.length - 1]);
    });

    it('produces a strictly increasing input range', () => {
        expect(isStrictlyIncreasing(pingPong(0, 5).inputRange)).toBe(true);
    });

    it('handles a descending swing (opacity 1 → 0.15 → 1)', () => {
        const { outputRange } = pingPong(1, 0.15);
        expect(Math.min(...outputRange)).toBeCloseTo(0.15);
        expect(Math.max(...outputRange)).toBeCloseTo(1);
    });

    it('handles a zero-amplitude swing without collapsing the input range', () => {
        const { inputRange, outputRange } = pingPong(0, 0);
        expect(isStrictlyIncreasing(inputRange)).toBe(true);
        expect(outputRange.every((v) => v === 0)).toBe(true);
    });
});

describe('stepped', () => {
    // The left bolt: dark for 5.2 s, then flash / dark / flash / dark.
    const pattern = [
        [5200, 0],
        [60, 1],
        [40, 0],
        [70, 1],
        [30, 0],
    ] as const;

    it('spans exactly 0→1 of progress', () => {
        const { inputRange } = stepped(pattern);
        expect(inputRange[0]).toBe(0);
        expect(inputRange[inputRange.length - 1]).toBe(1);
    });

    it('produces a strictly increasing input range', () => {
        expect(isStrictlyIncreasing(stepped(pattern).inputRange)).toBe(true);
    });

    it('starts dark, so a bolt waiting out its start delay is invisible', () => {
        expect(stepped(pattern).outputRange[0]).toBe(0);
    });

    it('holds each segment flat and cuts between them', () => {
        const { inputRange, outputRange } = stepped(pattern);
        // Two stops per segment: cut-in and hold-until.
        expect(inputRange).toHaveLength(pattern.length * 2);
        pattern.forEach(([, value], i) => {
            expect(outputRange[i * 2]).toBe(value);
            expect(outputRange[i * 2 + 1]).toBe(value);
        });
    });

    it('places segment boundaries at the right fraction of the cycle', () => {
        const { inputRange } = stepped(pattern);
        const total = steppedDuration(pattern);
        expect(total).toBe(5400);
        // End of the long dark hold.
        expect(inputRange[1]).toBeCloseTo(5200 / total);
        // End of the first flash.
        expect(inputRange[3]).toBeCloseTo(5260 / total);
    });

    it('keeps cuts far shorter than a frame', () => {
        const { inputRange } = stepped(pattern);
        const total = steppedDuration(pattern);
        // The cut from dark into the first flash, in ms.
        const cutMs = (inputRange[2] - inputRange[1]) * total;
        expect(cutMs).toBeLessThan(1);
    });
});
