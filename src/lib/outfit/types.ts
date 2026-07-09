import type { ClothingArticle, OutfitOccasion } from '../../types';
import type { LayeringResult } from '../layeringEngine';

export type OutfitRole =
  | 'top'
  | 'bottom'
  | 'fullBody'
  | 'midLayer'
  | 'outerwear'
  | 'footwear'
  | 'accessory';

export type WeatherBucket = 'hot' | 'warm' | 'cool' | 'cold' | 'freezing';

export type PrecipIntensity = 'none' | 'light' | 'moderate' | 'heavy';

export type OutfitStatus = 'ok' | 'empty_closet' | 'insufficient';

export interface OutfitSlot {
  role: OutfitRole;
  article: ClothingArticle;
}

export interface ScoreBreakdown {
  fabric: number;
  color: number;
  style: number;
  simplicity: number;
  preference: number;
}

/** Weather-driven accessory gaps the chosen outfit's slots don't already cover — widget glyph source. */
export interface AccessoryAlerts {
  rain:         PrecipIntensity;
  missingBoots: boolean;
  missingHat:   boolean;
  /** UV category text ("High"/"Very High"/"Extreme") when the UV alert is active — same field WeatherDetails' "UV Index" stat shows, so the widget's copy matches the app. */
  uvIndexText?: string;
}

export interface OutfitResult {
  status:          OutfitStatus;
  headline:        string;
  slots:           OutfitSlot[];
  notes:           string[];
  score:           number;
  scoreBreakdown:  ScoreBreakdown;
  layering?:       LayeringResult;
  accessoryAlerts?: AccessoryAlerts;
  /** True when ≥30 logged outfits — preference weight is meaningfully elevated. */
  isPersonalized?: boolean;
  /** When mood-based generation is active, labels the style this outfit was optimized for. */
  moodLabel?:      string;
}

/** Accepts either legacy Set<string> or Map<string, number> (id→daysSinceWorn). */
export type RecentlyWorn = Set<string> | Map<string, number>;

/**
 * Weather + preference snapshot captured at the moment an outfit is worn —
 * the ranker-training "context" field consumed by
 * server/src/scripts/exportTrainingData.ts. Deliberately mirrors the
 * weather-derived values generateOutfits() computes internally, minus the
 * morning forecast-blend (there's no forecast to blend against at wear time).
 */
export interface WearContext {
  feelsLikeF:      number;
  bucket:          WeatherBucket;
  precipIntensity: PrecipIntensity;
  humidity:        number;
  windMph:         number;
  isSnowing:       boolean;
  hourOfDay:       number;
  occasion?:       OutfitOccasion;
  styles:          string[];
}

/** Engine's scoring snapshot for the outfit that was actually worn. */
export interface WornEngineInfo {
  score:         number;
  breakdown:     ScoreBreakdown;
  /** 1-based rank among that generation's results (1 = top-ranked). */
  rank:          number;
  engineVersion: string;
}

export type NegativeSignalSource = 'shown_not_worn';

/** An outfit the engine surfaced but the user didn't wear — a negative training signal. */
export interface NegativeSignal {
  articleIds: string[];
  score:      number;
  source:     NegativeSignalSource;
}
