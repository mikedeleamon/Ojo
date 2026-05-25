export type Season = 'spring' | 'summer' | 'autumn' | 'winter';

export const currentSeason = (): Season => {
  const month = new Date().getMonth();
  if (month >= 2 && month <= 4) return 'spring';
  if (month >= 5 && month <= 7) return 'summer';
  if (month >= 8 && month <= 10) return 'autumn';
  return 'winter';
};

export const SEASONAL_COLORS: Record<Season, Set<string>> = {
  spring: new Set([
    'Pink', 'Lavender', 'Mint', 'Coral', 'Sky Blue', 'Yellow', 'Rose', 'Cream',
    'Blush', 'Peach', 'Lilac', 'Sage', 'Periwinkle', 'Baby Blue', 'Dusty Rose',
  ]),
  summer: new Set([
    'White', 'Cyan', 'Coral', 'Yellow', 'Orange', 'Sky Blue', 'Teal', 'Mint',
    'Lime', 'Hot Pink', 'Fuchsia', 'Peach', 'Baby Blue', 'Electric Blue',
  ]),
  autumn: new Set([
    'Rust', 'Burgundy', 'Olive', 'Brown', 'Gold', 'Maroon', 'Orange', 'Khaki', 'Tan',
    'Scarlet', 'Sage', 'Champagne',
  ]),
  winter: new Set([
    'Navy', 'Black', 'Burgundy', 'Plum', 'Indigo', 'Grey', 'Silver', 'Cobalt',
    'Champagne', 'Rose Gold', 'Lilac', 'Periwinkle',
  ]),
};

/** Returns a 0–0.08 seasonal bonus based on how many outfit colors match the season. */
export const seasonalBonus = (outfitColors: string[]): number => {
  const season = currentSeason();
  const palette = SEASONAL_COLORS[season];
  const matchCount = outfitColors.filter((c) => palette.has(c)).length;
  if (outfitColors.length === 0) return 0;
  return Math.min(0.08, matchCount * 0.03);
};
