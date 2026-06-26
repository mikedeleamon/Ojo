import type { CurrentWeather } from '../../types';
import type { OutfitResult, ScoreBreakdown } from '../../lib/outfit/types';
import { FACTOR_EXPLANATIONS } from './constants';

export const outfitTabSubtitle = (outfit: OutfitResult): string => {
    if (outfit.moodLabel) return outfit.moodLabel;
    const roles = outfit.slots.map((s) => s.role);
    if (roles.includes('outerwear')) return 'Layered up';
    if (roles.includes('midLayer')) return 'Mid layer';
    if (outfit.scoreBreakdown.preference >= 75) return 'Your style';
    if (outfit.scoreBreakdown.color >= 80) return 'Color match';
    if (outfit.scoreBreakdown.fabric >= 80) return 'Weather-perfect';
    return 'Light & clean';
};

/** Returns a one-sentence explanation for the weakest score factor, or null if all factors are decent. */
export const whyThisOutfit = (breakdown: ScoreBreakdown): string | null => {
    let weakest: keyof ScoreBreakdown = 'fabric';
    let min = 100;
    for (const k of Object.keys(breakdown) as (keyof ScoreBreakdown)[]) {
        if (breakdown[k] < min) {
            min = breakdown[k];
            weakest = k;
        }
    }
    if (min >= 60) return null;
    return FACTOR_EXPLANATIONS[weakest];
};

const CAMERA_HINT = ' Use the camera tab to photograph your clothes.';

export const weatherAwareAddClothesBody = (weather: CurrentWeather): string => {
    const tempF = weather.Temperature.Imperial.Value;
    const cond = weather.WeatherText.toLowerCase();
    if (cond.includes('rain') || cond.includes('shower') || cond.includes('drizzle'))
        return `It's raining — a rain jacket or waterproof layer would be a great first addition.${CAMERA_HINT}`;
    if (cond.includes('snow') || cond.includes('blizzard') || cond.includes('flurr'))
        return `It's snowing — start with a winter coat or warm layers.${CAMERA_HINT}`;
    if (cond.includes('thunder') || cond.includes('storm'))
        return `Stormy out — add a sturdy outer layer to get started.${CAMERA_HINT}`;
    if (tempF <= 40) return `Cold out — add a coat or sweater first.${CAMERA_HINT}`;
    if (tempF >= 85) return `It's warm — light, breathable pieces are perfect to start with.${CAMERA_HINT}`;
    return `Add your clothes to see personalised outfit suggestions.${CAMERA_HINT}`;
};

export const weatherAwareInsufficientBody = (weather: CurrentWeather): string => {
    const tempF = weather.Temperature.Imperial.Value;
    const cond = weather.WeatherText.toLowerCase();
    if (cond.includes('rain') || cond.includes('shower') || cond.includes('drizzle'))
        return `Add a top, a bottom, and a rain jacket to get a wet-weather outfit.${CAMERA_HINT}`;
    if (cond.includes('snow') || cond.includes('blizzard'))
        return `Add a top, a bottom, and a warm coat to get a cold-weather outfit.${CAMERA_HINT}`;
    if (tempF <= 40)
        return `Add a top and a bottom — a warm outer layer would help too.${CAMERA_HINT}`;
    return `Add at least a top and a bottom (or a full-body piece) to generate an outfit.${CAMERA_HINT}`;
};
