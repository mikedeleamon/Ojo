/** Fahrenheit → Celsius, rounded to nearest integer. */
export const fToC = (f: number): number => Math.round(((f - 32) * 5) / 9);

/** Celsius → Fahrenheit, rounded to nearest integer. */
export const cToF = (c: number): number => Math.round((c * 9) / 5 + 32);

/**
 * Formats a Fahrenheit temperature for display in the user's preferred scale.
 * Mirrors the backend `tempLabel()` rounding so push notifications and the
 * in-app HUD agree.
 */
export const formatTemp = (
    fahrenheit: number,
    scale: 'imperial' | 'metric' = 'imperial',
): string => {
    if (scale === 'metric') return `${fToC(fahrenheit)}°C`;
    return `${Math.round(fahrenheit)}°F`;
};

export type TempScale = 'imperial' | 'metric';

/** The user's temperature scale, from Settings.temperatureScale ('Metric' | 'Imperial'). */
export const tempScaleOf = (settings: { temperatureScale?: string }): TempScale =>
    settings.temperatureScale === 'Metric' ? 'metric' : 'imperial';

/** A Fahrenheit reading as whole degrees in the user's scale. */
export const degreesIn = (fahrenheit: number, scale: TempScale): number =>
    scale === 'metric' ? fToC(fahrenheit) : Math.round(fahrenheit);

/** "41°–55°F" or "5°–13°C" from a Fahrenheit low and high. */
export const formatTempRange = (minF: number, maxF: number, scale: TempScale): string =>
    `${degreesIn(minF, scale)}°–${degreesIn(maxF, scale)}°${scale === 'metric' ? 'C' : 'F'}`;
