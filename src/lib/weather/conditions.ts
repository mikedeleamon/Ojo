import { weatherGradients } from '../../theme/tokens';
import { skyGradientFor } from './skyGradient';

/**
 * Single source of truth for interpreting Apple WeatherKit `conditionCode`
 * strings (e.g. "MostlyClear", "HeavyRain", "Thunderstorms", "BlowingSnow").
 *
 * Previously the icon picker (WeatherIconDisplay), the gradient/footer palette
 * (weatherPalette), and WeatherHUD's background flags each ran their own
 * substring decision tree. They had already drifted (fog → cloudy icon but
 * foggy gradient; "freez" vs "freeze" mismatches). Now everything derives from
 * one `classifyCondition` call plus one co-located KIND_STYLES table, so the
 * three outputs can't desync.
 */

export type WeatherKind =
    | 'thunderstorm'
    | 'snow'
    | 'ice'
    | 'drizzle'
    | 'rain'
    | 'hot'
    | 'fog'
    | 'haze'
    | 'sunny'
    | 'clear'
    | 'partlyCloudy'
    | 'cloudy';

/** The eight internal icon variants WeatherIconDisplay knows how to render. */
export type WeatherIconType =
    | 'storm'
    | 'snow'
    | 'rainy'
    | 'sunny'
    | 'clear-night'
    | 'partly-cloudy'
    | 'partly-cloudy-night'
    | 'cloudy';

/**
 * Ordered substring rules — first match wins. This is the ONLY place condition
 * text is interpreted; day/night is applied downstream by the KIND_STYLES
 * accessors. Substring-based so it tolerates free-form phrases too.
 */
export function classifyCondition(condition: string): WeatherKind {
    const c = condition.toLowerCase();

    if (
        c.includes('thunder') ||
        c.includes('storm') ||
        c.includes('hurricane') ||
        c.includes('t-storm')
    )
        return 'thunderstorm';
    if (
        c.includes('sleet') ||
        c.includes('hail') ||
        c.includes('freez') ||
        c.includes('ice') ||
        c.includes('wintry')
    )
        return 'ice';
    if (c.includes('snow') || c.includes('flurr') || c.includes('blizzard'))
        return 'snow';
    if (c.includes('drizzle') || c.includes('sprinkle')) return 'drizzle';
    if (c.includes('rain') || c.includes('shower') || c.includes('precip'))
        return 'rain';
    if (c.includes('hot')) return 'hot';
    if (c.includes('fog') || c.includes('mist')) return 'fog';
    if (c.includes('haz') || c.includes('smok') || c.includes('dust'))
        return 'haze';
    if (c.includes('sunny')) return 'sunny';
    if (c.includes('clear')) return 'clear';
    if (c.includes('partly') || c.includes('intermittent'))
        return 'partlyCloudy';
    if (c.includes('cloud') || c.includes('overcast') || c.includes('dreary'))
        return 'cloudy';

    return 'clear'; // unknown → resolves to sunny (day) / clear-night (night)
}

interface KindStyle {
    icon: (isDay: boolean) => WeatherIconType;
    gradient: (isDay: boolean) => readonly string[];
    footerBg: (isDay: boolean) => string;
}

// Each row defines icon + gradient + footer together so a change to one is made
// next to the others. day/night-dependent values are functions of `isDay`.
const KIND_STYLES: Record<WeatherKind, KindStyle> = {
    thunderstorm: {
        icon: () => 'storm',
        gradient: () => weatherGradients.stormy,
        footerBg: () => 'rgba(10,8,28,0.97)',
    },
    snow: {
        icon: () => 'snow',
        gradient: () => weatherGradients.snow,
        footerBg: () => 'rgba(50,90,130,0.97)',
    },
    ice: {
        icon: () => 'snow',
        gradient: () => weatherGradients.ice,
        footerBg: () => 'rgba(10,25,45,0.97)',
    },
    drizzle: {
        icon: () => 'rainy',
        gradient: () => weatherGradients.drizzle,
        footerBg: () => 'rgba(10,26,48,0.97)',
    },
    rain: {
        icon: () => 'rainy',
        gradient: () => weatherGradients.rainy,
        footerBg: () => 'rgba(6,18,36,0.97)',
    },
    hot: {
        icon: () => 'sunny',
        gradient: () => weatherGradients.hot,
        footerBg: () => 'rgba(92,35,8,0.97)',
    },
    fog: {
        icon: () => 'cloudy',
        gradient: () => weatherGradients.foggy,
        footerBg: () => 'rgba(31,41,55,0.97)',
    },
    haze: {
        icon: (isDay) => (isDay ? 'partly-cloudy' : 'partly-cloudy-night'),
        gradient: () => weatherGradients.hazy,
        footerBg: () => 'rgba(41,32,20,0.97)',
    },
    sunny: {
        icon: () => 'sunny',
        gradient: () => weatherGradients.clearDay,
        footerBg: () => 'rgba(2,78,142,0.97)',
    },
    clear: {
        icon: (isDay) => (isDay ? 'sunny' : 'clear-night'),
        gradient: (isDay) =>
            isDay ? weatherGradients.clearDay : weatherGradients.clearNight,
        footerBg: (isDay) =>
            isDay ? 'rgba(2,78,142,0.97)' : 'rgba(2,6,23,0.97)',
    },
    partlyCloudy: {
        icon: (isDay) => (isDay ? 'partly-cloudy' : 'partly-cloudy-night'),
        // At night a partly-cloudy sky reads against the clear-night gradient.
        gradient: (isDay) =>
            isDay ? weatherGradients.partlyCloudy : weatherGradients.clearNight,
        footerBg: () => 'rgba(22,34,54,0.97)',
    },
    cloudy: {
        icon: () => 'cloudy',
        gradient: () => weatherGradients.cloudy,
        footerBg: () => 'rgba(16,24,39,0.97)',
    },
};

export const iconTypeFor = (condition: string, isDay: boolean): WeatherIconType =>
    KIND_STYLES[classifyCondition(condition)].icon(isDay);

/**
 * Conditions whose background IS the sky, so time of day should drive it.
 * Rain/cloud/storm palettes carry the condition's identity instead, and would
 * lose it if repainted by solar elevation.
 */
const SKY_DOMINATED = new Set<WeatherKind>(['clear', 'sunny']);

/**
 * @param solarElevationDeg Optional sun elevation (see lib/solarPosition). When
 *   omitted the result is exactly the static palette — callers that don't have
 *   coordinates (forecast tiles, trip cards) are unaffected, and the returned
 *   array keeps its stable identity.
 * @param isRising Sun climbing toward noon, which selects the dawn palettes
 *   over the dusk ones. Only meaningful alongside `solarElevationDeg`; defaults
 *   to false (evening) so three-argument callers are unchanged.
 */
export const gradientFor = (
    condition: string,
    isDay: boolean,
    solarElevationDeg?: number,
    isRising = false,
): readonly string[] => {
    const kind = classifyCondition(condition);
    if (solarElevationDeg !== undefined && SKY_DOMINATED.has(kind)) {
        return skyGradientFor(solarElevationDeg, isRising);
    }
    return KIND_STYLES[kind].gradient(isDay);
};

export const footerBgFor = (condition: string, isDay: boolean): string =>
    KIND_STYLES[classifyCondition(condition)].footerBg(isDay);

/** True for "Clear" / "Mostly Clear" at night — drives the star backdrop. */
export const isClearNight = (condition: string, isDay: boolean): boolean =>
    !isDay && classifyCondition(condition) === 'clear';

/** True for thunderstorm conditions — drives the storm backdrop. */
export const isThunderstorm = (condition: string): boolean =>
    classifyCondition(condition) === 'thunderstorm';

/** True for plain rain (not drizzle, not thunderstorms) — drives the light-rain backdrop. */
export const isRain = (condition: string): boolean =>
    classifyCondition(condition) === 'rain';

/** True for drizzle — drives the drizzle backdrop (short, quick droplets). */
export const isDrizzle = (condition: string): boolean =>
    classifyCondition(condition) === 'drizzle';
