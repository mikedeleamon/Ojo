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

export type WidgetMode = 'today' | 'trip' | 'empty';

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
  items: OjoWidgetSnapshotItem[];
  /** Present only when mode === 'trip'. */
  trip?: OjoWidgetTripInfo;
  /** Deep link opened on tap, e.g. "ojo://outfit" or "ojo://trip/<id>". */
  deepLink: string;
}

/** App-facing input to updateWidgetSnapshot(). Thumbnails are still remote URLs here. */
export interface WidgetSnapshotInput {
  mode: WidgetMode;
  headline: string;
  tempLine?: string;
  items: {
    id: string;
    role: string;
    /** Remote (R2) image URL; cached to a local thumbnail before writing. */
    imageUrl: string;
  }[];
  trip?: OjoWidgetTripInfo;
  deepLink: string;
}
