import { CLOUD_LAYERS, type CloudCover } from '../backdropSpec';
import { cloudRowSpread, cloudShapes, meanCloudCover, overcastColumns, peakCloudCover } from '../cloudField';
import { CLOUD_HEADER_TO, cloudHeaderCover, STACKED_HOME_TEXT_BAND } from '../skyContrast';

const COVERS: CloudCover[] = ['partly', 'overcast'];
const W = 390;
const H = 844;

describe('cloudShapes', () => {
    it('lays every cloud out the same way each time', () => {
        for (const cover of COVERS) {
            CLOUD_LAYERS[cover].forEach((_, li) => {
                expect(cloudShapes(cover, li, W, H)).toEqual(cloudShapes(cover, li, W, H));
            });
        }
    });

    it('repeats every canvas width, so the drift loops without a seam', () => {
        for (const cover of COVERS) {
            CLOUD_LAYERS[cover].forEach((_: unknown, li: number) => {
                const shapes = cloudShapes(cover, li, W, H);
                for (const id of new Set(shapes.map((s) => s.cloud))) {
                    const copies = shapes.filter((s) => s.cloud === id).sort((a, b) => a.puffs[0].cx - b.puffs[0].cx);
                    expect(copies.length).toBeGreaterThanOrEqual(2);
                    for (let i = 1; i < copies.length; i++) {
                        expect(copies[i].opacity).toBe(copies[0].opacity);
                        copies[i].puffs.forEach((p, k) => {
                            expect(p.cx - copies[i - 1].puffs[k].cx).toBeCloseTo(W, 6);
                            expect(p.cy).toBeCloseTo(copies[i - 1].puffs[k].cy, 6);
                        });
                        if (copies[i].belly) expect(copies[i].belly!.cx - copies[i - 1].belly!.cx).toBeCloseTo(W, 6);
                    }
                }
            });
        }
    });

    it('puts a whole, even number of overcast lumps across each width, on every screen', () => {
        for (const [w, h] of [[390, 844], [430, 932], [466, 678], [951, 669]] as const) {
            CLOUD_LAYERS.overcast.forEach((layer) => {
                const n = overcastColumns(layer, w, h);
                expect(Number.isInteger(n)).toBe(true);
                expect(n % 2).toBe(0);
                expect(n).toBeGreaterThanOrEqual(2);
                expect(n).toBeLessThanOrEqual(layer.maxColumns);
            });
        }
    });

    it('keeps the overcast layers affordable to draw', () => {
        const count = (w: number, h: number) =>
            CLOUD_LAYERS.overcast.reduce(
                (n, _, li) => n + cloudShapes('overcast', li, w, h).reduce((m, s) => m + s.puffs.length + (s.belly ? 1 : 0), 0),
                0,
            );
        // iPhones; the Duo's inner screen is wider and draws more, capped by maxColumns.
        expect(count(390, 844)).toBeLessThanOrEqual(400);
        expect(count(430, 932)).toBeLessThanOrEqual(400);
        expect(count(951, 669)).toBeLessThanOrEqual(700);
    });

    it('covers the two-width canvas and drops copies that cannot reach it', () => {
        for (const cover of COVERS) {
            CLOUD_LAYERS[cover].forEach((_, li) => {
                for (const s of cloudShapes(cover, li, W, H)) {
                    expect(Math.max(...s.puffs.map((p) => p.cx + p.rx))).toBeGreaterThan(0);
                    expect(Math.min(...s.puffs.map((p) => p.cx - p.rx))).toBeLessThan(W * 2);
                }
            });
        }
    });

    it('stands cumulus puffs on a flat base, tallest in the middle', () => {
        const cumulus = cloudShapes('partly', 0, W, H)[0];
        // [0] is the body; the rest are the puffs, left to right.
        const cu = cumulus.puffs.slice(1).map((p) => p.cy - p.ry);
        expect(Math.min(...cu.slice(1, -1))).toBeLessThan(Math.min(cu[0], cu[cu.length - 1]));
        for (const p of cumulus.puffs.slice(1)) expect(p.rx / p.ry).toBeLessThan(2);
    });

    it('builds overcast from mildly wide lumps with uneven edges, never flat slabs', () => {
        for (const li of [0, 1]) {
            const [lo, hi] = CLOUD_LAYERS.overcast[li].aspect;
            for (const s of cloudShapes('overcast', li, W, H)) {
                for (const p of s.puffs) {
                    expect(p.rx / p.ry).toBeGreaterThanOrEqual(lo - 1e-9);
                    expect(p.rx / p.ry).toBeLessThanOrEqual(hi + 1e-9);
                    expect(p.rx / p.ry).toBeLessThan(2.3);
                }
                // The puffs in a lump don't share one base line.
                const bottoms = s.puffs.map((p) => p.cy + p.ry);
                expect(Math.max(...bottoms) - Math.min(...bottoms)).toBeGreaterThan(1);
            }
        }
    });

    it('scales with the canvas', () => {
        const big = cloudShapes('partly', 1, W, H);
        const small = cloudShapes('partly', 1, W / 3, H / 3);
        expect(small).toHaveLength(big.length);
        expect(small[0].puffs[2].cx).toBeCloseTo(big[0].puffs[2].cx / 3, 6);
        expect(small[0].puffs[2].ry).toBeCloseTo(big[0].puffs[2].ry / 3, 6);
    });
});

describe('peakCloudCover', () => {
    const rows = (from: number, to: number) => {
        const out: number[] = [];
        for (let y = from; y <= to + 1e-9; y += 0.01) out.push(y);
        return out;
    };
    // Every Home layout's header text, top of the screen to the lowest small line.
    const HEADER_TO = CLOUD_HEADER_TO;

    it('counts the header as reaching at least as far down as the fade does', () => {
        expect(CLOUD_HEADER_TO).toBeGreaterThanOrEqual(Math.max(0.45, STACKED_HOME_TEXT_BAND.to));
    });

    it.each(COVERS)('keeps %s cloud behind the header within what the fade allows for', (cover) => {
        for (const [w, h] of [[390, 844], [430, 932], [466, 678], [951, 669]] as const) {
            for (const y of rows(0, HEADER_TO)) {
                expect(peakCloudCover(cover, y, w, h)).toBeLessThanOrEqual(cloudHeaderCover(cover));
            }
        }
    });

    it('lets partly cloudy cloud fill out below the header, without going solid white', () => {
        const below = Math.max(...rows(CLOUD_HEADER_TO, 0.9).map((y) => peakCloudCover('partly', y)));
        expect(below).toBeGreaterThan(0.45);
        expect(below).toBeLessThanOrEqual(0.7);
    });

    it('keeps overcast cloud dim all the way down, for the bare cards on their dark sky', () => {
        for (const y of rows(0, 1)) expect(peakCloudCover('overcast', y)).toBeLessThanOrEqual(0.3);
    });

    it('actually puts cloud behind the header', () => {
        for (const cover of COVERS) {
            expect(Math.max(...rows(0.05, 0.45).map((y) => peakCloudCover(cover, y)))).toBeGreaterThan(0.15);
            expect(Math.max(...rows(0.45, CLOUD_HEADER_TO).map((y) => peakCloudCover(cover, y)))).toBeGreaterThan(0.1);
        }
    });
});

describe('overcast, as an even sky rather than stripes', () => {
    const rows = (from: number, to: number) => {
        const out: number[] = [];
        for (let y = from; y <= to + 1e-9; y += 0.01) out.push(y);
        return out;
    };

    // The layers only drift sideways, so a row's average cloud never changes:
    // rows that average denser than their neighbours are bands for good. Before
    // this was fixed the row average ran from 0.001 to 0.258 over this range.
    it.each([[390, 844], [430, 932], [466, 678], [951, 669]] as const)(
        'keeps the cloud averaged along each row level from top to bottom (%i x %i)',
        (w, h) => {
            const means = rows(0.05, 0.75).map((y) => meanCloudCover('overcast', y, w, h));
            expect(Math.max(...means) - Math.min(...means)).toBeLessThanOrEqual(0.08);
            // And it is a deck, not a bare sky: every row has cloud in it.
            expect(Math.min(...means)).toBeGreaterThan(0.04);
        },
    );

    // Its texture is within rows instead: lighter and darker patches along each
    // one. Before the fix every row was nearly uniform along x (0.007–0.012).
    it('is uneven along every row, so it is not a flat sheet of grey', () => {
        for (const y of [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7]) {
            expect(cloudRowSpread('overcast', y)).toBeGreaterThan(0.02);
        }
    });
});
