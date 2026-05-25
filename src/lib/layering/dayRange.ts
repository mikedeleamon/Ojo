import type { Forecast } from '../../types';

/**
 * Derives a feels-like high/low from the hourly forecast array.
 *
 * Forecast carries raw Temperature only; downstream layering decisions use
 * feels-like values. We apply the current feels-like offset (RealFeel - airTemp)
 * to each forecast value to keep units consistent.
 *
 * Falls back to currentFeelsLike (zero delta) when forecasts are empty.
 */
export const deriveDayRange = (
  forecasts: Forecast[],
  currentAirTemp: number,
  currentFeelsLike: number,
): { high: number; low: number; offset: number } => {
  const offset = currentFeelsLike - currentAirTemp;
  if (forecasts.length === 0) {
    return { high: currentFeelsLike, low: currentFeelsLike, offset };
  }
  const feelsTemps = forecasts.map((f) => f.Temperature.Value + offset);
  return { high: Math.max(...feelsTemps), low: Math.min(...feelsTemps), offset };
};
