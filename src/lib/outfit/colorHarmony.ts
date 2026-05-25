// 12-position RYB color wheel. Position 0–11 (30° per step).
// Harmony score is based on the angular distance between two colors.

const COLOR_WHEEL_POSITION: Record<string, number> = {
  Red: 0, Scarlet: 0, Crimson: 0, Maroon: 0, Burgundy: 0,
  Orange: 2, Coral: 2, Peach: 2, Salmon: 2, Rust: 2,
  Gold: 3,
  Yellow: 4, Lime: 4,
  Olive: 5, Khaki: 5, Sage: 5,
  Green: 6, Mint: 6,
  Teal: 7, Cyan: 7,
  Blue: 8, 'Sky Blue': 8, 'Baby Blue': 8, Cobalt: 8, 'Electric Blue': 8,
  Navy: 9, Indigo: 9, Periwinkle: 9,
  Purple: 10, Violet: 10, Plum: 10, Lilac: 10,
  Pink: 11, 'Hot Pink': 11, Fuchsia: 11, Magenta: 11,
  Lavender: 11, Rose: 11, 'Dusty Rose': 11, Blush: 11,
};

// Neutrals + metallics harmonise with everything.
export const COLOR_NEUTRALS = new Set([
  'Black', 'White', 'Grey', 'Gray', 'Beige', 'Brown',
  'Ivory', 'Cream', 'Tan', 'Multi',
  'Silver', 'Gold', 'Bronze', 'Rose Gold', 'Champagne',
]);

/** Colors considered base neutrals for simplicity scoring (subset of COLOR_NEUTRALS). */
export const NEUTRAL_BASE_COLORS = new Set(['Black', 'White', 'Grey', 'Beige', 'Brown', 'Navy']);

/**
 * Returns 0–1 harmony score for two colors using standard interval theory.
 */
export const pairHarmony = (colorA: string, colorB: string): number => {
  if (COLOR_NEUTRALS.has(colorA) || COLOR_NEUTRALS.has(colorB)) return 0.9;

  const posA = COLOR_WHEEL_POSITION[colorA];
  const posB = COLOR_WHEEL_POSITION[colorB];

  if (posA === undefined || posB === undefined) return 0.7;

  const d = Math.min(Math.abs(posA - posB), 12 - Math.abs(posA - posB));

  if (d === 0) return 0.7;
  if (d === 1) return 0.8;
  if (d === 2) return 0.65;
  if (d === 3) return 0.35;
  if (d === 4) return 0.75;
  if (d === 5) return 0.85;
  if (d === 6) return 1.0;
  return 0.5;
};
