import type {
    DailyForecast,
    CurrentWeather,
    ClothingArticle,
    SavedTripFitPlan,
    TripFitDaySnapshot,
    TripFitStatus,
} from '../../types';
import { articleCategories } from '../../types';
import type { OutfitResult, OutfitRole } from '../../lib/outfit/types';

// ─── Constants ────────────────────────────────────────────────────────────────

/** WeatherKit's free daily forecast reaches ~10 days out. */
export const FORECAST_WINDOW_DAYS = 10;

export const PACKING_GROUPS: { key: string; label: string; emoji: string }[] = [
    { key: 'top', label: 'Tops', emoji: '👕' },
    { key: 'bottom', label: 'Bottoms', emoji: '👖' },
    { key: 'outerwear', label: 'Outerwear', emoji: '🧥' },
    { key: 'footwear', label: 'Footwear', emoji: '👟' },
    { key: 'accessory', label: 'Accessories', emoji: '👜' },
];

// ─── Day-plan type ──────────────────────────────────────────────────────────────

export interface DayPlan {
    day: DailyForecast;
    candidates: OutfitResult[];
    candidateIdx: number;
}

export const activeOutfit = (p: DayPlan): OutfitResult =>
    p.candidates[p.candidateIdx] ?? p.candidates[0];

// ─── Weather / formatting helpers ───────────────────────────────────────────────

export function buildTripWeather(day: DailyForecast): CurrentWeather {
    const midF = (day.minTempF + day.maxTempF) / 2;
    return {
        WeatherText: day.dayPhrase,
        HasPrecipitation: day.hasPrecipitation,
        PrecipitationType: day.hasPrecipitation ? 'Rain' : null,
        IsDayTime: true,
        Temperature: {
            Imperial: { Value: midF, Unit: 'F' },
            Metric: { Value: (midF - 32) * (5 / 9), Unit: 'C' },
        },
        RealFeelTemperature: {
            Imperial: { Value: midF, Unit: 'F' },
            Metric: { Value: (midF - 32) * (5 / 9), Unit: 'C' },
        },
        Wind: { Speed: { Imperial: { Value: 5 }, Metric: { Value: 8 } } },
        RelativeHumidity: 60,
        UVIndexText: 'Moderate',
    };
}

export function fmtDate(iso: string): string {
    return new Date(iso + 'T12:00:00').toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
    });
}

export function fmtShortDate(d: Date): string {
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function fmtShortISO(iso: string): string {
    return fmtShortDate(new Date(iso + 'T12:00:00'));
}

export function phraseEmoji(phrase: string): string {
    const p = (phrase ?? '').toLowerCase();
    if (p.includes('snow')) return '❄️';
    if (p.includes('rain') || p.includes('shower')) return '🌧️';
    if (p.includes('thunder')) return '⛈️';
    if (p.includes('cloud') || p.includes('overcast')) return '☁️';
    if (p.includes('sun') || p.includes('clear') || p.includes('fair'))
        return '☀️';
    if (p.includes('wind')) return '💨';
    return '🌤️';
}

export function categoryKey(a: ClothingArticle): string {
    if (a.isAccessory) return 'accessory';
    const cat = (
        articleCategories(a)[0] ??
        a.topOrBottom ??
        a.clothingType ??
        ''
    ).toLowerCase();
    if (
        cat.includes('outer') ||
        cat.includes('jacket') ||
        cat.includes('coat') ||
        cat.includes('layer')
    )
        return 'outerwear';
    if (
        cat.includes('shoe') ||
        cat.includes('boot') ||
        cat.includes('foot') ||
        cat.includes('sandal')
    )
        return 'footwear';
    if (
        cat.includes('bottom') ||
        cat.includes('pant') ||
        cat.includes('skirt') ||
        cat.includes('short')
    )
        return 'bottom';
    return 'top';
}

// ─── Date math + trip status ────────────────────────────────────────────────────

const MS_DAY = 86_400_000;

function startOfDay(d: Date): Date {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Whole days from today (local) to an ISO yyyy-mm-dd date. Negative = past. */
export function daysUntil(iso: string): number {
    const target = startOfDay(new Date(iso + 'T12:00:00')).getTime();
    const today = startOfDay(new Date()).getTime();
    return Math.round((target - today) / MS_DAY);
}

/** Derived status — never persisted, always computed from dates + day count. */
export function tripFitStatus(plan: SavedTripFitPlan): TripFitStatus {
    if (daysUntil(plan.endDate) < 0) return 'completed';
    if (!plan.days.length) return 'pending';
    return 'planned';
}

/** True once the trip start is within the forecast window (or already begun). */
export function isInForecastWindow(startDate: string): boolean {
    return daysUntil(startDate) <= FORECAST_WINDOW_DAYS;
}

/** True when a planned trip's forecast snapshot is over a day old. */
export function isForecastStale(plan: SavedTripFitPlan): boolean {
    if (!plan.forecastFetchedAt) return false;
    return Date.now() - new Date(plan.forecastFetchedAt).getTime() > MS_DAY;
}

// ─── Snapshot ⇄ DayPlan conversion ──────────────────────────────────────────────

const EMPTY_BREAKDOWN = {
    fabric: 0,
    color: 0,
    style: 0,
    simplicity: 0,
    preference: 0,
};

/** Rebuild renderable DayPlans from a saved snapshot + the live closet. */
export function rehydratePlans(
    saved: SavedTripFitPlan,
    articles: ClothingArticle[],
): DayPlan[] {
    const byId = new Map(articles.map((a) => [a._id, a]));
    return saved.days.map((d) => {
        const slots = d.articleIds
            .map((id) => byId.get(id))
            .filter((a): a is ClothingArticle => !!a)
            // Derive a real role from the article's category so downstream UIs
            // (e.g. the outfit confirmation card) label each item correctly
            // instead of tagging everything "Top".
            .map((article) => ({ role: categoryKey(article) as OutfitRole, article }));
        const result: OutfitResult = {
            status: 'ok',
            headline: '',
            slots,
            notes: [],
            score: 0,
            scoreBreakdown: { ...EMPTY_BREAKDOWN },
        };
        const day: DailyForecast = {
            date: d.date,
            minTempF: d.minTempF,
            maxTempF: d.maxTempF,
            dayPhrase: d.dayPhrase,
            hasPrecipitation: d.hasPrecipitation,
        };
        return { day, candidates: [result], candidateIdx: 0 };
    });
}

/** Extract the compact, storable snapshot from the active outfit of each day. */
export function snapshotFromPlans(plans: DayPlan[]): TripFitDaySnapshot[] {
    return plans.map((p) => {
        const outfit = activeOutfit(p);
        return {
            date: p.day.date,
            minTempF: p.day.minTempF,
            maxTempF: p.day.maxTempF,
            dayPhrase: p.day.dayPhrase,
            hasPrecipitation: p.day.hasPrecipitation,
            articleIds: outfit ? outfit.slots.map((s) => s.article._id) : [],
        };
    });
}

/** Unique article IDs across every day of a saved plan. */
export function planArticleIds(plan: SavedTripFitPlan): string[] {
    const set = new Set<string>();
    for (const d of plan.days) for (const id of d.articleIds) set.add(id);
    return [...set];
}
