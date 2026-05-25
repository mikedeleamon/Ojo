import type { OutfitRole, ScoreBreakdown } from '../../lib/outfit/types';
import type { LayeringResult } from '../../lib/layering/types';

export { CSS_COLORS } from '../../lib/colors/cssColors';

export const ROLE_LABELS: Record<OutfitRole, string> = {
    top: 'Top',
    bottom: 'Bottom',
    fullBody: 'Outfit',
    midLayer: 'Mid Layer',
    outerwear: 'Outerwear',
    footwear: 'Footwear',
    accessory: 'Extra',
};

export const BREAKDOWN_LABELS: { key: keyof ScoreBreakdown; label: string }[] = [
    { key: 'fabric', label: 'Weather' },
    { key: 'color', label: 'Color' },
    { key: 'style', label: 'Style' },
    { key: 'simplicity', label: 'Simple' },
    { key: 'preference', label: 'You' },
];

export const REMOVABLE_ROLES: OutfitRole[] = ['midLayer', 'outerwear'];

export const LAYER_TIERS: { key: keyof LayeringResult['layers']; label: string }[] = [
    { key: 'base', label: 'Base' },
    { key: 'mid', label: 'Mid' },
    { key: 'outer', label: 'Outer' },
];

export const FACTOR_EXPLANATIONS: Record<keyof ScoreBreakdown, string> = {
    fabric: "Some fabrics aren't ideal for today's weather — layering can help.",
    color: "The colors don't pair perfectly, but the outfit still works well.",
    style: 'The mix of styles is a little eclectic — that can be a good thing.',
    simplicity: 'This outfit has a lot going on — consider swapping a piece or two.',
    preference: "This isn't your usual style, but it suits the conditions.",
};
