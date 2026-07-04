/**
 * widget/buildInput.ts — maps the home screen's resolved state (today's outfit +
 * Trip Mode) into a WidgetSnapshotInput. Pure and framework-free so it's unit
 * testable; the React wiring lives in OutfitSuggestion.
 */

import type { CurrentWeather, SavedTripFitPlan, Settings } from '../../types';
import type { OutfitResult } from '../outfit/types';
import { humanizeConditionTitle } from '../weather/humanizeCondition';
import { OUTFIT_DEEP_LINK, tripDeepLink } from './deepLinks';
import type { WidgetSnapshotInput } from './snapshot.types';

const itemsFromOutfit = (outfit: OutfitResult): WidgetSnapshotInput['items'] =>
  outfit.slots.map((s) => ({
    id: s.article._id,
    role: String(s.role),
    imageUrl: s.article.imageUrl ?? '',
  }));

/** "72°F · Mostly Clear" from current weather, honoring the user's unit setting. */
export function formatTempLine(
  weather: CurrentWeather | null | undefined,
  settings: Settings,
): string | undefined {
  if (!weather) return undefined;
  const isMetric = settings.temperatureScale === 'Metric';
  const value = isMetric
    ? weather.Temperature.Metric.Value
    : weather.Temperature.Imperial.Value;
  const temp = `${Math.round(value)}°${isMetric ? 'C' : 'F'}`;
  const cond = humanizeConditionTitle(weather.WeatherText);
  return cond ? `${temp} · ${cond}` : temp;
}

export interface WidgetTripData {
  active: boolean;
  plan: SavedTripFitPlan | null;
  outfit: OutfitResult | null;
  dayIndex: number;
  total: number;
  driftNote: string | null;
  locationConfirmed: boolean;
}

export interface WidgetSyncData {
  todayOutfit: OutfitResult | null;
  weather: CurrentWeather | null | undefined;
  settings: Settings;
  trip: WidgetTripData;
}

/**
 * Trip Mode takes precedence when active with an outfit (mirrors useTripMode /
 * the in-app "single today's-outfit answer" rule); then today's top outfit;
 * else the empty state.
 */
export function buildWidgetInput(data: WidgetSyncData): WidgetSnapshotInput {
  const { trip, todayOutfit, weather, settings } = data;

  if (trip.active && trip.plan && trip.outfit) {
    return {
      mode: 'trip',
      headline: trip.outfit.headline || 'Trip outfit',
      items: itemsFromOutfit(trip.outfit),
      trip: {
        destination: trip.plan.destination,
        dayIndex: trip.dayIndex,
        dayTotal: trip.total,
        driftNote: trip.driftNote ?? undefined,
        locationConfirmed: trip.locationConfirmed,
      },
      deepLink: tripDeepLink(trip.plan.id),
    };
  }

  if (todayOutfit && todayOutfit.slots.length > 0) {
    return {
      mode: 'today',
      headline: todayOutfit.headline || "Today's outfit",
      tempLine: formatTempLine(weather, settings),
      items: itemsFromOutfit(todayOutfit),
      deepLink: OUTFIT_DEEP_LINK,
    };
  }

  return { mode: 'empty', headline: '', items: [], deepLink: OUTFIT_DEEP_LINK };
}
