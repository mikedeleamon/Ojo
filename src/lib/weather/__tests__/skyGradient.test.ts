import { skyGradientFor } from '../skyGradient';
import { gradientFor } from '../conditions';
import { weatherGradients } from '../../../theme/tokens';

const HEX = /^#[0-9a-fA-F]{6}$/;

describe('skyGradientFor', () => {
    it('returns the daytime palette BY REFERENCE well above the horizon', () => {
        // Identity matters: a fresh array every 60s would retrigger the 2s
        // gradient sweep every minute for no visible change.
        expect(skyGradientFor(45)).toBe(weatherGradients.clearDay);
        expect(skyGradientFor(10)).toBe(weatherGradients.clearDay);
    });

    it('returns the night palette BY REFERENCE well below the horizon', () => {
        expect(skyGradientFor(-40)).toBe(weatherGradients.clearNight);
        expect(skyGradientFor(-16)).toBe(weatherGradients.clearNight);
    });

    it('lands exactly on the intermediate palettes at their stops', () => {
        // By reference, like the endpoints — a stop shouldn't allocate either.
        expect(skyGradientFor(2)).toBe(weatherGradients.goldenHour);
        expect(skyGradientFor(-4)).toBe(weatherGradients.sunset);
        expect(skyGradientFor(-10)).toBe(weatherGradients.blueHour);
    });

    it('blends between stops rather than snapping', () => {
        const mid = skyGradientFor(-1); // between golden hour (2) and sunset (-4)
        expect(mid).not.toEqual([...weatherGradients.goldenHour]);
        expect(mid).not.toEqual([...weatherGradients.sunset]);
        expect(mid).toHaveLength(3);
        for (const c of mid) expect(c).toMatch(HEX);
    });

    it('emits three valid hex stops at every elevation', () => {
        for (let e = 90; e >= -90; e -= 0.5) {
            const g = skyGradientFor(e);
            expect(g).toHaveLength(3);
            for (const c of g) expect(c).toMatch(HEX);
        }
    });

    it('moves continuously — no large jump between adjacent samples', () => {
        const lum = (hex: string) =>
            parseInt(hex.slice(1, 3), 16) +
            parseInt(hex.slice(3, 5), 16) +
            parseInt(hex.slice(5, 7), 16);
        let prev = skyGradientFor(20).map(lum);
        for (let e = 19.5; e >= -25; e -= 0.5) {
            const next = skyGradientFor(e).map(lum);
            next.forEach((v, i) => expect(Math.abs(v - prev[i])).toBeLessThan(90));
            prev = next;
        }
    });
});

describe('skyGradientFor — dawn vs dusk', () => {
    it('defaults to the evening table when direction is unspecified', () => {
        expect(skyGradientFor(-4)).toBe(weatherGradients.sunset);
        expect(skyGradientFor(-4, false)).toBe(weatherGradients.sunset);
    });

    it('lands on the dawn palettes when the sun is rising', () => {
        expect(skyGradientFor(2, true)).toBe(weatherGradients.dawnGold);
        expect(skyGradientFor(-4, true)).toBe(weatherGradients.dawn);
        expect(skyGradientFor(-10, true)).toBe(weatherGradients.dawnBlue);
    });

    it('differs from dusk at EVERY twilight elevation, not just the stops', () => {
        // The bug this guards against is a half-wired change where the stops
        // differ but the blends in between still come from one table.
        for (let e = 9.5; e >= -15.5; e -= 0.5) {
            expect(skyGradientFor(e, true)).not.toEqual(skyGradientFor(e, false));
        }
    });

    it('shares the daylight and deep-night endpoints', () => {
        // Above +10° and below −16° there is nothing for the asymmetry to act
        // on, so both directions must return the identical reference.
        expect(skyGradientFor(30, true)).toBe(skyGradientFor(30, false));
        expect(skyGradientFor(10, true)).toBe(skyGradientFor(10, false));
        expect(skyGradientFor(-16, true)).toBe(skyGradientFor(-16, false));
        expect(skyGradientFor(-40, true)).toBe(skyGradientFor(-40, false));
    });

    it('keeps dawn cooler and less saturated than dusk at civil twilight', () => {
        // Encodes the physical claim: aerosol-heavy evening air scatters long
        // wavelengths harder, so dusk skews redder than dawn at the same angle.
        const redness = (hex: string) =>
            parseInt(hex.slice(1, 3), 16) - parseInt(hex.slice(5, 7), 16); // R − B
        const dawnMid = skyGradientFor(-4, true)[1];
        const duskMid = skyGradientFor(-4, false)[1];
        expect(redness(duskMid)).toBeGreaterThan(redness(dawnMid));
    });

    it('emits three valid hex stops on the dawn side too', () => {
        for (let e = 90; e >= -90; e -= 0.5) {
            const g = skyGradientFor(e, true);
            expect(g).toHaveLength(3);
            for (const c of g) expect(c).toMatch(HEX);
        }
    });

    it('moves continuously on the dawn side — no large jump between samples', () => {
        const lum = (hex: string) =>
            parseInt(hex.slice(1, 3), 16) +
            parseInt(hex.slice(3, 5), 16) +
            parseInt(hex.slice(5, 7), 16);
        let prev = skyGradientFor(20, true).map(lum);
        for (let e = 19.5; e >= -25; e -= 0.5) {
            const next = skyGradientFor(e, true).map(lum);
            next.forEach((v, i) => expect(Math.abs(v - prev[i])).toBeLessThan(90));
            prev = next;
        }
    });
});

describe('gradientFor with solar elevation', () => {
    it('is byte-identical when no elevation is supplied', () => {
        // The 2-arg contract is relied on by forecast tiles and trip cards,
        // which have no coordinates to compute elevation from.
        expect(gradientFor('Clear', true)).toBe(weatherGradients.clearDay);
        expect(gradientFor('Clear', false)).toBe(weatherGradients.clearNight);
    });

    it('repaints clear/sunny skies by elevation', () => {
        expect(gradientFor('Clear', true, -4)).toBe(weatherGradients.sunset);
        expect(gradientFor('Sunny', true, -10)).toBe(weatherGradients.blueHour);
    });

    it('overrides a stale IsDayTime flag', () => {
        // isDay says night, elevation says high noon — elevation wins.
        expect(gradientFor('Clear', false, 40)).toBe(weatherGradients.clearDay);
    });

    it('passes the rising flag through to the dawn palettes', () => {
        expect(gradientFor('Clear', false, -4, true)).toBe(weatherGradients.dawn);
        expect(gradientFor('Clear', false, -4, false)).toBe(weatherGradients.sunset);
        // Omitting the flag entirely must keep the three-argument behaviour.
        expect(gradientFor('Clear', false, -4)).toBe(weatherGradients.sunset);
    });

    it('ignores the rising flag for condition-dominated skies', () => {
        expect(gradientFor('Rain', true, -4, true)).toBe(weatherGradients.rainy);
        expect(gradientFor('Snow', false, 2, true)).toBe(weatherGradients.snow);
    });

    it('leaves condition-dominated palettes alone', () => {
        // Rain/storm/snow carry the condition's identity; repainting them by
        // time of day would erase it.
        expect(gradientFor('Rain', true, -4)).toBe(weatherGradients.rainy);
        expect(gradientFor('Thunderstorms', true, -4)).toBe(weatherGradients.stormy);
        expect(gradientFor('Snow', false, 20)).toBe(weatherGradients.snow);
        expect(gradientFor('Cloudy', true, -8)).toBe(weatherGradients.cloudy);
    });
});
