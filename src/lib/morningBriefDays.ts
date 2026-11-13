/**
 * morningBriefDays.ts
 * ───────────────────
 * Builds the rolling window of Morning Outfit Brief copy — one outfit and one
 * notification per upcoming day — from a forecast and a closet.
 *
 * Shared by the two places that refill the window: useMorningBriefScheduler
 * on the home screen, and the background refresh (lib/background/refresh.ts),
 * which rebuilds it when the phone has moved or iOS gives the app background
 * time. Before the background path existed the window only advanced while the
 * app was open, so a week of briefs kept describing whatever city Ojo was last
 * opened in. Copy lives in lib/morningBrief.ts; scheduling in lib/notifications.ts.
 */

import api from '../api/client';
import { authHeaders } from './auth';
import { buildDayOutfit } from './outfit/dayOutfit';
import { buildBriefContent } from './morningBrief';
import { BRIEF_WINDOW_DAYS, utcHourToLocal, type BriefDay } from './notifications';
import type { RecentlyWorn } from './outfit/types';
import type { UserPreferenceProfile } from './userPreferences';
import type {
  ClothingArticle,
  DailyForecast,
  Forecast,
  NotificationSettings,
  Settings,
} from '../types';

/** Local calendar date as "YYYY-MM-DD" — must match DailyForecast.date. */
const localISODate = (d: Date): string => {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

/**
 * Hours belonging to one local calendar day.
 *
 * The 36-hour window only ever fully covers tomorrow, so in practice this
 * returns a useful set for exactly one day and nothing for the rest — which is
 * the intended fidelity gradient, not a bug. Below MIN_HOURS_FOR_TIMELINE a
 * partial day would produce a timeline built on a few stray hours, so we hand
 * back nothing and let the copy fall back to the steady-day phrasing.
 */
const MIN_HOURS_FOR_TIMELINE = 6;

const hoursForDate = (forecasts: Forecast[], dateISO: string): Forecast[] | undefined => {
  const hours = forecasts.filter(f => {
    const t = new Date(f.DateTime);
    return !isNaN(t.getTime()) && localISODate(t) === dateISO;
  });
  return hours.length >= MIN_HOURS_FOR_TIMELINE ? hours : undefined;
};

/** The next BRIEF_WINDOW_DAYS calendar dates, starting tomorrow. */
const upcomingDates = (now: Date): string[] =>
  Array.from({ length: BRIEF_WINDOW_DAYS }, (_, i) =>
    // Calendar arithmetic rather than +24h, so a DST shift can't skip or repeat
    // a date — same reasoning as tomorrowDailyFor in lib/widget/buildInput.
    localISODate(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1 + i)),
  );

/**
 * The hour the brief fires at. Same preference order as NotificationsScreen:
 * the hour the user picked, falling back to deriving it only for accounts that
 * predate morningBriefHourLocal. These are local notifications scheduled with a
 * wall-clock hour, so the OS already handles DST for them — the stale value
 * being avoided here is the derivation, not the trigger.
 */
export const briefLocalHour = (ns: NotificationSettings): number =>
  ns.morningBriefHourLocal ?? Math.round(utcHourToLocal(ns.morningBriefHourUTC ?? 12));

export interface BriefDaysInput {
  daily: DailyForecast[];
  articles: ClothingArticle[];
  settings: Settings;
  worn: RecentlyWorn;
  profile: UserPreferenceProfile;
  /** Display name of the place `daily` describes — it is named in the copy. */
  city?: string;
  /** Coordinates behind `daily`, for the wider hourly window. */
  lat: number;
  lon: number;
  ns: NotificationSettings;
  /** Polled after each await so a superseded run can stop early. */
  isCancelled?: () => boolean;
  now?: Date;
}

/**
 * One brief per upcoming day the forecast covers. Null when the run was
 * cancelled part-way; an empty array when no day could be built.
 */
export async function buildBriefDays({
  daily,
  articles,
  settings,
  worn,
  profile,
  city,
  lat,
  lon,
  ns,
  isCancelled = () => false,
  now = new Date(),
}: BriefDaysInput): Promise<BriefDay[] | null> {
  // Only fetch the wider window when there's actually a brief to build.
  // Hits the server's existing bundle cache, so this costs no WeatherKit
  // call — see HOURLY_WINDOW_H in server/src/lib/weatherKit.ts.
  let extended: Forecast[] = [];
  try {
    const { data } = await api.get<Forecast[]>('/api/weather/hourly', {
      params: { lat, lon, hours: 36 },
      ...authHeaders(),
    });
    if (isCancelled()) return null;
    extended = data ?? [];
  } catch {
    // Degrade to no timeline rather than no brief.
  }

  const byDate = new Map(daily.map(d => [d.date, d]));
  const days: BriefDay[] = [];

  for (const dateISO of upcomingDates(now)) {
    const day = byDate.get(dateISO);
    if (!day) continue; // outside the 10-day forecast

    const outfit = buildDayOutfit({
      articles,
      day,
      settings,
      worn,
      profile,
      forecasts: hoursForDate(extended, dateISO),
    });

    const { title, body } = buildBriefContent({
      day,
      outfit,
      city,
      settings,
      swing: {
        enabled: ns.tempSwingEnabled ?? false,
        thresholdF: ns.tempSwingThresholdF ?? 20,
      },
    });

    days.push({ dateISO, title, body });
  }

  return isCancelled() ? null : days;
}
