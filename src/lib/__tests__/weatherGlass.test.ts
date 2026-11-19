import {
    BEAD_SPECS,
    FREEZING_F,
    GLASS_BAND,
    HEAT_F,
    CRUMBS_FADE_MS,
    CRUMBS_STAY_MS,
    LINGER_MS,
    REFORM_AT_MS,
    REFORM_MS,
    REGROW_AT_MS,
    REGROW_MS,
    RUN_SPEED,
    RUN_START_SPEED,
    SPLASH_HITS,
    SPOTS_PER_LANE,
    SWELL_MS,
    SWELL_SAG,
    SWELL_SCALE,
    TRAIL_DRY_MS,
    edgeSplashes,
    planRun,
    runBucket,
    runKeyframes,
    runLanes,
    type Keys,
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
    const W = 360;
    const top = stripBeads(W, GLASS_BAND, spec, 101);
    const lanes = runLanes(top, W, GLASS_BAND, spec.runners, 601);
    const height = runBucket(900);
    const interior = interiorBeads(W, height, GLASS_BAND, spec, 503);
    const plans = lanes.flatMap((lane, n) => [0, 1, 2, 3].map((run) => ({ lane, plan: planRun(lane, n, run, height, interior, 601) })));

    it('start from beads already on the top edge, a lane each across the face', () => {
        expect(lanes).toHaveLength(spec.runners);
        lanes.forEach((lane, n) => {
            expect(lane.spots.length).toBeGreaterThan(0);
            expect(lane.spots.length).toBeLessThanOrEqual(SPOTS_PER_LANE);
            for (const spot of lane.spots) {
                const bead = top[spot.bead];
                expect(spot.x).toBe(bead.along);
                expect(spot.y).toBe(bead.across);
                expect(spot.r).toBeGreaterThanOrEqual(bead.r);
                expect(spot.x).toBeGreaterThan(lane.lo);
                expect(spot.x).toBeLessThan(lane.hi);
            }
            expect(lane.lo).toBeGreaterThan(GLASS_BAND);
            expect(lane.hi).toBeLessThan(W - GLASS_BAND);
            if (n > 0) expect(lane.lo).toBeGreaterThanOrEqual(lanes[n - 1].hi);
        });
    });

    it('takes the biggest bead in each lane first, and none in drizzle', () => {
        for (const lane of lanes) {
            const inLane = top.filter((b) => b.along >= lane.lo + 10 && b.along <= lane.hi - 10);
            expect(top[lane.spots[0].bead].r).toBe(Math.max(...inLane.map((b) => b.r)));
        }
        expect(runLanes(top, W, GLASS_BAND, BEAD_SPECS.drizzle.runners, 601)).toEqual([]);
    });

    it('starts each run from the next bead', () => {
        const lane = lanes.find((l) => l.spots.length > 1)!;
        const n = lanes.indexOf(lane);
        const spots = [0, 1].map((run) => planRun(lane, n, run, height, interior, 601).spot);
        expect(spots[0]).not.toBe(spots[1]);
        expect(planRun(lane, n, lane.spots.length, height, interior, 601).spot).toBe(spots[0]);
    });

    it('lets go slowly, picks up speed, and never slows or stalls', () => {
        for (const { plan } of plans) {
            const v = plan.samples.map((p) => p.v);
            expect(v[0]).toBe(RUN_START_SPEED);
            for (let i = 1; i < v.length; i++) expect(v[i]).toBeGreaterThan(v[i - 1]);
            expect(v[v.length - 1]).toBeGreaterThan(RUN_SPEED * 0.95);
            const y = plan.samples.map((p) => p.y);
            for (let i = 1; i < y.length; i++) expect(y[i]).toBeGreaterThan(y[i - 1]);
        }
    });

    it('wanders a few points, inside its lane, and runs off the bottom', () => {
        for (const { lane, plan } of plans) {
            const xs = plan.samples.map((p) => p.x);
            expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(1);
            expect(Math.max(...xs) - Math.min(...xs)).toBeLessThan(16);
            for (const p of plan.samples) {
                expect(p.x).toBeGreaterThanOrEqual(lane.lo);
                expect(p.x).toBeLessThanOrEqual(lane.hi);
            }
            const end = plan.samples[plan.samples.length - 1];
            expect(end.y - end.r).toBeGreaterThan(height);
        }
    });

    it('swallows only beads on its path, each once, and grows with them', () => {
        const all = plans.filter(({ plan }) => plan.eaten.length > 0);
        expect(all.length).toBeGreaterThan(0);
        for (const { lane, plan } of all) {
            expect(new Set(plan.eaten.map((b) => b.bead)).size).toBe(plan.eaten.length);
            for (const b of plan.eaten) {
                expect(interior[b.bead]).toMatchObject({ x: b.x, y: b.y, r: b.r });
                expect(b.x).toBeGreaterThanOrEqual(lane.lo);
                expect(b.x).toBeLessThanOrEqual(lane.hi);
                // Within reach of the drop where it crosses the bead's height.
                const at = plan.samples.reduce((best, p) => (Math.abs(p.y - b.y) < Math.abs(best.y - b.y) ? p : best));
                expect(Math.abs(at.x - b.x)).toBeLessThan(at.r + b.r + 3);
            }
            const r = plan.samples.map((p) => p.r);
            expect(r[r.length - 1]).toBeGreaterThan(r[0]);
        }
    });

    it('never lets two lanes swallow the same bead', () => {
        const first = lanes.map((lane, n) => planRun(lane, n, 0, height, interior, 601).eaten.map((b) => b.bead));
        const flat = first.flat();
        expect(new Set(flat).size).toBe(flat.length);
    });

    it('is the same run every time it is planned', () => {
        expect(planRun(lanes[0], 0, 2, height, interior, 601)).toEqual(planRun(lanes[0], 0, 2, height, interior, 601));
    });

    it("doesn't replan for a small change in card height", () => {
        expect(runBucket(1010)).toBe(runBucket(1090));
        expect(runBucket(120)).toBe(400);
    });

    it('fits the swell, the run and everything after it into one loop', () => {
        for (const { plan } of plans) {
            expect(plan.cycleMs).toBe(Math.round(plan.restMs + SWELL_MS + plan.runMs + LINGER_MS));
            expect(plan.runMs).toBe(plan.samples[plan.samples.length - 1].t);
        }
        expect(Math.max(TRAIL_DRY_MS, CRUMBS_STAY_MS + CRUMBS_FADE_MS, REGROW_AT_MS + REGROW_MS, REFORM_AT_MS + REFORM_MS)).toBeLessThan(LINGER_MS);
    });

    describe('keyframes', () => {
        const isKeys = (v: unknown): v is Keys => !!v && typeof v === 'object' && 'inputRange' in (v as object);
        const at = (k: Keys, t: number) => {
            const i = k.inputRange.findIndex((x) => x >= t);
            if (i <= 0) return k.outputRange[Math.max(i, 0)];
            const f = (t - k.inputRange[i - 1]) / (k.inputRange[i] - k.inputRange[i - 1]);
            return k.outputRange[i - 1] + (k.outputRange[i] - k.outputRange[i - 1]) * f;
        };

        it('are valid interpolations of one 0–1 loop', () => {
            for (const { plan } of plans) {
                const keys = runKeyframes(plan);
                const all = [...Object.values(keys).filter(isKeys), ...keys.stretches.map((s) => s.opacity)];
                expect(all.length).toBeGreaterThan(12);
                for (const k of all) {
                    expect(k.inputRange).toHaveLength(k.outputRange.length);
                    expect(k.inputRange[0]).toBe(0);
                    expect(k.inputRange[k.inputRange.length - 1]).toBe(1);
                    for (let i = 1; i < k.inputRange.length; i++) expect(k.inputRange[i]).toBeGreaterThan(k.inputRange[i - 1]);
                    for (const v of k.outputRange) expect(Number.isFinite(v)).toBe(true);
                }
            }
        });

        it('end every loop the way it starts, so the next run can take over', () => {
            const { plan } = plans[0];
            const keys = runKeyframes(plan);
            for (const k of [keys.dx, keys.dy, keys.scale, keys.stretch, keys.opacity, keys.rimOpacity, keys.tailOpacity, keys.eat, keys.eatOpacity]) {
                expect(k.outputRange[k.outputRange.length - 1]).toBe(k.outputRange[0]);
            }
            // Bead on its spot, at its resting size, tail hidden, swallowed beads back.
            expect([keys.dx.outputRange[0], keys.dy.outputRange[0], keys.scale.outputRange[0]]).toEqual([0, 0, 1]);
            expect(keys.tailOpacity.outputRange[0]).toBe(0);
            expect(keys.eatOpacity.outputRange[0]).toBe(1);
            // The trail and what's left on it have dried by then.
            expect(keys.crumbsOpacity.outputRange[keys.crumbsOpacity.outputRange.length - 1]).toBe(0);
            for (const s of keys.stretches) expect(s.opacity.outputRange[s.opacity.outputRange.length - 1]).toBe(0);
        });

        it('sags and stretches the bead as it swells, then draws the teardrop out with its speed', () => {
            const { plan } = plans[0];
            const keys = runKeyframes(plan);
            const release = (plan.restMs + SWELL_MS) / plan.cycleMs;
            expect(at(keys.scale, release)).toBeCloseTo(SWELL_SCALE, 5);
            expect(at(keys.dy, release)).toBeCloseTo(plan.spot.r * SWELL_SAG, 5);
            const tail = keys.tail.outputRange;
            expect(Math.max(...tail)).toBeGreaterThan(tail[0] * 2);
            expect(Math.max(...tail)).toBeLessThanOrEqual(1);
        });

        it('dries the trail from the top, and covers all of it', () => {
            const keys = runKeyframes(plans[0].plan);
            const driesAt = keys.stretches.map((s) => s.opacity.inputRange[s.opacity.outputRange.indexOf(0)]);
            for (let i = 1; i < driesAt.length; i++) expect(driesAt[i]).toBeGreaterThan(driesAt[i - 1]);
            expect(keys.stretches[0].from).toBe(0);
            expect(keys.stretches[keys.stretches.length - 1].to).toBeCloseTo(keys.trailLength, 5);
            for (let i = 1; i < keys.stretches.length; i++) expect(keys.stretches[i].from).toBe(keys.stretches[i - 1].to);
            for (const s of keys.stretches) {
                expect(s.lead).toBeGreaterThan(0);
                expect(s.lead).toBeLessThanOrEqual(0.6);
            }
            // The window opens as the drop comes down, never back up.
            const reveal = keys.reveal.outputRange;
            for (let i = 1; i < reveal.length; i++) expect(reveal[i]).toBeGreaterThanOrEqual(reveal[i - 1]);
            expect(reveal[reveal.length - 1]).toBeCloseTo(keys.trailLength, 5);
        });

        it('leaves its beads on the trail, behind the drop', () => {
            const { plan } = plans[0];
            const keys = runKeyframes(plan);
            expect(plan.crumbs.length).toBeGreaterThan(3);
            for (const c of plan.crumbs) {
                expect(c.y).toBeGreaterThan(keys.trailTop);
                expect(c.y).toBeLessThan(height);
            }
        });
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
