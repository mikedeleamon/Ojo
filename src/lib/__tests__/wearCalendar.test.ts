import type { ClothingArticle, OutfitHistoryEntry } from '../../types';
import {
    MAX_MONTHS,
    dayKey,
    entryArticles,
    groupByDay,
    monthGrids,
    outfitColor,
    wearStats,
    yearStrip,
} from '../wearCalendar';

const at = (y: number, m: number, d: number, h = 9) => new Date(y, m - 1, d, h, 0, 0);

let n = 0;
const entry = (when: Date, articleIds: string[] = ['top']): OutfitHistoryEntry => ({
    id: `e${n++}`,
    wornAt: when.toISOString(),
    closetId: 'c',
    closetName: 'Closet',
    articleIds,
    articleSummary: articleIds.join(', '),
});

const article = (id: string, extra: Partial<ClothingArticle> = {}): ClothingArticle => ({
    _id: id,
    clothingType: 'T-Shirt',
    ...extra,
});

// Friday 13 November 2026, mid-afternoon.
const NOW = at(2026, 11, 13, 15);

describe('dayKey + groupByDay', () => {
    it('keys local calendar days, zero-padded', () => {
        expect(dayKey(at(2026, 3, 7))).toBe('2026-03-07');
        expect(dayKey(at(2026, 11, 13, 23))).toBe('2026-11-13');
    });

    it('groups by local day, newest first within a day, skipping bad dates', () => {
        const morning = entry(at(2026, 11, 12, 8));
        const night = entry(at(2026, 11, 12, 22));
        const other = entry(at(2026, 11, 10));
        const bad = { ...entry(at(2026, 11, 1)), wornAt: 'not a date' };
        const days = groupByDay([morning, other, night, bad]);
        expect([...days.keys()].sort()).toEqual(['2026-11-10', '2026-11-12']);
        expect(days.get('2026-11-12')!.map((e) => e.id)).toEqual([night.id, morning.id]);
    });
});

describe('outfit pieces and color', () => {
    const byId = new Map([
        ['top', article('top', { color: 'Navy' })],
        ['bottom', article('bottom', { color: 'Khaki' })],
        ['scarf', article('scarf', { color: 'Red', isAccessory: true })],
    ]);

    it('keeps the logged order and drops deleted pieces', () => {
        const e = entry(NOW, ['top', 'gone', 'bottom']);
        expect(entryArticles(e, byId).map((a) => a._id)).toEqual(['top', 'bottom']);
    });

    it('paints a day in its main piece, never an accessory when there is one', () => {
        expect(outfitColor([byId.get('scarf')!, byId.get('top')!])).toBe('Navy');
        expect(outfitColor([byId.get('scarf')!])).toBe('Red');
        expect(outfitColor([article('x')])).toBeNull();
    });
});

describe('yearStrip', () => {
    const byId = new Map([['top', article('top', { color: 'Sage' })]]);

    it('ends with the week holding today, Sunday at the top', () => {
        const strip = yearStrip(groupByDay([]), byId, NOW, 26);
        expect(strip).toHaveLength(26);
        const last = strip[25];
        expect(last[0].key).toBe('2026-11-08'); // Sunday
        expect(last[5]).toMatchObject({ key: '2026-11-13', isToday: true, isFuture: false });
        expect(last[6]).toMatchObject({ key: '2026-11-14', isFuture: true });
        expect(strip[0][0].key).toBe('2026-05-17');
    });

    it('colors logged days by their latest outfit', () => {
        const strip = yearStrip(groupByDay([entry(at(2026, 11, 11)), entry(at(2026, 11, 11, 18))]), byId, NOW, 2);
        const wed = strip[1][3];
        expect(wed).toMatchObject({ key: '2026-11-11', count: 2, color: 'Sage' });
        expect(strip[1][2]).toMatchObject({ count: 0, color: null });
    });
});

describe('monthGrids', () => {
    it('always has the current month, padded to whole Sunday-first weeks', () => {
        const [nov] = monthGrids(groupByDay([]), NOW);
        expect(nov).toMatchObject({ key: '2026-11', year: 2026, month: 10, daysLogged: 0 });
        // 1 Nov 2026 is a Sunday: no leading pad; 30 days → 5 rows.
        expect(nov.weeks[0][0]).toMatchObject({ day: 1 });
        expect(nov.weeks).toHaveLength(5);
        for (const row of nov.weeks) expect(row).toHaveLength(7);
        expect(nov.weeks[4].filter(Boolean)).toHaveLength(2);
        const today = nov.weeks.flat().find((c) => c?.isToday);
        expect(today?.day).toBe(13);
        expect(nov.weeks.flat().find((c) => c?.day === 14)?.isFuture).toBe(true);
    });

    it('runs back to the oldest entry, newest month first, counting logged days', () => {
        const days = groupByDay([entry(at(2026, 9, 30)), entry(at(2026, 9, 30, 20)), entry(at(2026, 10, 2))]);
        const grids = monthGrids(days, NOW);
        expect(grids.map((g) => g.key)).toEqual(['2026-11', '2026-10', '2026-09']);
        expect(grids[2].daysLogged).toBe(1);
        // 1 Sep 2026 is a Tuesday: two blanks first.
        expect(grids[2].weeks[0].slice(0, 3)).toEqual([null, null, expect.objectContaining({ day: 1 })]);
        expect(grids[2].weeks.flat().find((c) => c?.day === 30)?.count).toBe(2);
    });

    it('caps very old histories', () => {
        const grids = monthGrids(groupByDay([entry(at(2019, 1, 1))]), NOW);
        expect(grids).toHaveLength(MAX_MONTHS);
    });
});

describe('wearStats', () => {
    it('counts a streak through yesterday while today is still open', () => {
        const days = groupByDay([entry(at(2026, 11, 12)), entry(at(2026, 11, 11)), entry(at(2026, 11, 9))]);
        expect(wearStats(days, NOW)).toMatchObject({ currentStreak: 2, longestStreak: 2 });
    });

    it('includes today once it is logged, and finds the longest run', () => {
        const days = groupByDay([
            entry(at(2026, 11, 13)),
            entry(at(2026, 11, 12)),
            entry(at(2026, 10, 1)),
            entry(at(2026, 10, 2)),
            entry(at(2026, 10, 3)),
            entry(at(2026, 10, 4)),
            entry(at(2026, 10, 4, 19)),
        ]);
        expect(wearStats(days, NOW)).toEqual({
            currentStreak: 2,
            longestStreak: 4,
            daysThisMonth: 2,
            totalOutfits: 7,
        });
    });

    it('has no streak when the last log is older than yesterday', () => {
        expect(wearStats(groupByDay([entry(at(2026, 11, 10))]), NOW).currentStreak).toBe(0);
        expect(wearStats(groupByDay([]), NOW)).toEqual({ currentStreak: 0, longestStreak: 0, daysThisMonth: 0, totalOutfits: 0 });
    });

    it('runs across a DST change', () => {
        // US clocks go back on 1 Nov 2026.
        const days = groupByDay([entry(at(2026, 10, 31)), entry(at(2026, 11, 1)), entry(at(2026, 11, 2))]);
        expect(wearStats(days, at(2026, 11, 2, 12)).currentStreak).toBe(3);
        expect(wearStats(days, at(2026, 11, 2, 12)).longestStreak).toBe(3);
    });
});
