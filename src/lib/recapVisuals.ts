/**
 * recapVisuals.ts
 * ----------------
 * "How should this recap card look" — shared by the in-app RecapPage and the
 * Instagram RecapShareCard so the two surfaces render the same accent and
 * tint per card instead of drifting into separate palettes. Kept out of
 * recapEngine.ts, which is deliberately UI-free.
 */
import { RecapCard, RecapSection } from './recapEngine';
import { CSS_COLORS } from './colors/cssColors';
import { METALLIC_GRADIENTS } from './colors/metallicGradients';
import { brandHeroTint } from '../theme/tokens';

/** Per-theme accent used for a card's eyebrow/stat text when the tint itself
 *  isn't a reliable text color (e.g. a pale garment color, or the brand wash). */
export const SECTION_ACCENT: { dark: Record<RecapSection, string>; light: Record<RecapSection, string> } = {
  dark: {
    opener:  '#818CF8',
    color:   '#F472B6',
    items:   '#34D399',
    habits:  '#FBBF24',
    context: '#38BDF8',
    closer:  '#A78BFA',
  },
  light: {
    opener:  '#4F46E5',
    color:   '#DB2777',
    items:   '#059669',
    habits:  '#B45309',
    context: '#0369A1',
    closer:  '#7C3AED',
  },
};

/** Solid stand-in for the brand's mint→leaf gradient, for text over a brand-tinted card. */
export const BRAND_SOLID = { dark: '#7FE6A8', light: '#3F6212' };

/** Templates that mark a personal win — these get the brand wash instead of a flat section hue. */
const ACHIEVEMENT_TEMPLATES = new Set([
  'milestone', 'streak', 'cpw_win', 'share_cta', 'hero_week', 'hero_light',
]);

export const resolveColorHex = (name: string): string | null =>
  CSS_COLORS[name] ?? METALLIC_GRADIENTS[name]?.[1] ?? null;

export type RecapTint =
  | { kind: 'brand' }
  | { kind: 'gradient'; colors: readonly [string, string] }
  | { kind: 'flat'; hex: string };

/**
 * Decides how a card's surface should read: a real garment/outfit color when
 * the card is literally about one (color_story, color_pair, DNA cards, and
 * any item card whose article has a color), the brand mint→leaf wash for
 * achievement-flavored cards, or a flat per-section hue otherwise.
 */
export const recapTint = (card: RecapCard): RecapTint => {
  const hexes = (card.colorNames ?? [])
    .map(resolveColorHex)
    .filter((h): h is string => !!h);
  if (hexes.length >= 2) return { kind: 'gradient', colors: [hexes[0], hexes[1]] };
  if (hexes.length === 1) return { kind: 'flat', hex: hexes[0] };
  if (ACHIEVEMENT_TEMPLATES.has(card.templateId)) return { kind: 'brand' };
  return { kind: 'flat', hex: SECTION_ACCENT.dark[card.section] };
};

/** The gradient stops for a card's brand wash, per theme. */
export const brandWash = (isDark: boolean): readonly [string, string] =>
  isDark ? brandHeroTint.dark : brandHeroTint.light;

export const hexToRgba = (hex: string, alpha: number): string => {
  const h = hex.replace('#', '');
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};
