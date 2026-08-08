// ─── Wind-driven precipitation slant ────────────────────────────────────────
// Turns reported wind into the `rainAngle` StormIconLightning already accepts:
// a fraction of vertical travel applied as horizontal drift (translateX per
// translateY). It changes only the interpolate output range, so a storm in a
// gale costs exactly the same per frame as a storm in still air.

/** Near-vertical, but never perfectly so — real rain always has some drift. */
const MIN_SLANT = 0.02;
/** Matches the documented 0–0.3 ceiling on the rainAngle prop. */
const MAX_SLANT = 0.3;
/** Wind speed (mph) at which the slant reaches MAX_SLANT. */
const FULL_SLANT_MPH = 35;

/**
 * @param speedMph     Wind speed. Undefined → treated as calm.
 * @param directionDeg Degrees the wind blows FROM (meteorological convention:
 *                     0 = from the north, 90 = from the east). Undefined →
 *                     falls back to a rightward drift, matching the previous
 *                     hardcoded default so nothing regresses without the data.
 */
export function rainAngleFor(speedMph?: number, directionDeg?: number): number {
    const speed = typeof speedMph === 'number' && speedMph > 0 ? speedMph : 0;
    const ratio = Math.min(1, speed / FULL_SLANT_MPH);
    const magnitude = MIN_SLANT + (MAX_SLANT - MIN_SLANT) * ratio;

    if (typeof directionDeg !== 'number') return magnitude;

    // Eastward component of the wind vector. Wind FROM the west (270°) blows
    // toward the east, which is rightward on screen, so u is positive there.
    const eastward = -Math.sin((directionDeg * Math.PI) / 180);
    return magnitude * eastward;
}
