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
}

export interface OjoWidgetSnapshotItem {
  /** ClothingArticle.id */
  id: string;
  /** OutfitSlot.role, e.g. "top" | "bottom" | "outer" | "footwear" */
  role: string;
  /** Container-relative thumbnail path ("thumbs/<hash>.jpg"), or null when uncached. */
  thumb: string | null;
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
  /** Local-weather classification driving the widget's gradient background (see lib/weather/conditions.ts). Omitted only when no weather was available. */
  weatherKind?: WeatherKind;
  /** Local daytime flag; the gradient's day/night variant for 'clear' and 'partlyCloudy'. */
  isDay?: boolean;
  items: OjoWidgetSnapshotItem[];
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
  weatherKind?: WeatherKind;
  isDay?: boolean;
  items: {
    id: string;
    role: string;
    /** Remote (R2) image URL; cached to a local thumbnail before writing. */
    imageUrl: string;
  }[];
  layerNote?: string;
  alerts: WidgetAlertKind[];
  uvIndexText?: string;
  timeline?: WidgetTimelineStep[];
  emptyReason?: WidgetEmptyReason;
  trip?: OjoWidgetTripInfo;
  upcomingTrip?: OjoWidgetUpcomingTrip;
  deepLink: string;
}
