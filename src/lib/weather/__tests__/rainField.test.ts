import { RAIN_VARIANTS, type RainVariant } from '../backdropSpec';
import { rainTiles } from '../rainField';

const VARIANTS = Object.keys(RAIN_VARIANTS) as RainVariant[];
const W = 402;
const H = 874;

describe('rainTiles', () => {
    it('is deterministic', () => {
        expect(rainTiles('light', W, H, 0.12)).toEqual(rainTiles('light', W, H, 0.12));
    });

    it.each(VARIANTS)('%s: every drop has a copy one period along the slant, so the loop is seamless', (variant) => {
        for (const angle of [0, 0.12, -0.3]) {
            for (const tile of rainTiles(variant, W, H, angle)) {
                const key = (x: number, y: number) => `${x.toFixed(3)},${y.toFixed(3)}`;
                const at = new Set(tile.drops.map((d) => key(d.x, d.y)));
                // After one loop a drop has moved one period down the slant, to
                // screen y = d.y (the tile starts one period above the canvas).
                // If that's on screen, the tile must already hold a drop there.
                for (const d of tile.drops) {
                    if (d.y + d.len < 0 || d.y > H) continue;
                    expect(at.has(key(d.x + angle * tile.period, d.y + tile.period))).toBe(true);
                }
            }
        }
    });

    it.each(VARIANTS)('%s: band loops divide the 8 s story loop', (variant) => {
        for (const field of RAIN_VARIANTS[variant]) {
            for (const band of field.bands) {
                const n = 8000 / band.loopMs;
                expect(Math.abs(n - Math.round(n))).toBeLessThan(1e-9);
            }
        }
    });

    it('keeps the on-screen density near the spec count', () => {
        const visible = (angle: number) =>
            rainTiles('light', W, (W * 16) / 9, angle)
                .flatMap((t) => t.drops.map((d) => ({ ...d, sy: d.y - t.period })))
                .filter((d) => d.sy >= 0 && d.sy < (W * 16) / 9 && d.x >= 0 && d.x < W).length;
        expect(visible(0)).toBeGreaterThan(55);
        expect(visible(0)).toBeLessThan(85);
        expect(visible(0.3)).toBeGreaterThan(55);
        expect(visible(0.3)).toBeLessThan(85);
    });
});
