import type { Settings } from '../../types';

/**
 * How far below the user's low threshold the cool band ends and an outer layer
 * becomes necessary. getWeatherBucket's cool→cold boundary and the layering
 * engine's outer-layer threshold both read this, so the headline, the outfit
 * card and the layering sentence can't disagree about when a jacket is needed.
 */
export const OUTER_LAYER_OFFSET_F = 15;

/** Feels-like temperatures (°F) below which each layer is needed. */
export const layerThresholds = (s: Settings) => ({
  midBelow:   s.lowTempThreshold,
  outerBelow: s.lowTempThreshold - OUTER_LAYER_OFFSET_F,
});
