/**
 * widget/snapshot.types.ts — the data contract shared with the native WidgetKit
 * extension.
 *
 * `OjoWidgetSnapshot` is serialized to snapshot.json in the App Group container
 * and decoded 1:1 by the Swift TimelineProvider (Phase 2). Keep field names and
 * shapes in sync with the Swift `Codable` structs.
 *
 * `WidgetSnapshotInput` is the app-facing input to `updateWidgetSnapshot` — it
 * is deliberately decoupled from outfit-engine internals so call sites map their
 * own domain objects (OutfitResult, trip selection) into a small, stable shape.
 */

import type { WeatherKind } from '../weather/conditions';

export type WidgetMode = 'today' | 'trip' | 'empty';

/**
 * Why the widget has no outfit to show, so the empty state can give an
 * actionable message instead of one generic line:
 *  - 'no_closet'    — the user hasn't created a closet yet
 *  - 'empty_closet' — a closet exists but has no clothes
 *  - 'insufficient' — has clothes, but not enough to form an outfit (no top+bottom / dress)
 */
export type WidgetEmptyReason = 'no_closet' | 'empty_closet' | 'insufficient';

/**
 * Weather-driven accessory gaps not already visible from the outfit's item
 * thumbnails, most-urgent first (rain risks getting caught out; a missing
 * layer is next most common; boots/UV are more situational). The widget
 * renders these as a small glyph row — see native.ts / OjoWidgetViews.swift.
 */
export type WidgetAlertKind = 'rain' | 'layer' | 'snow' | 'uv';

/**
 * One step of layeringEngine's same-day timeline, e.g. { time: "Afternoon",
 * action: "Remove your denim jacket — warming up" }. `time` is always one of
 * layeringEngine's 7 buckets (Early morning/Morning/Late morning/Early
 * afternoon/Afternoon/Evening/Night); `action` is free text from a small,
 * fixed set of templates (see buildTimeline in layeringEngine.ts) — the widget
 * keyword-matches its known prefixes ("Remove"/"Add"/"Rain starts"/"Rain
 * clears"/"Keep your") to pick an icon, with a generic fallback for others.
 */
export interface WidgetTimelineStep {
  time: string;
  action: string;
}

export interface OjoWidgetUpcomingTrip {
  /** SavedTripFitPlan.id */
  planId: string;
  /** SavedTripFitPlan.destination */
  destination: string;
  /** Whole days from today to the trip's start date (always > 0). */
  daysUntil: number;
  /** Unique packable article count across the trip's planned days (0 while pending — beyond the forecast window). */
  totalItems: number;
  /** SavedTripFitPlan.checkedIds.length */
  packedItems: number;
  /**
   * Arrival-day forecast pulled from the saved plan, pre-converted to the user's
   * unit. Undefined for pending trips (beyond the forecast window, no saved days).
   */
  weather?: OjoWidgetUpcomingTripWeather;
  /**
   * Short, actionable note when a fresh forecast has drifted from the one saved
   * with the plan (e.g. "Forecast colder than when you planned"). Undefined when
   * they still agree, or drift couldn't be checked.
   */
  driftNote?: string;
}

/** Arrival-day forecast for the Trip Countdown widget's weather peek. */
export interface OjoWidgetUpcomingTripWeather {
  high: number;
  low: number;
  /** "F" | "C" — matches `high`/`low`. */
  unit: string;
  /** Short one-word condition, e.g. "Clear". */
  condition?: string;
  /** conditions.ts WeatherKind, for the widget's SF Symbol picker. */
  weatherKind?: string;
  /** Whether the arrival day's forecast calls for precipitation. */
  precip: boolean;
}

export interface OjoWidgetSnapshotItem {
  /** ClothingArticle.id */
  id: string;
  /** OutfitSlot.role, e.g. "top" | "bottom" | "outer" | "footwear" */
  role: string;
  /** Container-relative thumbnail path ("thumbs/<hash>.jpg"), or null when uncached. */
  thumb: string | null;
}

/**
 * Structured weather readout for the redesigned widget — temperature is the
 * hero element, with feels-like / H-L / rain % / sunset as supporting signals.
 * All values are pre-converted to the user's unit on the JS side so Swift only
 * renders. Distinct from `tempLine` (kept for Lock Screen + older snapshots).
 */
export interface OjoWidgetWeather {
  /** Current temperature, rounded, in `unit`. */
  temp: number;
  /** RealFeel, rounded, in `unit`. */
  feelsLike?: number;
  /** Today's high, in `unit`. */
  high?: number;
  /** Today's low, in `unit`. */
  low?: number;
  unit: 'F' | 'C';
  /** Humanized condition title, e.g. "Partly Cloudy". */
  condition?: string;
  /** Chance of precipitation today, 0–100 (WeatherKit daily precipitationChance). */
  rainChance?: number;
  /** UV category text ("Low"…"Extreme") — always present when weather is, unlike `uvIndexText`, which only rides the uv *alert*. */
  uvText?: string;
  /** Formatted local sunset time, e.g. "8:14 PM". */
  sunset?: string;
}

/**
 * One complete outfit the widget can render — the "Change fit" AppIntent cycles
 * through these without waking the app (the widget can't run the outfit
 * engine, so alternates must be pre-written). Index 0 is the primary
 * recommendation and always mirrors the snapshot's top-level fields, which are
 * kept for older widget binaries decoding a new snapshot.
 */
export interface WidgetOutfitVariant {
  headline: string;
  items: OjoWidgetSnapshotItem[];
  layerNote?: string;
  alerts: WidgetAlertKind[];
  uvIndexText?: string;
  timeline?: WidgetTimelineStep[];
}

/** Input-side variant — thumbnails are still remote URLs (see WidgetSnapshotInput.items). */
export interface WidgetOutfitVariantInput {
  headline: string;
  items: { id: string; role: string; imageUrl: string }[];
  layerNote?: string;
  alerts: WidgetAlertKind[];
  uvIndexText?: string;
  timeline?: WidgetTimelineStep[];
}

export interface OjoWidgetTripInfo {
  /** SavedTripFitPlan.destination */
  destination: string;
  /** 1-based position of today within the trip (todayDayIndex). */
  dayIndex: number;
  /** Total trip length in days. */
  dayTotal: number;
  /** Optional actionable note when live weather drifts from the plan (computeDrift). */
  driftNote?: string;
  /** True only when live GPS confirmed the user is within radius of the trip city. */
  locationConfirmed: boolean;
}

/** Exactly what gets written to snapshot.json and read by the widget. */
export interface OjoWidgetSnapshot {
  mode: WidgetMode;
  /** ISO timestamp of when this snapshot was produced. */
  updatedAt: string;
  /** Primary line: outfit headline, or a trip destination line. */
  headline: string;
  /** Optional secondary line, e.g. "72°F · Partly cloudy". */
  tempLine?: string;
  /** Structured weather readout for the hero-temperature layout. Omitted when no weather was available (older snapshots also lack it — Swift falls back to `tempLine`). */
  weather?: OjoWidgetWeather;
  /** Local-weather classification driving the widget's gradient background (see lib/weather/conditions.ts). Omitted only when no weather was available. */
  weatherKind?: WeatherKind;
  /** Local daytime flag; the gradient's day/night variant for 'clear' and 'partlyCloudy'. */
  isDay?: boolean;
  items: OjoWidgetSnapshotItem[];
  /** All renderable outfits for today, primary first — the "Change fit" intent cycles them. Omitted for empty mode and pre-variant snapshots (Swift then treats the top-level fields as the only variant). */
  variants?: WidgetOutfitVariant[];
  /** Short layering call-to-action from layeringEngine's recommendation, e.g. "Bring a jacket — windy after 4pm." Omitted in 'empty' mode. */
  layerNote?: string;
  /** Accessory gaps the outfit thumbnails don't already cover, priority order. Empty when nothing's missing. */
  alerts: WidgetAlertKind[];
  /** UV category text ("High"/"Very High"/"Extreme") for the 'uv' alert's label — same value the app's WeatherDetails "UV Index" stat shows. Present only when the UV alert is active. */
  uvIndexText?: string;
  /** Same-day layer-change steps (layeringEngine's buildTimeline), capped for widget display. Only present on days with a real temperature swing or a precip start/stop — most days this is omitted. */
  timeline?: WidgetTimelineStep[];
  /** Present only when mode === 'empty' — which setup step the user is missing, so the empty state can be specific. */
  emptyReason?: WidgetEmptyReason;
  /** Present only when mode === 'trip'. */
  trip?: OjoWidgetTripInfo;
  /** The soonest saved trip that hasn't started yet, independent of `mode` — powers the separate Trip Countdown widget. */
  upcomingTrip?: OjoWidgetUpcomingTrip;
  /** Deep link opened on tap, e.g. "ojo://outfit" or "ojo://trip/<id>". */
  deepLink: string;
}

/** App-facing input to updateWidgetSnapshot(). Thumbnails are still remote URLs here. */
export interface WidgetSnapshotInput {
  mode: WidgetMode;
  headline: string;
  tempLine?: string;
  weather?: OjoWidgetWeather;
  weatherKind?: WeatherKind;
  isDay?: boolean;
  items: {
    id: string;
    role: string;
    /** Remote (R2) image URL; cached to a local thumbnail before writing. */
    imageUrl: string;
  }[];
  /** All renderable outfits for today, primary first. Index 0 mirrors the top-level fields. */
  variants?: WidgetOutfitVariantInput[];
  layerNote?: string;
  alerts: WidgetAlertKind[];
  uvIndexText?: string;
  timeline?: WidgetTimelineStep[];
  emptyReason?: WidgetEmptyReason;
  trip?: OjoWidgetTripInfo;
  upcomingTrip?: OjoWidgetUpcomingTrip;
  deepLink: string;
}
