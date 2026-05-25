import type { ClothingArticle, CurrentWeather } from '../../types';
import type { WeatherBucket, PrecipIntensity } from './types';

/**
 * Buckets a feels-like temperature using the user's high/low thresholds.
 * - hot: ≥ hi
 * - warm: lo ≤ T < hi
 * - cool: (lo−15) ≤ T < lo
 * - cold: 32 ≤ T < lo−15
 * - freezing: T < 32
 */
export const getWeatherBucket = (
  feelsLikeF: number,
  hiThreshold: number,
  loThreshold: number,
): WeatherBucket => {
  if (feelsLikeF >= hiThreshold) return 'hot';
  if (feelsLikeF >= loThreshold) return 'warm';
  if (feelsLikeF >= loThreshold - 15) return 'cool';
  if (feelsLikeF >= 32) return 'cold';
  return 'freezing';
};

const HARD_EXCLUDE_HOT = new Set(['Coat', 'Gloves', 'Scarf', 'Sweater', 'Hoodie']);
const HARD_EXCLUDE_COLD = new Set(['Sandals', 'Shorts']);
const HARD_EXCLUDE_FREEZING = new Set(['Sandals', 'Shorts', 'Skirt']);

/** Eliminates items that are clearly climatically impossible for the given bucket. */
export const isWeatherAppropriate = (
  a: ClothingArticle,
  bucket: WeatherBucket,
): boolean => {
  if (bucket === 'hot' && HARD_EXCLUDE_HOT.has(a.clothingType)) return false;
  if (bucket === 'freezing' && HARD_EXCLUDE_FREEZING.has(a.clothingType)) return false;
  if (bucket === 'cold' && HARD_EXCLUDE_COLD.has(a.clothingType)) return false;
  return true;
};

/**
 * Grades precipitation on a 0–1 intensity scale.
 * AccuWeather rates (in/hr): light < 0.1, moderate 0.1–0.3, heavy > 0.3.
 * Falls back to WeatherText keywords when Precip1hr is missing.
 */
export const classifyPrecipitation = (weather: CurrentWeather): PrecipIntensity => {
  if (!weather.HasPrecipitation) return 'none';
  const amountInch = weather.Precip1hr?.Imperial?.Value ?? 0;
  if (amountInch >= 0.3) return 'heavy';
  if (amountInch >= 0.1) return 'moderate';
  const text = (weather.WeatherText ?? '').toLowerCase();
  if (text.includes('heavy') || text.includes('downpour')) return 'heavy';
  if (text.includes('shower') || text.includes('storm')) return 'moderate';
  return 'light';
};

/** Multiplier for rain-related fabric adjustments based on intensity. */
export const precipMultiplier = (intensity: PrecipIntensity): number => {
  switch (intensity) {
    case 'none': return 0;
    case 'light': return 0.4;
    case 'moderate': return 0.7;
    case 'heavy': return 1.0;
  }
};

/** AccuWeather UVIndexText values considered high enough to warrant a hat note. */
export const UV_HIGH_LABELS = new Set(['High', 'Very High', 'Extreme']);

/** AccuWeather AirQuality Category values that warrant an air quality note. */
export const AQI_HIGH_LABELS = new Set([
  'Unhealthy for Sensitive Groups', 'Unhealthy', 'Very Unhealthy', 'Hazardous',
]);

/** Pollen Category values that warrant an allergy note. */
export const POLLEN_HIGH_LABELS = new Set(['High', 'Very High']);
