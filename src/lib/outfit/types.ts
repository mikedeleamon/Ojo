import type { ClothingArticle } from '../../types';
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
