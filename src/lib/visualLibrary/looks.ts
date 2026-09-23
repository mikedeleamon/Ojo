/**
 * looks.ts — the looks WeatherHUD's backdrop can take, one Instagram-story
 * loop each.
 *
 * A look is what's behind the weather on the home screen: a gradient plus the
 * particle layers from lib/weather/backdropLayers. The app draws most
 * conditions the same by day and night, so most kinds are a single look.
 * Partly cloudy switches gradient on IsDayTime. Clear and sunny skies follow
 * the sun through the named stages of lib/weather/skyGradient: twelve looks,
 * from high noon through dusk or dawn to night, with stars once the sun is
 * down.
 *
 * lookFor() picks the look for live weather; recipeFor() gives the inputs that
 * reproduce a look through the app's own gradientFor() and backdropLayersFor()
 * — which is exactly what scripts/visual-library/export_data.ts does to render
 * the loops, so a story shows what the app shows.
 */

import { classifyCondition, type WeatherKind } from '../weather/conditions';
import { DAWN_STOPS, DUSK_STOPS, nearestSkyStage, type SkyStage } from '../weather/skyGradient';
import { solarPosition } from '../solarPosition';

/** Kinds the app draws with one fixed gradient, day or night. */
export const FIXED_LOOK_KINDS = [
    'thunderstorm', 'rain', 'drizzle', 'snow', 'ice', 'fog', 'haze', 'hot', 'cloudy',
] as const satisfies readonly WeatherKind[];

export type FixedLook = (typeof FIXED_LOOK_KINDS)[number];
export type SkyLook = `sky.${SkyStage}`;
export type BackdropLook = FixedLook | 'partlyCloudy.day' | 'partlyCloudy.night' | SkyLook;

/** Every sky stage once — clearDay and clearNight end both the dusk and dawn tables. */
export const SKY_STAGES: readonly SkyStage[] = [...new Set([...DUSK_STOPS, ...DAWN_STOPS].map((s) => s.stage))];

export const ALL_LOOKS: readonly BackdropLook[] = [
    ...FIXED_LOOK_KINDS,
    'partlyCloudy.day',
    'partlyCloudy.night',
    ...SKY_STAGES.map((stage): SkyLook => `sky.${stage}`),
];

/** A loop per look, plus the Weekly Recap's gradient cycle. */
export type LoopKey = BackdropLook | 'recap';
export const REQUIRED_LOOP_KEYS: readonly LoopKey[] = [...ALL_LOOKS, 'recap'];

export interface LookInput {
    /** Condition text as the weather API gives it, e.g. "Light rain". */
    condition: string;
    isDayTime: boolean;
    /** The sun, if the caller already has it (WeatherHUD does). */
    sun?: { elevationDeg: number; isRising: boolean } | null;
    /** Otherwise computed from coordinates. Without either, clear skies use isDayTime. */
    coords?: { lat: number; lon: number } | null;
    at?: Date;
}

export function lookFor({ condition, isDayTime, sun, coords, at = new Date() }: LookInput): BackdropLook {
    const kind = classifyCondition(condition);
    if (kind === 'clear' || kind === 'sunny') {
        const position = sun ?? (coords ? solarPosition(coords.lat, coords.lon, at) : null);
        if (position) return `sky.${nearestSkyStage(position.elevationDeg, position.isRising)}`;
        return isDayTime ? 'sky.clearDay' : 'sky.clearNight';
    }
    if (kind === 'partlyCloudy') return isDayTime ? 'partlyCloudy.day' : 'partlyCloudy.night';
    return kind;
}

/** Condition text that classifyCondition reads as each fixed kind. */
const CONDITION_TEXT: Readonly<Record<FixedLook | 'partlyCloudy' | 'clear', string>> = {
    thunderstorm: 'Thunderstorms',
    rain: 'Rain',
    drizzle: 'Drizzle',
    snow: 'Snow',
    ice: 'Sleet',
    fog: 'Fog',
    haze: 'Haze',
    hot: 'Hot',
    cloudy: 'Cloudy',
    partlyCloudy: 'Partly cloudy',
    clear: 'Clear',
};

export interface LookRecipe {
    condition: string;
    isDayTime: boolean;
    sun: { elevationDeg: number; isRising: boolean } | null;
}

/**
 * Inputs that reproduce a look through the app's own gradientFor() and
 * backdropLayersFor(). Sky stages use their stop's elevation (the two
 * endpoints sit well past their stop, where the palette is flat), and count as
 * daytime while the sun is above the horizon — WeatherKit's IsDayTime, which
 * is what turns the stars on.
 */
export function recipeFor(look: BackdropLook): LookRecipe {
    if (look === 'partlyCloudy.day' || look === 'partlyCloudy.night') {
        return { condition: CONDITION_TEXT.partlyCloudy, isDayTime: look === 'partlyCloudy.day', sun: null };
    }
    if (look.startsWith('sky.')) {
        const stage = look.slice(4) as SkyStage;
        const dusk = DUSK_STOPS.find((s) => s.stage === stage);
        const stop = dusk ?? DAWN_STOPS.find((s) => s.stage === stage);
        if (!stop) throw new Error(`Unknown sky stage: ${stage}`);
        const elevationDeg = stage === 'clearDay' ? 45 : stage === 'clearNight' ? -30 : stop.elevation;
        return {
            condition: CONDITION_TEXT.clear,
            isDayTime: elevationDeg > 0,
            sun: { elevationDeg, isRising: !dusk },
        };
    }
    return { condition: CONDITION_TEXT[look as FixedLook], isDayTime: true, sun: null };
}
