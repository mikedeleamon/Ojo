/**
 * backdropLayers.ts — which particle layers WeatherHUD draws over the gradient
 * for a condition.
 *
 * The one decision point for it: WeatherHUD mounts its BackdropLayers from
 * this, and scripts/visual-library/export_data.ts runs the same function for
 * every story loop, so a condition can't look one way in the app and another
 * way in a shared story.
 */

import { classifyCondition, type WeatherKind } from './conditions';
import type { RainVariant } from './backdropSpec';

export interface BackdropLayers {
    /** Twinkling star field (ClearNightIconMoon). */
    stars: boolean;
    /** Falling streaks (StormIconLightning), by variant. */
    rain: RainVariant | null;
    /** Sheet lightning over the rain. */
    flash: boolean;
    /** Snowflakes, or the ice pellets that fall with sleet (FlakeFall). */
    flakes: 'snow' | 'pellets' | null;
    /** Drifting fog banks (FogDrift). */
    fog: boolean;
    /** Sun glare from the top-right corner (SunGlare), on clear and sunny days. */
    glare: boolean;
}

export const NO_LAYERS: BackdropLayers = { stars: false, rain: null, flash: false, flakes: null, fog: false, glare: false };

export function layersForKind(kind: WeatherKind, isDay: boolean): BackdropLayers {
    switch (kind) {
        case 'clear':        return { ...NO_LAYERS, stars: !isDay, glare: isDay };
        case 'sunny':
        case 'hot':          return { ...NO_LAYERS, glare: isDay };
        case 'thunderstorm': return { ...NO_LAYERS, rain: 'storm', flash: true };
        case 'rain':         return { ...NO_LAYERS, rain: 'light' };
        case 'drizzle':      return { ...NO_LAYERS, rain: 'drizzle' };
        case 'ice':          return { ...NO_LAYERS, rain: 'sleet', flakes: 'pellets' };
        case 'snow':         return { ...NO_LAYERS, flakes: 'snow' };
        case 'fog':          return { ...NO_LAYERS, fog: true };
        // Haze, cloudy and partly cloudy are gradient-only.
        default:             return NO_LAYERS;
    }
}

export function backdropLayersFor(condition: string, isDay: boolean): BackdropLayers {
    return layersForKind(classifyCondition(condition), isDay);
}
