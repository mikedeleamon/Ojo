/**
 * wearCalendar.ts — outfit history arranged as days: the year strip (a
 * GitHub-style grid colored by what was worn), month grids, and streaks.
 *
 * Pure, in local time throughout: a day is the calendar day on the phone where
 * the outfit was logged, so an outfit logged at 11 pm lands on that day, not the
 * next one in UTC. Weeks start on Sunday.
 */

import type { ClothingArticle, OutfitHistoryEntry } from '../types';

/** Local calendar day as YYYY-MM-DD. */
export function dayKey(d: Date): string {
    const m = d.getMonth() + 1;
    const day = d.getDate();
    return `${d.getFullYear()}-${m < 10 ? '0' : ''}${m}-${day < 10 ? '0' : ''}${day}`;
}

const MS_DAY = 86_400_000;

/** Midnight at the start of `d`'s local day. */
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

/** `d` moved by `n` local days (DST-safe: built from the calendar, not ms). */
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

/** Entries grouped by local day, each day's newest first. Unparseable dates are skipped. */
export function groupByDay(history: OutfitHistoryEntry[]): Map<string, OutfitHistoryEntry[]> {
    const out = new Map<string, OutfitHistoryEntry[]>();
    for (const e of history) {
        const t = new Date(e.wornAt);
        if (Number.isNaN(t.getTime())) continue;
        const k = dayKey(t);
        const list = out.get(k);
        if (list) list.push(e);
        else out.set(k, [e]);
    }
    for (const list of out.values()) {
        list.sort((a, b) => new Date(b.wornAt).getTime() - new Date(a.wornAt).getTime());
    }
    return out;
}

/**
 * The pieces of a logged outfit that still exist, in the order they were logged
 * (core pieces first, accessories last). Deleted pieces drop out.
 */
export function entryArticles(
    entry: OutfitHistoryEntry,
    byId: ReadonlyMap<string, ClothingArticle>,
): ClothingArticle[] {
    const out: ClothingArticle[] = [];
    for (const id of entry.articleIds) {
        const a = byId.get(id);
        if (a) out.push(a);
    }
    return out;
}

/**
 * The color a day is painted in the year strip: the first non-accessory piece
 * with a color, which is the top or full-body piece, the one that sets the look.
 */
export function outfitColor(articles: ClothingArticle[]): string | null {
    const main = articles.find((a) => !a.isAccessory && a.color);
    return main?.color ?? articles.find((a) => a.color)?.color ?? null;
}

// ─── Year strip ─────────────────────────────────────────────────────────────

export interface StripCell {
    key: string;
    /** Outfits logged that day. */
    count: number;
    /** Color name of that day's latest outfit, if it has one. */
    color: string | null;
    isToday: boolean;
    isFuture: boolean;
}

/**
 * The last `weeks` weeks as columns of seven days (Sunday at the top), oldest
 * column first, ending with the week that holds `now`. Days after today are
 * marked future so the last column can show them empty.
 */
export function yearStrip(
    days: ReadonlyMap<string, OutfitHistoryEntry[]>,
    byId: ReadonlyMap<string, ClothingArticle>,
    now: Date,
    weeks = 26,
): StripCell[][] {
    const today = startOfDay(now);
    const thisSunday = addDays(today, -today.getDay());
    const first = addDays(thisSunday, -7 * (weeks - 1));
    const todayKey = dayKey(today);
    const columns: StripCell[][] = [];
    for (let w = 0; w < weeks; w++) {
        const col: StripCell[] = [];
        for (let d = 0; d < 7; d++) {
            const date = addDays(first, w * 7 + d);
            const key = dayKey(date);
            const entries = days.get(key) ?? [];
            col.push({
                key,
                count: entries.length,
                color: entries[0] ? outfitColor(entryArticles(entries[0], byId)) : null,
                isToday: key === todayKey,
                isFuture: date.getTime() > today.getTime(),
            });
        }
        columns.push(col);
    }
    return columns;
}

// ─── Month grids ────────────────────────────────────────────────────────────

export interface MonthDay {
    key: string;
    day: number;
    count: number;
    isToday: boolean;
    isFuture: boolean;
}

export interface MonthGrid {
    /** YYYY-MM */
    key: string;
    year: number;
    /** 0–11 */
    month: number;
    /** Days with at least one outfit logged. */
    daysLogged: number;
    /** Rows of seven, Sunday first; null pads before the 1st and after the last day. */
    weeks: (MonthDay | null)[][];
}

/** Hard cap on months listed, whatever the history's age. */
export const MAX_MONTHS = 36;

/**
 * Month grids from the month of `now` back to the month of the oldest entry,
 * newest first (at least the current month, at most MAX_MONTHS).
 */
export function monthGrids(days: ReadonlyMap<string, OutfitHistoryEntry[]>, now: Date): MonthGrid[] {
    const today = startOfDay(now);
    const todayKey = dayKey(today);
    let oldest = today;
    for (const k of days.keys()) {
        const [y, m, d] = k.split('-').map(Number);
        const date = new Date(y, m - 1, d);
        if (date < oldest) oldest = date;
    }
    const span = (today.getFullYear() - oldest.getFullYear()) * 12 + (today.getMonth() - oldest.getMonth());
    const count = Math.min(MAX_MONTHS, Math.max(0, span) + 1);

    const out: MonthGrid[] = [];
    for (let i = 0; i < count; i++) {
        const first = new Date(today.getFullYear(), today.getMonth() - i, 1);
        const year = first.getFullYear();
        const month = first.getMonth();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const cells: (MonthDay | null)[] = Array.from({ length: first.getDay() }, () => null);
        let daysLogged = 0;
        for (let day = 1; day <= daysInMonth; day++) {
            const date = new Date(year, month, day);
            const key = dayKey(date);
            const n = days.get(key)?.length ?? 0;
            if (n > 0) daysLogged++;
            cells.push({ key, day, count: n, isToday: key === todayKey, isFuture: date > today });
        }
        while (cells.length % 7 !== 0) cells.push(null);
        const weeks: (MonthDay | null)[][] = [];
        for (let r = 0; r < cells.length; r += 7) weeks.push(cells.slice(r, r + 7));
        out.push({ key: `${year}-${month + 1 < 10 ? '0' : ''}${month + 1}`, year, month, daysLogged, weeks });
    }
    return out;
}

// ─── Streaks ────────────────────────────────────────────────────────────────

export interface WearStats {
    /** Consecutive logged days ending today, or yesterday if today isn't logged yet. */
    currentStreak: number;
    longestStreak: number;
    /** Logged days in `now`'s calendar month. */
    daysThisMonth: number;
    totalOutfits: number;
}

export function wearStats(days: ReadonlyMap<string, OutfitHistoryEntry[]>, now: Date): WearStats {
    const today = startOfDay(now);
    let total = 0;
    for (const list of days.values()) total += list.length;

    // Today not logged yet doesn't break the streak; the day isn't over.
    let cursor = days.has(dayKey(today)) ? today : addDays(today, -1);
    let current = 0;
    while (days.has(dayKey(cursor))) {
        current++;
        cursor = addDays(cursor, -1);
    }

    const sorted = [...days.keys()].sort();
    let longest = 0;
    let run = 0;
    let prev: Date | null = null;
    for (const k of sorted) {
        const [y, m, d] = k.split('-').map(Number);
        const date = new Date(y, m - 1, d);
        run = prev && Math.round((date.getTime() - prev.getTime()) / MS_DAY) === 1 ? run + 1 : 1;
        longest = Math.max(longest, run);
        prev = date;
    }

    const monthPrefix = dayKey(today).slice(0, 7);
    const daysThisMonth = sorted.filter((k) => k.startsWith(monthPrefix)).length;

    return { currentStreak: current, longestStreak: longest, daysThisMonth, totalOutfits: total };
}
