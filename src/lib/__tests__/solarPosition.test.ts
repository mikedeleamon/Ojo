import { solarElevation, solarPosition } from '../solarPosition';

// Assertions are ranges rather than exact figures: the point is that the
// algorithm is physically right, not that it matches a particular ephemeris to
// the arcminute. Each range is wide enough to survive a model refinement but
// narrow enough that a genuine regression (wrong sign, missing equation of
// time, degrees/radians mix-up) fails.

describe('solarElevation', () => {
    it('puts the sun near its solstice maximum over London at solar noon', () => {
        // Summer solstice: declination ≈ +23.44°, so max elevation is
        // 90 − (51.51 − 23.44) ≈ 61.9°.
        const e = solarElevation(51.5074, -0.1278, new Date('2026-06-21T12:00:00Z'));
        expect(e).toBeGreaterThan(59);
        expect(e).toBeLessThan(64);
    });

    it('puts the sun deep below the horizon over London at midnight in January', () => {
        const e = solarElevation(51.5074, -0.1278, new Date('2026-01-15T00:00:00Z'));
        expect(e).toBeLessThan(-55);
        expect(e).toBeGreaterThan(-65);
    });

    it('puts the sun overhead at the equator at equinox noon', () => {
        const e = solarElevation(0, 0, new Date('2026-03-20T12:00:00Z'));
        expect(e).toBeGreaterThan(85);
        expect(e).toBeLessThanOrEqual(90);
    });

    it('handles the southern hemisphere (Sydney summer)', () => {
        // December is high summer in Sydney; local noon is ~01:00 UTC.
        const e = solarElevation(-33.8688, 151.2093, new Date('2026-12-21T01:00:00Z'));
        expect(e).toBeGreaterThan(70);
    });

    it('is the inverse season at the same instant across hemispheres', () => {
        const when = new Date('2026-06-21T12:00:00Z');
        const north = solarElevation(51.5, 0, when);
        const south = solarElevation(-51.5, 0, when);
        expect(north).toBeGreaterThan(south);
    });

    it('tracks the day as a single rise-and-fall over 24h', () => {
        const samples = Array.from({ length: 24 }, (_, h) =>
            solarElevation(40.7128, -74.006, new Date(`2026-06-21T${String(h).padStart(2, '0')}:00:00Z`)),
        );
        // Highest sample must beat the lowest by a wide margin, and every value
        // must be a real elevation.
        expect(Math.max(...samples) - Math.min(...samples)).toBeGreaterThan(60);
        for (const s of samples) {
            expect(Number.isFinite(s)).toBe(true);
            expect(s).toBeGreaterThanOrEqual(-90);
            expect(s).toBeLessThanOrEqual(90);
        }
    });

    it('shifts with longitude — solar noon arrives later going west', () => {
        const when = new Date('2026-06-21T12:00:00Z');
        // At 12:00 UTC the sun is near the Greenwich meridian, so a location
        // 90° west is still climbing and must be lower.
        expect(solarElevation(0, 0, when)).toBeGreaterThan(solarElevation(0, -90, when));
    });
});

describe('solarPosition — isRising', () => {
    const LAT = 40;
    const LON = 0;

    it('agrees with solarElevation on elevation', () => {
        const when = new Date('2026-06-21T09:00:00Z');
        expect(solarPosition(LAT, LON, when).elevationDeg)
            .toBeCloseTo(solarElevation(LAT, LON, when), 10);
    });

    it('matches the sign of actual elevation change all day', () => {
        // The ground truth for "rising" is simply: is elevation higher a minute
        // from now? Sampling every 20 min over a full day catches an inverted
        // or off-by-half-a-cycle hour-angle test.
        for (let mins = 0; mins < 1440; mins += 20) {
            const t0 = new Date(Date.UTC(2026, 7, 8, 0, mins, 0));
            const t1 = new Date(t0.getTime() + 60_000);
            const e0 = solarElevation(LAT, LON, t0);
            const e1 = solarElevation(LAT, LON, t1);
            // Skip the two turning points, where a 1-minute delta is ~0 and the
            // comparison is dominated by rounding rather than direction.
            if (Math.abs(e1 - e0) < 0.005) continue;
            expect(solarPosition(LAT, LON, t0).isRising).toBe(e1 > e0);
        }
    });

    it('is rising in the morning and falling in the afternoon', () => {
        // Greenwich meridian: solar noon ≈ 12:00 UTC.
        expect(solarPosition(LAT, LON, new Date('2026-08-08T06:00:00Z')).isRising).toBe(true);
        expect(solarPosition(LAT, LON, new Date('2026-08-08T18:00:00Z')).isRising).toBe(false);
    });

    it('stays correct across solar midnight', () => {
        // Just after solar midnight the hour angle wraps to ≈ −180°; the sun is
        // genuinely climbing toward sunrise from there.
        expect(solarPosition(LAT, LON, new Date('2026-08-08T00:30:00Z')).isRising).toBe(true);
        expect(solarPosition(LAT, LON, new Date('2026-08-07T23:30:00Z')).isRising).toBe(false);
    });

    it('reports the same elevation twice a day with opposite directions', () => {
        // The whole reason isRising exists: −4° happens on the way down AND on
        // the way up, and the sky should not look the same both times.
        const morning = solarPosition(LAT, LON, new Date('2026-08-08T04:10:00Z'));
        const evening = solarPosition(LAT, LON, new Date('2026-08-08T19:35:00Z'));
        expect(morning.elevationDeg).toBeLessThan(0);
        expect(evening.elevationDeg).toBeLessThan(0);
        expect(morning.isRising).toBe(true);
        expect(evening.isRising).toBe(false);
    });
});
