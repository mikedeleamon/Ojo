import { accentFromGradient, FALLBACK_ACCENT } from '../weather/accentColor';
import { hexToHsl } from '../../components/WeatherHUD/colorMath';
import { weatherGradients } from '../../theme/tokens';

const HEX = /^#[0-9a-f]{6}$/;

describe('accentFromGradient', () => {
    it('returns an in-band accent for every shipped weather palette', () => {
        for (const [name, gradient] of Object.entries(weatherGradients)) {
            const accent = accentFromGradient(gradient);
            expect(accent).toMatch(HEX);

            if (accent === FALLBACK_ACCENT) continue;

            const [, s, l] = hexToHsl(accent);
            // Tolerance absorbs the round-trip through 8-bit RGB.
            expect(l).toBeGreaterThanOrEqual(0.54);
            expect(l).toBeLessThanOrEqual(0.73);
            expect(s).toBeGreaterThanOrEqual(0.44);
            expect(s).toBeLessThanOrEqual(0.86);
            expect(name).toBeTruthy();
        }
    });

    it('keeps the hue of the stop it picked', () => {
        // rainy's vivid #1D4ED8 stop is the only one carrying the identity.
        const [srcH] = hexToHsl('#1D4ED8');
        const [accentH] = hexToHsl(accentFromGradient(weatherGradients.rainy));
        expect(Math.abs(accentH - srcH)).toBeLessThan(2);
    });

    it('falls back rather than inventing a hue for greyscale input', () => {
        expect(accentFromGradient(['#000000', '#808080', '#FFFFFF'])).toBe(
            FALLBACK_ACCENT,
        );
    });

    it('handles empty input', () => {
        expect(accentFromGradient([])).toBe(FALLBACK_ACCENT);
    });

    it('lifts a near-black palette into the legible band', () => {
        const [, , l] = hexToHsl(accentFromGradient(weatherGradients.clearNight));
        expect(l).toBeGreaterThan(0.5);
    });
});
