import { rainAngleFor } from '../windSlant';

describe('rainAngleFor', () => {
    it('stays inside the documented 0–0.3 rainAngle range', () => {
        for (let speed = 0; speed <= 120; speed += 5) {
            for (let dir = 0; dir < 360; dir += 15) {
                expect(Math.abs(rainAngleFor(speed, dir))).toBeLessThanOrEqual(0.3);
            }
        }
    });

    it('is near-vertical in calm air, but never perfectly vertical', () => {
        const calm = rainAngleFor(0);
        expect(calm).toBeGreaterThan(0);
        expect(calm).toBeLessThan(0.05);
    });

    it('slants harder as wind rises, then saturates', () => {
        const light = Math.abs(rainAngleFor(5, 270));
        const strong = Math.abs(rainAngleFor(30, 270));
        expect(strong).toBeGreaterThan(light);
        // Beyond the cap, extra speed changes nothing.
        expect(Math.abs(rainAngleFor(60, 270))).toBeCloseTo(Math.abs(rainAngleFor(200, 270)), 5);
    });

    it('drifts right for a westerly and left for an easterly', () => {
        // Meteorological convention: 270° means wind FROM the west, blowing
        // toward the east — rightward on screen.
        expect(rainAngleFor(25, 270)).toBeGreaterThan(0);
        expect(rainAngleFor(25, 90)).toBeLessThan(0);
    });

    it('is near-vertical for a northerly or southerly', () => {
        // Wind straight down/up the screen has no horizontal component.
        expect(Math.abs(rainAngleFor(25, 0))).toBeLessThan(1e-9);
        expect(Math.abs(rainAngleFor(25, 180))).toBeLessThan(1e-9);
    });

    it('is symmetric about the north–south axis', () => {
        expect(rainAngleFor(20, 45)).toBeCloseTo(-rainAngleFor(20, 315), 10);
    });

    it('falls back to the previous rightward drift when direction is unknown', () => {
        // Older cached snapshots have no Direction field; the backdrop must not
        // regress to vertical rain.
        expect(rainAngleFor(25, undefined)).toBeGreaterThan(0);
        expect(rainAngleFor(undefined, undefined)).toBeGreaterThan(0);
    });

    it('treats missing or negative speed as calm', () => {
        expect(rainAngleFor(undefined)).toBeCloseTo(rainAngleFor(0), 10);
        expect(rainAngleFor(-5)).toBeCloseTo(rainAngleFor(0), 10);
    });

    it('always returns a finite number', () => {
        for (const s of [undefined, 0, 12, 999]) {
            for (const d of [undefined, 0, 123, 359]) {
                expect(Number.isFinite(rainAngleFor(s, d))).toBe(true);
            }
        }
    });
});
