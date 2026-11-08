import {
    HAZY_BACKDROP_LIFT,
    isLightSky,
    lightSkyFade,
    LIGHT_SKY_CARD_TEXT,
    LIGHT_SKY_CARD_TINT,
    LIGHT_SKY_INNER_TINT,
    LIGHT_SKY_LUMINANCE,
    LIGHT_SKY_SCRIM,
    PARTICLE_BACKDROP_LIFT,
    relativeLuminance,
} from '../skyContrast';
import { darkColors, weatherGradients } from '../../../theme/tokens';

describe('relativeLuminance', () => {
    it('spans black to white', () => {
        expect(relativeLuminance('#000000')).toBe(0);
        expect(relativeLuminance('#FFFFFF')).toBeCloseTo(1, 5);
    });

    it('accepts a colour without the hash', () => {
        expect(relativeLuminance('E0F2FE')).toBeCloseTo(relativeLuminance('#E0F2FE'), 10);
    });
});

describe('isLightSky', () => {
    it.each([
        'sunny',
        'clearDay',
        'hot',
        'lowSun',
        'goldenHour',
        'sunset',
        'dawnPale',
        'dawnGold',
        'dawn',
        'drizzle',
        'snow',
        'foggy',
        'hazy',
    ] as const)('treats %s as light', (name) => {
        expect(isLightSky(weatherGradients[name])).toBe(true);
    });

    it.each([
        'clearNight',
        'afterglow',
        'blueHour',
        'dawnAfterglow',
        'dawnBlue',
        'partlyCloudy',
        'cloudy',
        'rainy',
        'stormy',
        'ice',
    ] as const)('leaves %s alone', (name) => {
        expect(isLightSky(weatherGradients[name])).toBe(false);
    });

    it('judges the horizon, the last stop', () => {
        expect(isLightSky(['#FFFFFF', '#FFFFFF', '#000000'])).toBe(false);
        expect(isLightSky(['#000000', '#000000', '#FFFFFF'])).toBe(true);
    });

    it('treats anything it cannot read as dark', () => {
        expect(isLightSky([])).toBe(false);
        expect(isLightSky(['rgba(255,255,255,1)'])).toBe(false);
    });

    it('keeps the threshold where the docs say', () => {
        expect(LIGHT_SKY_LUMINANCE).toBe(0.25);
    });
});

describe('lightSkyFade', () => {
    const LIGHT = [
        'sunny', 'clearDay', 'hot', 'lowSun', 'goldenHour', 'sunset', 'dawnPale',
        'dawnGold', 'dawn', 'drizzle', 'snow', 'foggy', 'hazy',
    ] as const;

    const hex = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
    const toHex = (rgb: number[]) =>
        '#' + rgb.map((c) => Math.round(Math.min(Math.max(c, 0), 255)).toString(16).padStart(2, '0')).join('');
    const parseRgba = (s: string) => {
        const [r, g, b, a] = s.replace(/[^\d.,]/g, '').split(',').map(Number);
        return { rgb: [r, g, b], a };
    };
    const contrast = (fg: number[], bg: number[]) => {
        const [hi, lo] = [relativeLuminance(toHex(fg)), relativeLuminance(toHex(bg))].sort((x, y) => y - x);
        return (hi + 0.05) / (lo + 0.05);
    };
    // Independent of the module's own model: sample the drawn fade and the sky
    // (lifted toward white for the backdrop) every 1% of the height.
    const worstLabelContrast = (gradient: readonly string[], from: number, to: number, lift: number) => {
        const fade = lightSkyFade(gradient, lift);
        const stops = gradient.map(hex);
        let worst = Infinity;
        for (let y = from; y <= to + 1e-9; y += 0.01) {
            const t = y * (stops.length - 1);
            const i = Math.min(Math.floor(t), stops.length - 2);
            const sky = stops[i].map((c, k) => {
                const v = c + (stops[i + 1][k] - c) * (t - i);
                return v + (255 - v) * lift;
            });
            let bg = sky;
            if (fade) {
                const [top, mid] = fade.colors.map(parseRgba);
                const a = y <= 0.45 ? top.a + (mid.a - top.a) * (y / 0.45) : mid.a * Math.max(0, 1 - (y - 0.45) / 0.19);
                bg = sky.map((c, k) => c * (1 - a) + top.rgb[k] * a);
            }
            const label = [255, 255, 255]; // LIGHT_SKY_TEXT is full white
            worst = Math.min(worst, contrast(label, bg));
        }
        return worst;
    };

    const CASES = LIGHT.flatMap((name) => [
        [name, 'glare or fog', HAZY_BACKDROP_LIFT] as const,
        [name, 'particles', PARTICLE_BACKDROP_LIFT] as const,
    ]);

    it.each(CASES)('keeps small header text on %s (%s) at 4.5:1 or better', (name, _backdrop, lift) => {
        expect(worstLabelContrast(weatherGradients[name], 0.15, 0.45, lift)).toBeGreaterThanOrEqual(4.5);
    });

    it.each(CASES)('keeps the place name on %s (%s) at 3:1 or better', (name, _backdrop, lift) => {
        expect(worstLabelContrast(weatherGradients[name], 0, 0.15, lift)).toBeGreaterThanOrEqual(3);
    });

    it('fades a particle sky less than the same sky under glare or fog', () => {
        const alphaAtMid = (lift: number) => parseRgba(lightSkyFade(weatherGradients.snow, lift)!.colors[1]).a;
        expect(alphaAtMid(PARTICLE_BACKDROP_LIFT)).toBeLessThan(alphaAtMid(HAZY_BACKDROP_LIFT));
    });

    it('barely touches hot and fog, whose tops are already dark', () => {
        for (const name of ['hot', 'foggy'] as const) {
            const fade = lightSkyFade(weatherGradients[name]);
            const alphas = fade ? fade.colors.map((c) => parseRgba(c).a) : [0, 0, 0];
            expect(alphas[0]).toBeLessThanOrEqual(0.02);
            expect(alphas[1]).toBeLessThan(0.25);
        }
    });

    it('darkens the top of snow and sunny less than the old fixed 0.5 navy fade', () => {
        for (const name of ['snow', 'clearDay'] as const) {
            const fade = lightSkyFade(weatherGradients[name])!;
            expect(parseRgba(fade.colors[0]).a).toBeLessThan(0.5);
        }
    });

    it("tints with the sky's own top colour, deepened", () => {
        const fade = lightSkyFade(weatherGradients.snow)!;
        expect(parseRgba(fade.colors[0]).rgb).toEqual([27, 42, 55]); // #5B8DB8 at 30%
        expect(parseRgba(fade.colors[2]).a).toBe(0);
        expect(fade.locations).toEqual([0, 0.45, 0.64]);
    });

    it('skips the fade when the header already reads', () => {
        expect(lightSkyFade(['#000000', '#000000', '#FFFFFF'])).toBeNull();
    });

    it('returns null for anything it cannot read', () => {
        expect(lightSkyFade([])).toBeNull();
        expect(lightSkyFade(['#FFFFFF'])).toBeNull();
        expect(lightSkyFade(['rgba(255,255,255,1)', '#FFFFFF'])).toBeNull();
    });
});

describe('light-sky outfit card', () => {
    const rgba = (s: string) => {
        const [r, g, b, a] = s.replace(/[^\d.,]/g, '').split(',').map(Number);
        return { rgb: [r, g, b], a };
    };

    it('keeps the card text white or near-white', () => {
        for (const c of [LIGHT_SKY_CARD_TEXT.textSecondary, LIGHT_SKY_CARD_TEXT.textMuted]) {
            expect(rgba(c).rgb).toEqual([255, 255, 255]);
            expect(rgba(c).a).toBeGreaterThanOrEqual(0.8);
        }
    });

    it('keeps the rating pills at 4.5:1 on the lightest card measured (L* 38)', () => {
        const card = ((38 + 16) / 116) ** 3; // L* back to relative luminance
        const { ratingHigh, ratingMid, ratingLow, ratingPoor } = LIGHT_SKY_CARD_TEXT;
        for (const c of [ratingHigh, ratingMid, ratingLow, ratingPoor]) {
            expect((relativeLuminance(c) + 0.05) / (card + 0.05)).toBeGreaterThanOrEqual(4.5);
        }
    });

    it('keeps the cards\' small labels near-white on every sky', () => {
        expect(rgba(darkColors.textLabel).rgb).toEqual([255, 255, 255]);
        expect(rgba(darkColors.textLabel).a).toBeGreaterThanOrEqual(0.85);
    });

    it('only ever brightens the text it replaces', () => {
        expect(rgba(LIGHT_SKY_CARD_TEXT.textSecondary).a).toBeGreaterThan(rgba(darkColors.textSecondary).a);
        expect(rgba(LIGHT_SKY_CARD_TEXT.textMuted).a).toBeGreaterThan(rgba(darkColors.textMuted).a);
    });

    it('tints the card more than the glass inside it, in the tiles\' navy', () => {
        expect(rgba(LIGHT_SKY_CARD_TINT).a).toBeGreaterThan(rgba(LIGHT_SKY_INNER_TINT).a);
        expect(rgba(LIGHT_SKY_CARD_TINT).rgb).toEqual(rgba(LIGHT_SKY_SCRIM).rgb);
        expect(rgba(LIGHT_SKY_INNER_TINT).rgb).toEqual(rgba(LIGHT_SKY_SCRIM).rgb);
    });
});
