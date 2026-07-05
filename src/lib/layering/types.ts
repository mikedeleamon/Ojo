import type { Forecast } from '../../types';
import type { OutfitSlot } from '../outfit/types';

export interface LayeringResult {
  layers: {
    base: OutfitSlot | null;
    mid: OutfitSlot | null;
    outer: OutfitSlot | null;
  };
  recommendation: string;
  timeline?: { time: string; action: string }[];
  confidence: number;
  /** Weather calls for a mid/outer layer but the chosen outfit doesn't have one — a wardrobe gap, not just "extra layer optional." */
  missingMid: boolean;
  missingOuter: boolean;
}

/**
 * Weather-derived context computed once per weather snapshot.
 * Hoisted outside any per-outfit loop — deriveDayRange, rainForecast, and
 * necessity scoring all depend only on weather + forecasts + settings.
 */
export interface LayeringContext {
  forecasts: Forecast[];
  currentTemp: number;
  windSpeed: number;
  raining: boolean;
  rainForecast: boolean;
  snowing: boolean;
  high: number;
  low: number;
  offset: number;
  tempDelta: number;
  needsMid: boolean;
  needsOuter: boolean;
}
