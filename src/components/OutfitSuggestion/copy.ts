import type { CurrentWeather } from '../../types';
import type { OutfitResult, ScoreBreakdown } from '../../lib/outfit/types';
import { FACTOR_EXPLANATIONS } from './constants';

export const outfitTabSubtitle = (outfit: OutfitResult): string => {
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

export const weatherAwareAddClothesBody = (weather: CurrentWeather): string => {
    const tempF = weather.Temperature.Imperial.Value;
    const cond = weather.WeatherText.toLowerCase();
    if (cond.includes('rain') || cond.includes('shower') || cond.includes('drizzle'))
        return 'Add a rain jacket or waterproof layer to get started.';
    if (cond.includes('snow') || cond.includes('blizzard') || cond.includes('flurr'))
        return 'Add a winter coat or warm layers to get started.';
    if (cond.includes('thunder') || cond.includes('storm'))
        return 'Add a sturdy outer layer to get started.';
    if (tempF <= 40) return 'Add a coat or sweater to get started.';
    if (tempF >= 85) return 'Add some light, breathable pieces to get started.';
    return 'Add clothing articles to get outfit suggestions.';
};

export const weatherAwareInsufficientBody = (weather: CurrentWeather): string => {
    const tempF = weather.Temperature.Imperial.Value;
    const cond = weather.WeatherText.toLowerCase();
    if (cond.includes('rain') || cond.includes('shower') || cond.includes('drizzle'))
        return 'Add a top, bottom, and a rain jacket to build an outfit.';
    if (cond.includes('snow') || cond.includes('blizzard'))
        return 'Add a top, bottom, and a warm coat to build a cold-weather outfit.';
    if (tempF <= 40)
        return 'Add a top and a bottom — a warm outer layer would help too.';
    return 'Add a top and a bottom (or a full-body piece) to get a suggestion.';
};
