import {
    BEAD_SPECS,
    FREEZING_F,
    GLASS_BAND,
    HEAT_F,
    RUNNER_SPEED,
    SPLASH_HITS,
    SWELL_MS,
    borderRunners,
    edgeSplashes,
    runnerTimeline,
    frostCorner,
    frostEdge,
    glassEffectFor,
    heatWaves,
    holdPerHit,
    interiorBeads,
    repeatKeys,
    splashEmitters,
    stripBeads,
    transposeArt,
    wavePath,
} from '../weather/weatherGlass';

const strictlyIncreasing = (xs: number[]) => xs.every((x, i) => i === 0 || x > xs[i - 1]);

describe('glassEffectFor', () => {
    it('draws nothing on an ordinary dry day', () => {
        expect(glassEffectFor(null, 65)).toBeNull();
        expect(glassEffectFor(null, HEAT_F - 1)).toBeNull();
        expect(glassEffectFor(null, FREEZING_F + 1)).toBeNull();
    });

    it('beads in rain, by how hard it falls', () => {
        expect(glassEffectFor('drizzle', 55)).toEqual({ kind: 'rain', density: 'drizzle' });
        expect(glassEffectFor('light', 55)).toEqual({ kind: 'rain', density: 'rain' });
        expect(glassEffectFor('storm', 55)).toEqual({ kind: 'rain', density: 'storm' });
    });

    it('treats sleet above freezing as rain', () => {
        expect(glassEffectFor('sleet', 34)).toEqual({ kind: 'rain', density: 'rain' });
    });

    it('frosts at and below freezing, harder the colder it is, even while it rains', () => {
        expect(glassEffectFor(null, FREEZING_F)).toEqual({ kind: 'frost', level: 1 });
        expect(glassEffectFor('sleet', 21)).toEqual({ kind: 'frost', level: 1 });
        expect(glassEffectFor(null, 20)).toEqual({ kind: 'frost', level: 2 });
        expect(glassEffectFor(null, 6)).toEqual({ kind: 'frost', level: 2 });
        expect(glassEffectFor(null, 5)).toEqual({ kind: 'frost', level: 3 });
        expect(glassEffectFor(null, -20)).toEqual({ kind: 'frost', level: 3 });
    });

    it('shimmers from 90°F, stronger with the heat, capped at 1', () => {
        const at90 = glassEffectFor(null, HEAT_F);
        const at98 = glassEffectFor(null, 98);
        const at120 = glassEffectFor(null, 120);
        expect(at90).toEqual({ kind: 'heat', intensity: 0.4 });
        expect(at98?.kind).toBe('heat');
        expect((at98 as { intensity: number }).intensity).toBeGreaterThan(0.4);
        expect((at98 as { intensity: number }).intensity).toBeLessThan(1);
        expect(at120).toEqual({ kind: 'heat', intensity: 1 });
    });

    it('lets a hot downpour bead rather than shimmer', () => {
        expect(glassEffectFor('storm', 95)).toEqual({ kind: 'rain', density: 'storm' });
    });

    it('falls back to rain only when the temperature is unknown', () => {
        expect(glassEffectFor('light', null)).toEqual({ kind: 'rain', density: 'rain' });
        expect(glassEffectFor(null, undefined)).toBeNull();
        expect(glassEffectFor(null, NaN)).toBeNull();
    });
});

describe('rain bead geometry', () => {
    const spec = BEAD_SPECS.rain;

    it('keeps every bead inside its strip', () => {
        for (const b of stripBeads(400, GLASS_BAND, spec, 1)) {
            expect(b.along).toBeGreaterThanOrEqual(0);
            expect(b.along).toBeLessThan(400);
            expect(b.across - b.r).toBeGreaterThanOrEqual(0);
            expect(b.across + b.r).toBeLessThanOrEqual(GLASS_BAND);
            expect(b.o).toBeGreaterThan(0);
            expect(b.o).toBeLessThanOrEqual(1);
        }
    });

    it('is seeded: the same inputs give the same beads', () => {
        expect(stripBeads(300, GLASS_BAND, spec, 7)).toEqual(stripBeads(300, GLASS_BAND, spec, 7));
        expect(stripBeads(300, GLASS_BAND, spec, 7)).not.toEqual(stripBeads(300, GLASS_BAND, spec, 8));
    });

    it('keeps existing beads in place when the card grows', () => {
        const short = stripBeads(600, GLASS_BAND, spec, 3);
        const tall = stripBeads(900, GLASS_BAND, spec, 3);
        expect(tall.slice(0, short.length)).toEqual(short);
        expect(tall.length).toBeGreaterThan(short.length);
        const before = interiorBeads(360, 600, GLASS_BAND, spec, 5);
        const after = interiorBeads(360, 900, GLASS_BAND, spec, 5);
        expect(after.slice(0, before.length)).toEqual(before);
    });

    it('keeps interior beads off the band and inside the card', () => {
        for (const b of interiorBeads(360, 1200, GLASS_BAND, spec, 5)) {
            expect(b.x).toBeGreaterThanOrEqual(GLASS_BAND);
            expect(b.x).toBeLessThanOrEqual(360 - GLASS_BAND);
            expect(b.y).toBeGreaterThanOrEqual(GLASS_BAND);
            expect(b.y).toBeLessThan(1200 - GLASS_BAND);
        }
    });

    it('is denser in a storm than in rain, and finest in drizzle', () => {
        const count = (d: keyof typeof BEAD_SPECS) => stripBeads(1000, GLASS_BAND, BEAD_SPECS[d], 9).length;
        expect(count('storm')).toBeGreaterThan(count('rain'));
        expect(count('drizzle')).toBeGreaterThan(count('storm'));
        const maxR = (d: keyof typeof BEAD_SPECS) => Math.max(...stripBeads(1000, GLASS_BAND, BEAD_SPECS[d], 9).map((b) => b.r));
        expect(maxR('drizzle')).toBeLessThan(maxR('rain'));
    });

    it('handles a card that has not laid out yet', () => {
        expect(stripBeads(0, GLASS_BAND, spec, 1)).toEqual([]);
        expect(interiorBeads(10, 10, GLASS_BAND, spec, 1)).toEqual([]);
    });


});

describe('frost geometry', () => {
    it('grows more crystal the harder the freeze', () => {
        const segments = (d: string) => (d.match(/L/g) ?? []).length;
        const light = frostCorner(90, 1, 11);
        const hard = frostCorner(90, 3, 11);
        const total = (a: ReturnType<typeof frostCorner>) => a.paths.reduce((n, d) => n + segments(d), 0);
        expect(total(hard)).toBeGreaterThan(total(light));
        expect(light.paths[2]).toBe(''); // the lightest frost stops at branches
        expect(hard.paths[2]).not.toBe('');
    });

    it('keeps every crystal on its canvas', () => {
        const art = frostCorner(120, 3, 5);
        const nums = art.paths.join(' ').match(/-?\d+(\.\d+)?/g)!.map(Number);
        for (const n of nums) {
            expect(n).toBeGreaterThanOrEqual(0);
            expect(n).toBeLessThanOrEqual(art.size);
        }
        expect(art.sparkles.length).toBeGreaterThan(0);
    });

    it('is seeded', () => {
        expect(frostCorner(100, 2, 3)).toEqual(frostCorner(100, 2, 3));
        expect(frostEdge(300, 4)).toEqual(frostEdge(300, 4));
    });

    it('lines an edge with small crystals', () => {
        const rim = frostEdge(320, 2);
        expect(rim.size).toBe(26);
        expect(rim.paths[0].length).toBeGreaterThan(0);
    });
});

describe('heat geometry', () => {
    it('spreads the heat lines down the card', () => {
        const waves = heatWaves(1);
        expect(waves).toHaveLength(5);
        const ys = waves.map((w) => w.yF);
        expect([...ys].sort((a, b) => a - b)).toEqual(ys);
        expect(ys[0]).toBeLessThan(0.2);
        expect(ys[ys.length - 1]).toBeGreaterThan(0.75);
    });

    it('draws a wave across the full width', () => {
        const d = wavePath(100, 10, 3, 50);
        expect(d.startsWith('M0 ')).toBe(true);
        const xs = d.match(/[ML](-?\d+(\.\d+)?)/g)!.map((m) => Number(m.slice(1)));
        expect(Math.max(...xs)).toBeGreaterThanOrEqual(100);
    });
});


describe('top-edge splashes', () => {
    it('spreads splash points along the edge, more of them the harder it rains', () => {
        const count = (d: keyof typeof BEAD_SPECS) => splashEmitters(360, BEAD_SPECS[d], 1).length;
        expect(count('storm')).toBeGreaterThan(count('rain'));
        expect(count('rain')).toBeGreaterThan(count('drizzle'));
        for (const e of splashEmitters(360, BEAD_SPECS.storm, 1)) {
            expect(e.hits).toHaveLength(SPLASH_HITS);
            for (const x of e.hits) {
                expect(x).toBeGreaterThanOrEqual(14);
                expect(x).toBeLessThanOrEqual(360 - 14);
            }
            expect(e.droplets).toHaveLength(BEAD_SPECS.storm.splashDroplets);
            // Droplets fly both ways.
            expect(e.droplets.some((d) => d.dx < 0)).toBe(true);
            expect(e.droplets.some((d) => d.dx > 0)).toBe(true);
        }
        expect(splashEmitters(0, BEAD_SPECS.rain, 1)).toEqual([]);
    });

    it('repeats keyframes per hit as a valid, wrapping interpolation', () => {
        const r = repeatKeys(4, [[0, 0], [0.1, 1], [0.3, 0]]);
        expect(strictlyIncreasing(r.inputRange)).toBe(true);
        expect(r.inputRange[0]).toBe(0);
        expect(r.inputRange[r.inputRange.length - 1]).toBe(1);
        expect(r.outputRange[r.outputRange.length - 1]).toBe(0);
        expect(r.inputRange).toHaveLength(4 * 3 + 1);
    });

    it('holds one position per hit and cuts between them', () => {
        const r = holdPerHit([10, 50, 90, 30]);
        expect(strictlyIncreasing(r.inputRange)).toBe(true);
        expect(r.outputRange.slice(0, 4)).toEqual([10, 10, 50, 50]);
        expect(r.outputRange[r.outputRange.length - 1]).toBe(10);
    });
});

describe('side frost', () => {
    it('turns an edge rim to run down a side', () => {
        const rim = frostEdge(300, 7);
        const side = transposeArt(rim);
        expect(side.paths[0]).not.toBe(rim.paths[0]);
        expect(transposeArt(side)).toEqual(rim);
        const first = /M(-?[\d.]+) (-?[\d.]+)/.exec(rim.paths[0])!;
        expect(side.paths[0].startsWith(`M${first[2]} ${first[1]}`)).toBe(true);
    });
});

describe('drops running off the top border', () => {
    const spec = BEAD_SPECS.storm;
    const top = stripBeads(360, GLASS_BAND, spec, 101);

    it('start as beads already on the top edge, over the face, spread apart', () => {
        const runners = borderRunners(top, 360, GLASS_BAND, spec.runners, 1);
        expect(runners).toHaveLength(spec.runners);
        for (const r of runners) {
            const bead = top[r.bead];
            expect(r.x).toBe(bead.along);
            expect(r.y).toBe(bead.across);
            expect(r.r).toBeGreaterThanOrEqual(bead.r);
            expect(r.x).toBeGreaterThan(GLASS_BAND);
            expect(r.x).toBeLessThan(360 - GLASS_BAND);
        }
        const xs = runners.map((r) => r.x);
        for (let i = 1; i < xs.length; i++) expect(xs[i] - xs[i - 1]).toBeGreaterThan(40);
    });

    it('takes the biggest beads, and none in drizzle', () => {
        const [r] = borderRunners(top, 360, GLASS_BAND, 1, 1);
        const eligible = top.filter((b) => b.along >= GLASS_BAND + 8 && b.along <= 360 - GLASS_BAND - 8);
        expect(top[r.bead].r).toBe(Math.max(...eligible.map((b) => b.r)));
        expect(borderRunners(top, 360, GLASS_BAND, BEAD_SPECS.drizzle.runners, 1)).toEqual([]);
    });

    it('runs at one steady speed, after sitting and swelling on the edge', () => {
        const [r] = borderRunners(top, 360, GLASS_BAND, 1, 1);
        const tl = runnerTimeline(1000, r);
        expect(0 < tl.restEnd && tl.restEnd < tl.swellEnd && tl.swellEnd < tl.runEnd && tl.runEnd < tl.dryEnd && tl.dryEnd < 1).toBe(true);
        const runMs = (tl.runEnd - tl.swellEnd) * tl.cycleMs;
        expect(tl.distance / runMs).toBeCloseTo(RUNNER_SPEED, 2);
        expect((tl.swellEnd - tl.restEnd) * tl.cycleMs).toBeCloseTo(SWELL_MS, -1);
        // Runs past the bottom of the card.
        expect(tl.distance + r.y).toBeGreaterThan(1000);
    });

    it("doesn't restart a runner's loop for a small change in card height", () => {
        const [r] = borderRunners(top, 360, GLASS_BAND, 1, 1);
        expect(runnerTimeline(1010, r).cycleMs).toBe(runnerTimeline(1090, r).cycleMs);
    });
});

describe('edgeSplashes', () => {
    it('splashes for rain and storms, not drizzle, light rain or sleet', () => {
        expect(edgeSplashes('Rain')).toBe(true);
        expect(edgeSplashes('Heavy Rain')).toBe(true);
        expect(edgeSplashes('Showers')).toBe(true);
        expect(edgeSplashes('Thunderstorms')).toBe(true);
        expect(edgeSplashes('Light Rain')).toBe(false);
        expect(edgeSplashes('Drizzle')).toBe(false);
        expect(edgeSplashes('Sleet')).toBe(false);
        expect(edgeSplashes('Cloudy')).toBe(false);
    });
});
