import { GarmentType, DetectedColor, FabricGuess } from './services/clothingIdentifier.types';
import type { WeatherBucket, PrecipIntensity, ScoreBreakdown } from './lib/outfit/types';
export type { GarmentType, DetectedColor, FabricGuess };

export type BodyZone = 'Head' | 'Neck' | 'Wrist' | 'Hand' | 'Waist' | 'Ankle' | 'Carried';

export interface ArticleFormData {
  name:               string;
  clothingType:       string;
  topOrBottom:        string;
  clothingCategories: string[];
  /** @deprecated Derived from clothingCategories[0] for server backward compat. */
  clothingCategory?:  string;
  fabricType:         string;
  color:            string;
  gender?:          string;
  isAccessory:      boolean;
  bodyZone?:        BodyZone;
  merchant:         string;
  purchasePrice?:   number;
  imageUrl:         string;
  detectedGarmentType?:      GarmentType;
  detectedColors?:           DetectedColor[];
  detectedFabric?:           FabricGuess;
  identificationConfidence?: number;
}

export interface AuthUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

export interface AuthState {
  user: AuthUser;
  token: string;
}

/** Resolved coordinates for a location query (client-side geocoding result). */
export interface LocationCoords {
  lat:  number;
  lon:  number;
  name: string;
}

export interface CurrentWeather {
  WeatherText: string;                 // Apple WeatherKit conditionCode (e.g. "MostlyClear")
  HasPrecipitation: boolean;
  PrecipitationType?: string | null;   // "Rain", "Snow", "Ice", "Mixed", or null
  Precip1hr?: { Imperial?: { Value: number }; Metric?: { Value: number } };  // last-hour amount
  IsDayTime: boolean;
  Temperature: {
    Imperial: { Value: number; Unit: string };
    Metric: { Value: number; Unit: string };
  };
  RealFeelTemperature: {
    Imperial: { Value: number; Unit: string };
    Metric: { Value: number; Unit: string };
  };
  // Gust / Direction / CloudCover / Visibility are optional: snapshots cached
  // by older clients (weatherCache in AsyncStorage) predate them, and WeatherKit
  // occasionally omits a field. Consumers must treat "absent" as "unknown"
  // rather than zero — 0% cloud and 0 mph gusts are meaningful values.
  Wind: {
    Speed: { Imperial: { Value: number }; Metric: { Value: number } };
    Gust?: { Imperial: { Value: number }; Metric: { Value: number } };
    /** Degrees, direction the wind blows FROM (meteorological convention). */
    Direction?: number;
  };
  RelativeHumidity: number;
  UVIndexText: string;
  /** Sky covered by cloud, 0–100. */
  CloudCover?: number;
  Visibility?: { Imperial: { Value: number }; Metric: { Value: number } };
  // AQI / pollen are not provided by Apple WeatherKit. Kept optional so the
  // outfit engine and UI keep compiling; values are always undefined today
  // (and can be backfilled by a secondary provider later without a refactor).
  AirQualityText?:  string;
  AirQualityIndex?: number;
  PollenCategory?:  string;
}

export interface Forecast {
  IconPhrase: string;        // WeatherKit conditionCode
  Temperature: { Value: number; Unit: string };
  DateTime: string;
  IsDaylight: boolean;
}

/** One day from the WeatherKit 10-day daily forecast, normalised for Ojo. */
export interface DailyForecast {
  date:             string;   // ISO date e.g. "2026-05-26"
  minTempF:         number;
  maxTempF:         number;
  dayPhrase:        string;   // WeatherKit conditionCode
  hasPrecipitation: boolean;
  /** Chance of precipitation for the day, 0–100. Optional: older cached snapshots predate it. */
  precipProbability?: number;
  sunrise?:         string;   // ISO timestamp
  sunset?:          string;   // ISO timestamp
}

export type OutfitOccasion = 'everyday' | 'work' | 'weekend' | 'date' | 'outdoor' | 'athletic';

/** A city the user has saved to switch the weather HUD between. */
export interface SavedLocation {
  id:        string;   // newLocationId()
  name:      string;   // display label, e.g. "London"
  query:     string;   // geocode input: city name or "lat,lon"
  lat:       number;
  lon:       number;
  createdAt: string;   // ISO timestamp
  updatedAt: string;   // ISO timestamp
}

/** A cached weather payload for one location, for instant/offline display. */
export interface WeatherSnapshot {
  weather:   CurrentWeather;
  forecasts: Forecast[];        // hourly
  daily:     DailyForecast[];
  fetchedAt: string;            // ISO timestamp
  place?:    LocationCoords;    // resolved coords + display name, so the city
                                // label paints from cache instead of lagging
                                // behind the async geocode on a warm load.
}

export interface Settings {
  clothingStyles: string[];
  /** @deprecated Read-only — kept for backward compat with old server payloads. Use clothingStyles. */
  clothingStyle?: string;
  location: string;
  /** Coordinates resolved from `location`; sent up so the server cron can call WeatherKit. */
  lat?: number;
  lon?: number;
  temperatureScale: string;
  hiTempThreshold: number;
  lowTempThreshold: number;
  humidityPreference: number;
  gender?:         string;
  occasion?:       OutfitOccasion;  // optional — defaults to 'everyday' if not set
  sensitivities?:  { allergies?: boolean; asthma?: boolean };
  /** Extra cities the user switches the weather HUD between (synced across devices). */
  savedLocations?: SavedLocation[];
  /** Trip Mode: surface a saved trip's logged outfit when you're there. Default on. */
  tripModeEnabled?: boolean;
  /** How close (miles) to a trip city counts as "there". Default 30. */
  tripModeRadiusMi?: number;
}

export interface ClothingArticle {
  _id:                 string;
  clothingType:        string;
  name?:               string;
  topOrBottom?:        string;
  clothingCategories?: string[];
  /** @deprecated Use clothingCategories. Kept for articles saved before multi-category support. */
  clothingCategory?:   string;
  fabricType?:      string;
  color?:           string;
  gender?:          string;
  isAccessory?:     boolean;
  bodyZone?:        BodyZone;
  merchant?:        string;
  purchasePrice?:   number;
  imageUrl?:        string;
  createdAt?:       string;
  detectedGarmentType?:      GarmentType;
  detectedColors?:           DetectedColor[];
  detectedFabric?:           FabricGuess;
  identificationConfidence?: number;
}

/** Returns the article's categories, normalising old single-string articles. */
export const articleCategories = (a: ClothingArticle | ArticleFormData): string[] => {
  if ('clothingCategories' in a && a.clothingCategories?.length) return a.clothingCategories;
  if (a.clothingCategory) return [a.clothingCategory];
  return [];
};

/**
 * What to call an article anywhere it's shown to the user.
 *
 * `name` is optional on the form, and most people never fill it in — so the
 * fallback is what almost every closet actually displays. Falling back to the
 * bare type gave a closet of six identical "Shirt" rows; qualifying it with the
 * color ("Sky Blue Shirt") tells them apart without making anyone type a name.
 *
 * Deliberately computed at read time rather than baked into `name` on save:
 * editing the color of an unnamed article should re-title it, and an article
 * the user *did* name must never be silently rewritten.
 */
export const articleDisplayName = (
  a: Pick<ClothingArticle, 'name' | 'clothingType' | 'color'> | undefined | null,
): string => {
  if (!a) return 'Item';

  const name = a.name?.trim();
  if (name) return name;

  const type  = a.clothingType?.trim();
  const color = a.color?.trim();

  // 'Multi' is the picker's "no single color" option — "Multi Shirt" reads as
  // a typo, so a multicolor article just falls back to its bare type.
  if (type && color && color !== 'Multi') return `${color} ${type}`;
  return type || color || 'Item';
};

export interface NotificationSettings {
  morningBriefEnabled:    boolean;
  /**
   * 0–23 in UTC. DERIVED, and it goes stale at every DST transition — it is the
   * hour the device computed on the day the user last saved. Kept because older
   * clients and the server's legacy scheduling path both still read it.
   * Prefer `morningBriefHourLocal` for anything user-facing.
   */
  morningBriefHourUTC:    number;
  /**
   * 0–23 on the user's own clock — the hour they actually picked, and the
   * durable one. The server pairs it with the device time zone to re-derive the
   * send hour on every cron tick, so the schedule follows DST.
   * Optional: absent on accounts that last saved before this shipped.
   */
  morningBriefHourLocal?: number;
  weatherChangeEnabled:   boolean;
  tempSwingEnabled:       boolean;
  tempSwingThresholdF:    number;   // degrees F, default 20
  closetGapEnabled:       boolean;
  weeklyRecapEnabled:     boolean;
  weeklyRecapDay:         number;   // 0=Sun … 6=Sat
  tripPackingEnabled:     boolean;
  /** Morning "here's today's trip outfit" nudge during a trip. Stored locally. */
  tripModeMorningEnabled: boolean;
  /** Clock-hour-precise push for a same-day temp swing or rain start/stop from
   *  today's layering timeline. Separate from tempSwingEnabled (Morning Brief
   *  copy only) and weatherChangeEnabled (server cron, per-user afternoon) — see
   *  lib/sameDayNudge.ts. */
  sameDayNudgeEnabled:    boolean;
}

/** Weather + settings snapshot captured when an outfit is logged as worn.
 *  Optional on entries: pre-instrumentation logs (and Trip Mode logs, where the
 *  outfit wasn't generated from the current engine run) simply omit it. */
export interface WearContext {
  feelsLikeF:      number;
  bucket:          WeatherBucket;
  precipIntensity: PrecipIntensity;
  humidity:        number;
  windMph:         number;
  isSnowing:       boolean;
  /** Local hour (0–23) at log time. */
  hourOfDay:       number;
  occasion?:       string;
  styles?:         string[];
}

/** What the engine thought of the worn outfit at generation time. */
export interface WearEngineMeta {
  score:         number;
  breakdown:     ScoreBreakdown;
  /** 0-based position among the outfits shown (0 = primary recommendation). */
  rank:          number;
  engineVersion: number;
}

/** An outfit the user saw alongside the worn one but did not pick — a training
 *  negative for the ML style ranker. `swap_rejected` is reserved for the future
 *  "Try This Instead" feature; nothing emits it yet. */
export interface WearNegative {
  articleIds: string[];
  score:      number;
  source:     'shown_not_worn' | 'swap_rejected';
}

export interface OutfitHistoryEntry {
  id:        string;
  wornAt:    string;
  closetId:  string;
  closetName:string;
  articleIds:string[];
  articleSummary: string;
  /** ML-ranker instrumentation — all optional; entries logged before 2026-07 lack them. */
  context?:   WearContext;
  engine?:    WearEngineMeta;
  negatives?: WearNegative[];
}

export interface Closet {
  _id:         string;
  name:        string;
  userId:      string;
  articles:    ClothingArticle[];
  isPreferred: boolean;
  createdAt?:  string;
}

// ─── TripFit saved plans ────────────────────────────────────────────────────────
// Derived, never stored: 'completed' once the end date has passed, 'pending'
// while no outfits exist yet (saved beyond the 10-day forecast window),
// otherwise 'planned'. See src/views/TripFit/shared.ts → tripFitStatus().
export type TripFitStatus = 'pending' | 'planned' | 'completed';

/** Compact per-day snapshot: forecast + the chosen outfit's article IDs. */
export interface TripFitDaySnapshot {
  date:             string;   // ISO yyyy-mm-dd
  minTempF:         number;
  maxTempF:         number;
  dayPhrase:        string;   // WeatherKit conditionCode
  hasPrecipitation: boolean;
  articleIds:       string[];
}

export interface SavedTripFitPlan {
  id:                   string;   // client-generated
  name?:                string;   // optional nickname
  destination:          string;
  lat:                  number;
  lon:                  number;
  startDate:            string;   // ISO yyyy-mm-dd
  endDate:              string;   // ISO yyyy-mm-dd
  occasion:             OutfitOccasion;
  closetId:             string;
  days:                 TripFitDaySnapshot[];  // empty while status === 'pending'
  checkedIds:           string[];              // packed article IDs
  forecastFetchedAt?:   string;   // ISO timestamp of the forecast snapshot
  sourceAirlineTripId?: string;   // links to a Gmail/airline Trip if seeded from one
  createdAt:            string;
  updatedAt:            string;
}
