/**
 * widget/tomorrowOutfit.ts — tomorrow's outfit for the Tomorrow Prep widget.
 *
 * Generated from tomorrow's daily forecast through the same synthetic-
 * CurrentWeather path TripFit uses for future days (buildTripWeather). Shared by
 * OutfitSuggestion and the background refresh so both produce the same answer.
 */

import { generateOutfits } from '../outfitEngine';
import { buildTripWeather } from '../../views/TripFit/shared';
import { tomorrowDailyFor, type WidgetTomorrowData } from './buildInput';
import type { RecentlyWorn } from '../outfit/types';
import type { UserPreferenceProfile } from '../userPreferences';
import type { ClothingArticle, DailyForecast, Settings } from '../../types';

/**
 * Null when tomorrow is outside the daily data (the widget then falls back to
 * today). Weather-only (null outfit) when there is no closet to dress from or
 * generation can't produce a wearable fit, so the widget can still show
 * tomorrow's forecast.
 */
export function buildTomorrowForWidget({
  daily,
  articles,
  settings,
  worn,
  profile,
}: {
  daily: DailyForecast[] | undefined;
  /** The preferred closet's articles, or null when there's no preferred closet. */
  articles: ClothingArticle[] | null;
  settings: Settings;
  worn: RecentlyWorn;
  profile: UserPreferenceProfile;
}): WidgetTomorrowData | null {
  const day = tomorrowDailyFor(daily);
  if (!day) return null;
  if (!articles) return { day, outfit: null };
  const { results } = generateOutfits(articles, buildTripWeather(day), settings, worn, 1, profile);
  const top = results[0];
  return { day, outfit: top && top.slots.length > 0 ? top : null };
}
