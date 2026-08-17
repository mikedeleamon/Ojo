/**
 * dayOutfit.ts
 * ────────────
 * Generating an outfit for a *future* day, from that day's daily forecast.
 *
 * Two consumers, both of which need the same thing and neither of which can
 * reach into the other:
 *   • the Tomorrow Prep widget (OutfitSuggestion's snapshot effect)
 *   • the Morning Outfit Brief (useMorningBriefScheduler)
 *
 * This used to live inline in OutfitSuggestion.tsx, which meant it was reachable
 * only from a mounted component. It is pure and synchronous — no storage, no
 * network — so it belongs here where a scheduler can call it too.
 *
 * NOTE on fidelity: a `DailyForecast` carries min/max and a condition code, and
 * nothing else. Everything the outfit engine wants that a daily forecast cannot
 * supply — wind, humidity, UV — is synthesized at a neutral default by
 * `synthesizeDayWeather`. Copy built on top of this must not imply the app knows
 * tomorrow's wind; it doesn't. See `hasHourlyDetail` for the one case where it
 * knows more.
 */

import type {
  ClothingArticle,
  CurrentWeather,
  DailyForecast,
  Forecast,
  Settings,
} from '../../types';
import type { OutfitResult, RecentlyWorn } from './types';
import type { UserPreferenceProfile } from '../userPreferences';
import { generateOutfits } from '../outfitEngine';

/**
 * A `CurrentWeather` synthesized from a single day's forecast, so the engine —
 * which only knows how to reason about "right now" — can score a future day.
 *
 * Temperature is the day's midpoint. Wind (5 mph), humidity (60%) and UV
 * ("Moderate") are neutral placeholders, NOT forecasts: the daily payload has no
 * such fields. Consequences worth knowing before writing copy on top of this:
 *   • layeringEngine's wind note fires at >= 12 mph, so it can never trigger here
 *   • the UV accessory alert fires above "Moderate", so it can never trigger here
 *
 * Exported as `buildTripWeather` from views/TripFit/shared for back-compat.
 */
export function synthesizeDayWeather(day: DailyForecast): CurrentWeather {
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

export interface DayOutfitArgs {
  articles: ClothingArticle[];
  day: DailyForecast;
  settings: Settings;
  worn: RecentlyWorn;
  profile: UserPreferenceProfile;
  /**
   * That day's hourly forecast, when it's within the hourly window (in practice
   * tomorrow only — see HOURLY_WINDOW_H server-side). Supplying it is what earns
   * `layering.timeline`, and therefore any time-of-day advice. Omit it for days
   * further out rather than passing a neighbouring day's hours.
   */
  forecasts?: Forecast[];
}

/**
 * The top-scoring outfit for `day`, or `null` when the closet can't dress it.
 *
 * `null` covers both engine empty-exits: `generateOutfits` returns a one-element
 * array carrying `headline: ''` and `slots: []` for `empty_closet` and
 * `insufficient`, so callers must check `slots.length` rather than `results.length`
 * — checking the latter is how you end up announcing an outfit that has no clothes
 * in it.
 */
export function buildDayOutfit({
  articles,
  day,
  settings,
  worn,
  profile,
  forecasts,
}: DayOutfitArgs): OutfitResult | null {
  const { results } = generateOutfits(
    articles,
    synthesizeDayWeather(day),
    settings,
    worn,
    1,
    profile,
    forecasts ?? [],
  );

  const top = results[0];
  return top && top.slots.length > 0 ? top : null;
}

/**
 * Whether an outfit was built with real hourly data behind it, and can therefore
 * carry time-of-day claims. Copy builders should branch on this rather than
 * assuming a timeline exists — `buildTimeline` also returns undefined on flat,
 * dry days that simply have nothing to say.
 */
export const hasHourlyDetail = (outfit: OutfitResult | null): boolean =>
  !!outfit?.layering?.timeline?.length;
