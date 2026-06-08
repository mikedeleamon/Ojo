import { getMoonPhase } from '../moonPhase';

// Phase is cyclic in [0,1); 0.98 and 0.02 are both "≈ new". Compare on the circle.
const circularDist = (a: number, b: number) => {
    const d = Math.abs(a - b) % 1;
    return Math.min(d, 1 - d);
};

describe('getMoonPhase', () => {
    it('reads ≈ new moon (0) at the reference epoch', () => {
        // 2000-01-06 18:14 UTC is the anchor new moon.
        const phase = getMoonPhase(new Date(Date.UTC(2000, 0, 6, 18, 14)));
        expect(circularDist(phase, 0)).toBeLessThan(0.02);
    });

    it('reads ≈ new moon (0) at a known total solar eclipse', () => {
        // Great American Eclipse — moon was exactly new on 2017-08-21 18:30 UTC.
        const phase = getMoonPhase(new Date(Date.UTC(2017, 7, 21, 18, 30)));
        expect(circularDist(phase, 0)).toBeLessThan(0.05);
    });

    it('reads ≈ full moon (0.5) at a known total lunar eclipse', () => {
        // Super blue blood moon — full + lunar eclipse on 2018-01-31 13:30 UTC.
        const phase = getMoonPhase(new Date(Date.UTC(2018, 0, 31, 13, 30)));
        expect(circularDist(phase, 0.5)).toBeLessThan(0.05);
    });

    it('always returns a value in [0, 1)', () => {
        for (const d of [
            new Date(Date.UTC(1980, 5, 1)),
            new Date(Date.UTC(2026, 5, 8)),
            new Date(Date.UTC(2099, 11, 31)),
        ]) {
            const phase = getMoonPhase(d);
            expect(phase).toBeGreaterThanOrEqual(0);
            expect(phase).toBeLessThan(1);
        }
    });
});
