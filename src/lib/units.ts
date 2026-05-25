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
