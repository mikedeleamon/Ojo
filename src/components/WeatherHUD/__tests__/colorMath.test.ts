import { skyHueDelta, lerpColor, hexToRgb, rgbToHsl } from '../colorMath';

const hueOf = (hex: string) => {
    const [r, g, b] = hexToRgb(hex);
    return rgbToHsl(r, g, b)[0];
};

/** Every hue visited travelling `delta` degrees from `h1`. */
const arc = (h1: number, delta: number, steps = 60) =>
    Array.from({ length: steps + 1 }, (_, i) =>
        (((h1 + (delta * i) / steps) % 360) + 360) % 360,
    );

describe('skyHueDelta', () => {
    it('takes the short arc when green is not on it', () => {
        expect(skyHueDelta(200, 210)).toBe(10);
        expect(skyHueDelta(22, 17)).toBe(-5);
    });

    it('wraps across 0° without going the long way', () => {
        expect(skyHueDelta(350, 10)).toBe(20);
        expect(skyHueDelta(10, 350)).toBe(-20);
    });

    it('takes the LONG arc when the short one crosses green', () => {
        // Sky blue → gold: shortest is −153°, straight through 120°.
        expect(skyHueDelta(199, 46)).toBe(207);
        expect(skyHueDelta(198, 22)).toBe(184);
    });

    it('never routes any pair of sky hues through green', () => {
        for (let h1 = 0; h1 < 360; h1 += 6) {
            for (let h2 = 0; h2 < 360; h2 += 6) {
                // Endpoints that are themselves green are out of scope — the
                // sky palettes contain none.
                if (h1 > 75 && h1 < 165) continue;
                if (h2 > 75 && h2 < 165) continue;
                for (const h of arc(h1, skyHueDelta(h1, h2))) {
                    expect(h > 76 && h < 164).toBe(false);
                }
            }
        }
    });

    it('always lands exactly on the target hue', () => {
        for (let h1 = 0; h1 < 360; h1 += 7) {
            for (let h2 = 0; h2 < 360; h2 += 7) {
                const end = (((h1 + skyHueDelta(h1, h2)) % 360) + 360) % 360;
                expect(end).toBeCloseTo(((h2 % 360) + 360) % 360, 6);
            }
        }
    });
});

describe('lerpColor', () => {
    it('does not produce green midway from sky blue to golden hour', () => {
        // The reported bug: #7DD3FC → #FCD34D used to land on #65fc6c at t=0.5.
        for (const t of [0.25, 0.5, 0.75]) {
            const h = hueOf(lerpColor('#7DD3FC', '#FCD34D', t));
            expect(h > 75 && h < 165).toBe(false);
        }
    });

    it('returns the endpoints exactly', () => {
        expect(lerpColor('#7DD3FC', '#FCD34D', 0)).toBe('#7dd3fc');
        expect(lerpColor('#7DD3FC', '#FCD34D', 1)).toBe('#fcd34d');
    });
});
