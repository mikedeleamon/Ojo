import { GarmentType, DetectedColor, FabricGuess } from './services/clothingIdentifier.types';
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
  Wind: { Speed: { Imperial: { Value: number }; Metric: { Value: number } } };
  RelativeHumidity: number;
  UVIndexText: string;
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

export interface NotificationSettings {
  morningBriefEnabled:    boolean;
  morningBriefHourUTC:    number;   // 0–23 in UTC
  weatherChangeEnabled:   boolean;
  tempSwingEnabled:       boolean;
  tempSwingThresholdF:    number;   // degrees F, default 20
  closetGapEnabled:       boolean;
  weeklyRecapEnabled:     boolean;
  weeklyRecapDay:         number;   // 0=Sun … 6=Sat
  tripPackingEnabled:     boolean;
}

export interface OutfitHistoryEntry {
  id:        string;
  wornAt:    string;
  closetId:  string;
  closetName:string;
  articleIds:string[];
  articleSummary: string;
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
