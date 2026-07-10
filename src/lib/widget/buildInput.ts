/**
 * widget/buildInput.ts — maps the home screen's resolved state (today's outfit +
 * Trip Mode) into a WidgetSnapshotInput. Pure and framework-free so it's unit
 * testable; the React wiring lives in OutfitSuggestion.
 */

import type { CurrentWeather, DailyForecast, SavedTripFitPlan, Settings } from '../../types';
import type { OutfitResult } from '../outfit/types';
import { fToC } from '../units';
import { classifyCondition } from '../weather/conditions';
import { humanizeConditionShort, humanizeConditionTitle } from '../weather/humanizeCondition';
import { CLOSET_NEW_DEEP_LINK, OUTFIT_DEEP_LINK, tripDeepLink } from './deepLinks';
import type {
  OjoWidgetUpcomingTrip,
  OjoWidgetWeather,
  WidgetAlertKind,
  WidgetEmptyReason,
  WidgetOutfitVariantInput,
  WidgetSnapshotInput,
  WidgetTimelineStep,
} from './snapshot.types';

/** Today's generation status, including the component-level "no closet selected" case. */
export type WidgetOutfitStatus = 'ok' | 'no_preferred' | 'empty_closet' | 'insufficient';

/** Widget width can't fit layeringEngine's full 5-step timeline; keep the soonest few. */
const MAX_WIDGET_TIMELINE_STEPS = 3;

/** "Change fit" cycles pre-written outfits; cap them to bound snapshot size + thumbnail cache. */
const MAX_WIDGET_VARIANTS = 3;

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
): { layerNote?: string; alerts: WidgetAlertKind[]; uvIndexText?: string; timeline?: WidgetTimelineStep[] } => {
  const alerts: WidgetAlertKind[] = [];
  if ((outfit.accessoryAlerts?.rain ?? 'none') !== 'none') alerts.push('rain');
  if (outfit.layering?.missingMid || outfit.layering?.missingOuter) alerts.push('layer');
  if (outfit.accessoryAlerts?.missingBoots) alerts.push('snow');
  if (outfit.accessoryAlerts?.missingHat) alerts.push('uv');
  return {
    layerNote: outfit.layering?.recommendation,
    alerts,
    // Only meaningful alongside the 'uv' alert; the widget reads it as "UV High" — same category text WeatherDetails shows.
    uvIndexText: outfit.accessoryAlerts?.missingHat ? outfit.accessoryAlerts?.uvIndexText : undefined,
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

/** Local calendar date as "YYYY-MM-DD" — matches DailyForecast.date. */
const localISODate = (d: Date): string => {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

/** Today's entry from the 10-day forecast; falls back to the first entry (which is today in practice). */
const todayDailyFor = (daily?: DailyForecast[]): DailyForecast | undefined => {
  if (!daily || daily.length === 0) return undefined;
  const today = localISODate(new Date());
  return daily.find((d) => d.date === today) ?? daily[0];
};

/** "8:14 PM" from an ISO timestamp — manual format so it doesn't lean on Intl availability. */
const formatSunset = (iso?: string): string | undefined => {
  if (!iso) return undefined;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return undefined;
  const h24 = d.getHours();
  const h = h24 % 12 === 0 ? 12 : h24 % 12;
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${h}:${m} ${h24 >= 12 ? 'PM' : 'AM'}`;
};

/**
 * The widget's structured weather readout, pre-converted to the user's unit so
 * Swift only renders. H/L, rain % and sunset come from today's daily forecast
 * and degrade to undefined when it isn't available (the layout drops them).
 */
export function buildWeatherBlock(
  weather: CurrentWeather | null | undefined,
  settings: Settings,
  daily?: DailyForecast[],
): OjoWidgetWeather | undefined {
  if (!weather) return undefined;
  const isMetric = settings.temperatureScale === 'Metric';
  const today = todayDailyFor(daily);
  return {
    temp: Math.round(
      isMetric ? weather.Temperature.Metric.Value : weather.Temperature.Imperial.Value,
    ),
    feelsLike: Math.round(
      isMetric
        ? weather.RealFeelTemperature.Metric.Value
        : weather.RealFeelTemperature.Imperial.Value,
    ),
    high: today ? (isMetric ? fToC(today.maxTempF) : Math.round(today.maxTempF)) : undefined,
    low: today ? (isMetric ? fToC(today.minTempF) : Math.round(today.minTempF)) : undefined,
    unit: isMetric ? 'C' : 'F',
    condition: humanizeConditionTitle(weather.WeatherText) || undefined,
    rainChance: today?.precipProbability,
    uvText: weather.UVIndexText || undefined,
    sunset: formatSunset(today?.sunset),
  };
}

/** One outfit reshaped for the snapshot's variants array. */
const variantFromOutfit = (outfit: OutfitResult): WidgetOutfitVariantInput => ({
  headline: outfit.headline || "Today's outfit",
  items: itemsFromOutfit(outfit),
  ...widgetAlertsFor(outfit),
});

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
  /** Fresh-vs-saved forecast drift for the arrival day, resolved by useTripMode. */
  driftNote?: string | null;
}

export interface WidgetSyncData {
  /** Today's generated outfits, top-ranked first — index 0 is the primary answer, the rest become "Change fit" variants. */
  todayOutfits: OutfitResult[];
  /** The outfit the user actually logged as worn today, if any. Takes precedence over the generated suggestion — the widget should reflect what they chose, not the top-ranked alternative. */
  wornOutfit: OutfitResult | null;
  /** Today's generation status — drives the empty state's specific message when there's no outfit. */
  outfitStatus: WidgetOutfitStatus;
  /** How many closets the user has — distinguishes "no closet yet" from "empty closet". */
  closetCount: number;
  weather: CurrentWeather | null | undefined;
  settings: Settings;
  /** 10-day daily forecast — today's entry supplies the widget's H/L, rain % and sunset. */
  daily?: DailyForecast[];
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

/**
 * Arrival-day weather peek for the Trip Countdown widget, from the forecast
 * saved with the plan (not a fresh fetch — that only happens for drift). Temps
 * are pre-converted to the user's unit so Swift only renders. Undefined for
 * pending trips whose day list is empty (saved beyond the forecast window).
 */
const upcomingTripWeatherFor = (
  plan: SavedTripFitPlan,
  settings: Settings,
): OjoWidgetUpcomingTrip['weather'] => {
  const arrival = plan.days.find((d) => d.date === plan.startDate) ?? plan.days[0];
  if (!arrival) return undefined;
  const isMetric = settings.temperatureScale === 'Metric';
  return {
    high: isMetric ? fToC(arrival.maxTempF) : Math.round(arrival.maxTempF),
    low: isMetric ? fToC(arrival.minTempF) : Math.round(arrival.minTempF),
    unit: isMetric ? 'C' : 'F',
    condition: humanizeConditionShort(arrival.dayPhrase) || undefined,
    weatherKind: classifyCondition(arrival.dayPhrase),
    precip: arrival.hasPrecipitation,
  };
};

const upcomingTripFor = (
  upcoming: WidgetUpcomingTripData | null,
  settings: Settings,
): OjoWidgetUpcomingTrip | undefined =>
  upcoming
    ? {
        planId: upcoming.plan.id,
        destination: upcoming.plan.destination,
        daysUntil: upcoming.daysUntil,
        totalItems: upcoming.totalItems,
        packedItems: upcoming.packedItems,
        weather: upcomingTripWeatherFor(upcoming.plan, settings),
        driftNote: upcoming.driftNote ?? undefined,
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
  const { trip, todayOutfits, wornOutfit, outfitStatus, closetCount, weather, settings, daily, upcoming } = data;
  const weatherKind = weather ? classifyCondition(weather.WeatherText) : undefined;
  const isDay = weather?.IsDayTime;
  const weatherBlock = buildWeatherBlock(weather, settings, daily);
  const upcomingTrip = upcomingTripFor(upcoming, settings);

  // What the user actually logged as worn today wins over everything else —
  // including Trip Mode and the generated suggestion. The widget should show
  // the outfit they committed to, not the top-ranked alternative. A worn
  // outfit is a commitment, so there's nothing to "change fit" to: one variant.
  if (wornOutfit && wornOutfit.slots.length > 0) {
    return {
      mode: 'today',
      headline: wornOutfit.headline || "Today's outfit",
      tempLine: formatTempLine(weather, settings),
      weather: weatherBlock,
      weatherKind,
      isDay,
      items: itemsFromOutfit(wornOutfit),
      variants: [variantFromOutfit(wornOutfit)],
      ...widgetAlertsFor(wornOutfit),
      upcomingTrip,
      deepLink: OUTFIT_DEEP_LINK,
    };
  }

  // Trip Mode is also a single variant — the alternates come from the everyday
  // generator and would fight the outfit the user planned for this trip.
  if (trip.active && trip.plan && trip.outfit) {
    return {
      mode: 'trip',
      headline: trip.outfit.headline || 'Trip outfit',
      weather: weatherBlock,
      weatherKind,
      isDay,
      items: itemsFromOutfit(trip.outfit),
      variants: [variantFromOutfit(trip.outfit)],
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

  const wearable = todayOutfits.filter((o) => o.slots.length > 0);
  if (wearable.length > 0) {
    const primary = wearable[0];
    return {
      mode: 'today',
      headline: primary.headline || "Today's outfit",
      tempLine: formatTempLine(weather, settings),
      weather: weatherBlock,
      weatherKind,
      isDay,
      items: itemsFromOutfit(primary),
      variants: wearable.slice(0, MAX_WIDGET_VARIANTS).map(variantFromOutfit),
      ...widgetAlertsFor(primary),
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
    weather: weatherBlock,
    weatherKind,
    isDay,
    items: [],
    alerts: [],
    emptyReason,
    upcomingTrip,
    deepLink: emptyReason === 'no_closet' ? CLOSET_NEW_DEEP_LINK : OUTFIT_DEEP_LINK,
  };
}
