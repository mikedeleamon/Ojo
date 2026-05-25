/**
 * Multi-stop linear gradients for metallic colors.
 * Used wherever a single hex would look flat (e.g. color swatches, chips).
 */
export const METALLIC_GRADIENTS: Record<string, readonly [string, string, ...string[]]> = {
    Silver: ['#f2f2f2', '#c0c0c0', '#f5f5f5', '#8a8a8a'],
    Gold: ['#fde68a', '#d4af37', '#f5e27a', '#b8860b'],
    Bronze: ['#d4a271', '#8b5c2a', '#cd853f', '#7b3f15'],
    'Rose Gold': ['#f4c2b8', '#c9776a', '#eda99a', '#a0504a'],
    Champagne: ['#f8f0d8', '#e4c96e', '#f5e8c0', '#c8a84b'],
};

export const METALLIC_START = { x: 0.15, y: 0 } as const;
export const METALLIC_END = { x: 0.85, y: 1 } as const;
