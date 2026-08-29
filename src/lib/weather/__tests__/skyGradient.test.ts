import { skyGradientFor } from '../skyGradient';
import { gradientFor } from '../conditions';
import { weatherGradients } from '../../../theme/tokens';
import { hexToRgb, rgbToHsl } from '../../../components/WeatherHUD/colorMath';

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
        expect(skyGradientFor(6)).toBe(weatherGradients.lowSun);
        expect(skyGradientFor(2)).toBe(weatherGradients.goldenHour);
        expect(skyGradientFor(-4)).toBe(weatherGradients.sunset);
        expect(skyGradientFor(-7)).toBe(weatherGradients.afterglow);
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
        expect(skyGradientFor(6, true)).toBe(weatherGradients.dawnPale);
        expect(skyGradientFor(2, true)).toBe(weatherGradients.dawnGold);
        expect(skyGradientFor(-4, true)).toBe(weatherGradients.dawn);
        expect(skyGradientFor(-7, true)).toBe(weatherGradients.dawnAfterglow);
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

describe('skyGradientFor — hue path', () => {
    // The continuity tests above measure r+g+b, and lime green has much the
    // same luminance sum as the blue and gold it used to sit between, so it
    // sailed through them. Blending clearDay (hue ~199) toward goldenHour
    // (~46) by the shortest arc ran straight through 120°, painting the whole
    // pre-sunset sky green. Assert on hue, not brightness.
    const GREEN_LO = 75;
    const GREEN_HI = 165;

    const hsl = (hex: string) => {
        const [r, g, b] = hexToRgb(hex);
        return rgbToHsl(r, g, b);
    };

    it.each([
        ['dusk', false],
        ['dawn', true],
    ])('never passes through green on the %s side', (_label, isRising) => {
        for (let e = 20; e >= -25; e -= 0.25) {
            skyGradientFor(e, isRising as boolean).forEach((c, i) => {
                const [h, s] = hsl(c);
                // Near-grey stops have no meaningful hue to constrain.
                if (s <= 0.2) return;
                const inWedge = h > GREEN_LO && h < GREEN_HI;
                expect({ elevation: e, stop: i, hex: c, hue: Math.round(h), inWedge })
                    .toMatchObject({ inWedge: false });
            });
        }
    });

    it('keeps saturation and lightness in range across the sweep', () => {
        for (let e = 20; e >= -25; e -= 0.25) {
            for (const isRising of [false, true]) {
                for (const c of skyGradientFor(e, isRising)) {
                    const [, s, l] = hsl(c);
                    expect(s).toBeGreaterThanOrEqual(0);
                    expect(s).toBeLessThanOrEqual(1);
                    expect(l).toBeGreaterThanOrEqual(0);
                    expect(l).toBeLessThanOrEqual(1);
                }
            }
        }
    });
});

describe('skyGradientFor — twilight is not lurid', () => {
    // sunset -> blueHour used to hold ~0.8 saturation across a ~130 degree arc,
    // so civil twilight went hot magenta. The afterglow stop at -7 mutes that
    // crossing.
    //
    // Note this caps saturation only in the MAGENTA band. A blanket cap would
    // also flag the vivid orange just after sunset, which is exactly right and
    // must stay: the complaint was never "too saturated", it was "too
    // saturated while passing through magenta".
    const MAGENTA_LO = 280;
    const MAGENTA_HI = 345;
    // The cap cannot go much below this while blueHour's horizon is #7C3AED
    // (saturation 0.83): approaching that stop necessarily climbs, and the hue
    // passes through 285 on the way, peaking at 0.56 around -9.25. The old
    // routing hit ~0.68 there. Lowering this further means restyling blueHour,
    // not tuning the blend.
    const CAP = 0.6;

    const hsl = (hex: string) => {
        const [r, g, b] = hexToRgb(hex);
        return rgbToHsl(r, g, b);
    };

    it.each([
        ['dusk', false],
        ['dawn', true],
    ])('keeps %s magenta muted across the whole sweep', (_l, rising) => {
        for (let e = 20; e >= -25; e -= 0.25) {
            skyGradientFor(e, rising as boolean).forEach((c, i) => {
                const [h, sat] = hsl(c);
                if (h <= MAGENTA_LO || h >= MAGENTA_HI) return;
                expect({ elevation: e, stop: i, hex: c, hue: Math.round(h), sat })
                    .toMatchObject({ sat: expect.any(Number) });
                expect(sat).toBeLessThan(CAP);
            });
        }
    });

    it('still allows a saturated orange right after sunset', () => {
        // Guards the cap above from being tightened into something that flattens
        // the sunset itself.
        const [, sat] = hsl(skyGradientFor(-5)[2]);
        expect(sat).toBeGreaterThan(CAP);
    });
});
