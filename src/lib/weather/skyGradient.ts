import { weatherGradients } from '../../theme/tokens';
import { lerpColor } from '../../components/WeatherHUD/colorMath';

// ─── Time-of-day sky ────────────────────────────────────────────────────────
// Blends the clear-sky palettes by solar elevation so the background evolves
// continuously rather than flipping on WeatherKit's IsDayTime boolean.
//
// Only clear/sunny conditions use this (see conditions.ts). Under rain, cloud or
// storm the sky is not what you're looking at, and those palettes already carry
// the condition's identity.

type Stops = readonly { elevation: number; colors: readonly string[] }[];

/**
 * Elevation (deg) → palette, from highest sun to deepest night.
 *
 * Two tables, because a given elevation is reached twice a day and the sky does
 * not look the same both times — see the aerosol note in theme/tokens. The
 * daylight and deep-night endpoints are shared: high noon is high noon, and
 * below −16° there is no sunlight left to be asymmetric about. Only the five
 * intermediate bands differ.
 *
 * Bands are kept narrow in hue as well as elevation: any single blend spanning
 * a large hue arc has to pass through colours the sky never actually shows,
 * and holds full saturation while it does. The low-sun stop at +6° halves the
 * long blue → gold journey; the afterglow stop at −7° does the same for
 * gold → violet, which was crossing magenta at full strength.
 */
const DUSK_STOPS: Stops = [
    { elevation:  10, colors: weatherGradients.clearDay },
    { elevation:   6, colors: weatherGradients.lowSun },
    { elevation:   2, colors: weatherGradients.goldenHour },
    { elevation:  -4, colors: weatherGradients.sunset },
    { elevation:  -7, colors: weatherGradients.afterglow },
    { elevation: -10, colors: weatherGradients.blueHour },
    { elevation: -16, colors: weatherGradients.clearNight },
] as const;

const DAWN_STOPS: Stops = [
    { elevation:  10, colors: weatherGradients.clearDay },
    { elevation:   6, colors: weatherGradients.dawnPale },
    { elevation:   2, colors: weatherGradients.dawnGold },
    { elevation:  -4, colors: weatherGradients.dawn },
    { elevation:  -7, colors: weatherGradients.dawnAfterglow },
    { elevation: -10, colors: weatherGradients.dawnBlue },
    { elevation: -16, colors: weatherGradients.clearNight },
] as const;

/**
 * Interpolated sky palette for a solar elevation.
 *
 * Above the first stop and below the last it returns the endpoint palette by
 * reference, so the long flat stretches of midday and night produce a stable
 * value and never retrigger the gradient animation.
 *
 * @param isRising Sun climbing toward noon (see lib/solarPosition). Defaults to
 *   false — the evening table — so existing single-argument callers keep the
 *   behaviour they already had.
 */
export function skyGradientFor(
    elevationDeg: number,
    isRising = false,
): readonly string[] {
    const STOPS = isRising ? DAWN_STOPS : DUSK_STOPS;
    const first = STOPS[0];
    const last = STOPS[STOPS.length - 1];
    if (elevationDeg >= first.elevation) return first.colors;
    if (elevationDeg <= last.elevation) return last.colors;

    for (let i = 0; i < STOPS.length - 1; i++) {
        const hi = STOPS[i];
        const lo = STOPS[i + 1];
        if (elevationDeg <= hi.elevation && elevationDeg > lo.elevation) {
            // Elevation descends as we move down the table, hence hi → lo.
            const t = (hi.elevation - elevationDeg) / (hi.elevation - lo.elevation);
            // Sitting exactly on a stop returns that palette by reference: no
            // allocation, and it keeps the token's own casing rather than
            // lerpColor's lowercase output.
            if (t === 0) return hi.colors;
            return hi.colors.map((c, idx) => lerpColor(c, lo.colors[idx], t));
        }
    }

    return last.colors;
}
