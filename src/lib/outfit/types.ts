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

export interface OutfitResult {
  status: OutfitStatus;
  headline: string;
  slots: OutfitSlot[];
  notes: string[];
  score: number;
  scoreBreakdown: ScoreBreakdown;
  layering?: LayeringResult;
}

/** Accepts either legacy Set<string> or Map<string, number> (id→daysSinceWorn). */
export type RecentlyWorn = Set<string> | Map<string, number>;
