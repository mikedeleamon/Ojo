/**
 * widget/buildInput.ts — maps the home screen's resolved state (today's outfit +
 * Trip Mode) into a WidgetSnapshotInput. Pure and framework-free so it's unit
 * testable; the React wiring lives in OutfitSuggestion.
 */

import type { CurrentWeather, SavedTripFitPlan, Settings } from '../../types';
import type { OutfitResult } from '../outfit/types';
import { classifyCondition } from '../weather/conditions';
import { humanizeConditionTitle } from '../weather/humanizeCondition';
import { CLOSET_NEW_DEEP_LINK, OUTFIT_DEEP_LINK, tripDeepLink } from './deepLinks';
import type {
  OjoWidgetUpcomingTrip,
  WidgetAlertKind,
  WidgetEmptyReason,
  WidgetSnapshotInput,
  WidgetTimelineStep,
} from './snapshot.types';

/** Today's generation status, including the component-level "no closet selected" case. */
export type WidgetOutfitStatus = 'ok' | 'no_preferred' | 'empty_closet' | 'insufficient';

/** Widget width can't fit layeringEngine's full 5-step timeline; keep the soonest few. */
const MAX_WIDGET_TIMELINE_STEPS = 3;

const itemsFromOutfit = (outfit: OutfitResult): WidgetSnapshotInput['items'] =>
  outfit.slots.map((s) => ({
    id: s.article._id,
    role: String(s.role),
    imageUrl: s.article.imageUrl ?? '',
  }));

/**
 * Maps an outfit's layering/accessory computation onto the widget's glyph row
 * and timeline strip. Alerts only flag gaps the outfit's own item thumbnails
 * don't already show — a selected outerwear item is visible as a thumbnail,
 * so "layer" only fires when the weather calls for one and the outfit
 * doesn't have it. Timeline is omitted on most days (see buildTimeline) —
 * only real temperature swings or precip start/stop produce one.
 */
const widgetAlertsFor = (
  outfit: OutfitResult,
): { layerNote?: string; alerts: WidgetAlertKind[]; uvIndex?: number; timeline?: WidgetTimelineStep[] } => {
  const alerts: WidgetAlertKind[] = [];
  if ((outfit.accessoryAlerts?.rain ?? 'none') !== 'none') alerts.push('rain');
  if (outfit.layering?.missingMid || outfit.layering?.missingOuter) alerts.push('layer');
  if (outfit.accessoryAlerts?.missingBoots) alerts.push('snow');
  if (outfit.accessoryAlerts?.missingHat) alerts.push('uv');
  return {
    layerNote: outfit.layering?.recommendation,
    alerts,
    // Only meaningful alongside the 'uv' alert; the widget reads it as "UV n".
    uvIndex: outfit.accessoryAlerts?.missingHat ? outfit.accessoryAlerts?.uvIndex : undefined,
    timeline: outfit.layering?.timeline?.slice(0, MAX_WIDGET_TIMELINE_STEPS),
  };
};

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

/** A saved trip that hasn't started yet — mirrors useTripMode's `upcoming`. */
export interface WidgetUpcomingTripData {
  plan: SavedTripFitPlan;
  daysUntil: number;
  totalItems: number;
  packedItems: number;
}

export interface WidgetSyncData {
  todayOutfit: OutfitResult | null;
  /** The outfit the user actually logged as worn today, if any. Takes precedence over the generated suggestion — the widget should reflect what they chose, not the top-ranked alternative. */
  wornOutfit: OutfitResult | null;
  /** Today's generation status — drives the empty state's specific message when there's no outfit. */
  outfitStatus: WidgetOutfitStatus;
  /** How many closets the user has — distinguishes "no closet yet" from "empty closet". */
  closetCount: number;
  weather: CurrentWeather | null | undefined;
  settings: Settings;
  trip: WidgetTripData;
  /** Independent of `trip`/`mode` — powers the separate Trip Countdown widget. */
  upcoming: WidgetUpcomingTripData | null;
}

/**
 * Maps the outfit-engine status + closet count to a specific empty-state reason.
 * "no closet yet" wins over any status because with zero closets there's nothing
 * to generate from; then insufficient (has clothes, can't build) vs empty.
 */
const emptyReasonFor = (
  status: WidgetOutfitStatus,
  closetCount: number,
): WidgetEmptyReason => {
  if (closetCount === 0) return 'no_closet';
  if (status === 'insufficient') return 'insufficient';
  return 'empty_closet'; // empty_closet, or no_preferred while closets exist
};

const upcomingTripFor = (
  upcoming: WidgetUpcomingTripData | null,
): OjoWidgetUpcomingTrip | undefined =>
  upcoming
    ? {
        planId: upcoming.plan.id,
        destination: upcoming.plan.destination,
        daysUntil: upcoming.daysUntil,
        totalItems: upcoming.totalItems,
        packedItems: upcoming.packedItems,
      }
    : undefined;

/**
 * Trip Mode takes precedence when active with an outfit (mirrors useTripMode /
 * the in-app "single today's-outfit answer" rule); then today's top outfit;
 * else the empty state. The weather gradient uses LOCAL weather uniformly
 * across modes — when a trip is GPS-confirmed, local weather already IS the
 * destination's; unconfirmed trips already surface a driftNote for exactly
 * this kind of mismatch, so this isn't a silent inconsistency.
 */
export function buildWidgetInput(data: WidgetSyncData): WidgetSnapshotInput {
  const { trip, todayOutfit, wornOutfit, outfitStatus, closetCount, weather, settings, upcoming } = data;
  const weatherKind = weather ? classifyCondition(weather.WeatherText) : undefined;
  const isDay = weather?.IsDayTime;
  const upcomingTrip = upcomingTripFor(upcoming);

  // What the user actually logged as worn today wins over everything else —
  // including Trip Mode and the generated suggestion. The widget should show
  // the outfit they committed to, not the top-ranked alternative.
  if (wornOutfit && wornOutfit.slots.length > 0) {
    return {
      mode: 'today',
      headline: wornOutfit.headline || "Today's outfit",
      tempLine: formatTempLine(weather, settings),
      weatherKind,
      isDay,
      items: itemsFromOutfit(wornOutfit),
      ...widgetAlertsFor(wornOutfit),
      upcomingTrip,
      deepLink: OUTFIT_DEEP_LINK,
    };
  }

  if (trip.active && trip.plan && trip.outfit) {
    return {
      mode: 'trip',
      headline: trip.outfit.headline || 'Trip outfit',
      weatherKind,
      isDay,
      items: itemsFromOutfit(trip.outfit),
      ...widgetAlertsFor(trip.outfit),
      trip: {
        destination: trip.plan.destination,
        dayIndex: trip.dayIndex,
        dayTotal: trip.total,
        driftNote: trip.driftNote ?? undefined,
        locationConfirmed: trip.locationConfirmed,
      },
      upcomingTrip,
      deepLink: tripDeepLink(trip.plan.id),
    };
  }

  if (todayOutfit && todayOutfit.slots.length > 0) {
    return {
      mode: 'today',
      headline: todayOutfit.headline || "Today's outfit",
      tempLine: formatTempLine(weather, settings),
      weatherKind,
      isDay,
      items: itemsFromOutfit(todayOutfit),
      ...widgetAlertsFor(todayOutfit),
      upcomingTrip,
      deepLink: OUTFIT_DEEP_LINK,
    };
  }

  // Empty state still carries weather (gradient + temp line) when we have it —
  // the widget shows the weather backdrop with a specific setup CTA. The CTA
  // taps straight to closet creation when there's no closet yet; otherwise to
  // the home screen (where adding clothes / building the outfit happens).
  const emptyReason = emptyReasonFor(outfitStatus, closetCount);
  return {
    mode: 'empty',
    headline: '',
    tempLine: formatTempLine(weather, settings),
    weatherKind,
    isDay,
    items: [],
    alerts: [],
    emptyReason,
    upcomingTrip,
    deepLink: emptyReason === 'no_closet' ? CLOSET_NEW_DEEP_LINK : OUTFIT_DEEP_LINK,
  };
}
