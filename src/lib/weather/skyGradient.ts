import { weatherGradients } from '../../theme/tokens';
import { hexToRgb, lerpColor, rgbToHex } from '../../components/WeatherHUD/colorMath';

// ─── Time-of-day sky ────────────────────────────────────────────────────────
// Blends the clear-sky palettes by solar elevation so the background evolves
// continuously rather than flipping on WeatherKit's IsDayTime boolean.
//
// Clear and sunny conditions use this as it is, and partly cloudy uses it
// greyed (partlyCloudyGradientFor, below; see conditions.ts). Under rain,
// overcast or storm the sky is not what you're looking at, and those palettes
// already carry the condition's identity.

/** A named stage of the clear sky — the key of its palette in weatherGradients. */
export type SkyStage =
    | 'clearDay' | 'lowSun' | 'goldenHour' | 'sunset' | 'afterglow' | 'blueHour' | 'clearNight'
    | 'dawnPale' | 'dawnGold' | 'dawn' | 'dawnAfterglow' | 'dawnBlue';

type Stops = readonly { stage: SkyStage; elevation: number; colors: readonly string[] }[];

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
export const DUSK_STOPS: Stops = [
    { stage: 'clearDay',   elevation:  10, colors: weatherGradients.clearDay },
    { stage: 'lowSun',     elevation:   6, colors: weatherGradients.lowSun },
    { stage: 'goldenHour', elevation:   2, colors: weatherGradients.goldenHour },
    { stage: 'sunset',     elevation:  -4, colors: weatherGradients.sunset },
    { stage: 'afterglow',  elevation:  -7, colors: weatherGradients.afterglow },
    { stage: 'blueHour',   elevation: -10, colors: weatherGradients.blueHour },
    { stage: 'clearNight', elevation: -16, colors: weatherGradients.clearNight },
] as const;

export const DAWN_STOPS: Stops = [
    { stage: 'clearDay',      elevation:  10, colors: weatherGradients.clearDay },
    { stage: 'dawnPale',      elevation:   6, colors: weatherGradients.dawnPale },
    { stage: 'dawnGold',      elevation:   2, colors: weatherGradients.dawnGold },
    { stage: 'dawn',          elevation:  -4, colors: weatherGradients.dawn },
    { stage: 'dawnAfterglow', elevation:  -7, colors: weatherGradients.dawnAfterglow },
    { stage: 'dawnBlue',      elevation: -10, colors: weatherGradients.dawnBlue },
    { stage: 'clearNight',    elevation: -16, colors: weatherGradients.clearNight },
] as const;

/**
 * The palette stop closest to a sun position. The live sky blends between
 * stops; things that can only show one fixed sky (the pre-rendered story
 * loops) show the nearest stop instead.
 */
export function nearestSkyStage(elevationDeg: number, isRising = false): SkyStage {
    const STOPS = isRising ? DAWN_STOPS : DUSK_STOPS;
    let best = STOPS[0];
    for (const stop of STOPS) {
        if (Math.abs(stop.elevation - elevationDeg) < Math.abs(best.elevation - elevationDeg)) best = stop;
    }
    return best.stage;
}

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

// ─── Partly cloudy ──────────────────────────────────────────────────────────
// A partly cloudy sky is still the sky: you can see blue between the clouds at
// noon and the sunset between them in the evening. So it follows the sun like a
// clear sky does, with the colour taken down by the cloud. The clouds
// themselves are drawn over it (CloudDrift).

/** The cloud grey a partly cloudy sky is mixed toward. */
export const CLOUD_GREY = '#9AA8B5';
/** How far toward CLOUD_GREY a partly cloudy sky goes in full daylight. */
export const PARTLY_CLOUDY_GREYING = 0.35;

/** The greying is full from the day stop up, and gone by the night stop. */
const GREYING_FULL_AT = DUSK_STOPS[0].elevation;
const GREYING_GONE_AT = DUSK_STOPS[DUSK_STOPS.length - 1].elevation;

/**
 * A straight RGB mix toward the grey. Not lerpColor: that blends hue the long
 * way round to keep skies from turning green, which would send a golden
 * horizon through pink on its way to grey.
 */
export function greyedSky(colors: readonly string[], amount: number): string[] {
    const grey = hexToRgb(CLOUD_GREY);
    return colors.map((c) => {
        const rgb = hexToRgb(c);
        return rgbToHex(
            rgb[0] + (grey[0] - rgb[0]) * amount,
            rgb[1] + (grey[1] - rgb[1]) * amount,
            rgb[2] + (grey[2] - rgb[2]) * amount,
        ).toUpperCase();
    });
}

/**
 * The partly cloudy palette for a solar elevation: the clear sky for that
 * moment, greyed. The greying eases off as the light goes, because a night sky
 * mixed toward daylight grey turns to slate; by night it is the clear-night
 * palette, as it always was.
 *
 * Like skyGradientFor, the flat stretches return a token by reference: midday
 * is weatherGradients.partlyCloudy and night is weatherGradients.clearNight.
 */
export function partlyCloudyGradientFor(elevationDeg: number, isRising = false): readonly string[] {
    if (elevationDeg >= GREYING_FULL_AT) return weatherGradients.partlyCloudy;
    if (elevationDeg <= GREYING_GONE_AT) return weatherGradients.clearNight;
    const daylight = (elevationDeg - GREYING_GONE_AT) / (GREYING_FULL_AT - GREYING_GONE_AT);
    return greyedSky(skyGradientFor(elevationDeg, isRising), PARTLY_CLOUDY_GREYING * daylight);
}
