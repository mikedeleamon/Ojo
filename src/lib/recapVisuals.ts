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
import { brandHeroTint, weatherGradients } from '../theme/tokens';

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

// ─── Redesign (2026-07) palette & accents ─────────────────────────────────────
// The Wrapped-style recap runs on its own always-dark surface, independent of
// the app's light/dark theme. These are the design-system values the RecapPage
// and StoryCard share so the on-screen report and the exported poster match.

export const RECAP_PALETTE = {
  ink:          '#080B14',   // screen background
  inkRaise:     '#04060C',   // true-black areas
  card:         '#111A2C',   // elevated dark card
  cardBlue:     ['#132743', '#0F1C30'] as const,   // travel card gradient
  cream:        ['#F4EEDE', '#E9E0CC'] as const,   // MVP card gradient
  outro:        ['#1F6B47', '#0D3A28'] as const,   // wrapped card gradient
  mint:         '#74E8A3',
  mintDeep:     '#3F7D5A',   // milestone meter start
  blue:         '#5E92F2',
  blueText:     '#8FB4F5',
  coral:        '#B06A3A',
  text:         '#F2F0EA',   // primary on dark
  textOnCream:  '#1A2030',
  muted:        '#8A94A8',   // secondary on dark
  mutedOnCream: '#6A6350',
  hairline:     'rgba(255,255,255,0.06)',
} as const;

/** Per-section accent for the redesigned dark cards (eyebrow/stat text). */
export const RECAP_ACCENT: Record<RecapSection, string> = {
  opener:  RECAP_PALETTE.mint,
  color:   RECAP_PALETTE.blue,
  items:   RECAP_PALETTE.mint,
  habits:  RECAP_PALETTE.mint,
  context: RECAP_PALETTE.blue,
  closer:  RECAP_PALETTE.mint,
};

/** Block/segment hexes lifted so dark garment colors still read on the ink bg;
 *  the four common wardrobe colors use the spec's tuned values, the rest fall
 *  back to the shared CSS table, then to a neutral slate. */
const SWATCH_OVERRIDES: Record<string, string> = {
  Black: '#2C313D',
  Cream: '#D9CDB5',
  Olive: '#5F6B4A',
  Blue:  '#5E92F2',
};

export const recapSwatchHex = (name: string | null | undefined): string =>
  (name && (SWATCH_OVERRIDES[name] ?? resolveColorHex(name))) || '#3A4356';

// ─── Cycling weather-gradient background ──────────────────────────────────────
// Mirrors OjoLandingSite's <GradientBackground>: the same weather gradients this
// app already ships in `weatherGradients`, in the order that site hand-tuned for
// the shortest color-wheel path between adjacent pairs (the loop-back to the
// brand gradient shares emerald/teal tones, so it closes smoothly).

export type RecapGradient = readonly [string, string, ...string[]];

/** The brand's mint→leaf default — the cycle's home state, as on the site. */
export const RECAP_BRAND_GRADIENT: RecapGradient = ['#2DD4BF', '#10B981', '#A3E635'];

export const RECAP_GRADIENT_CYCLE: readonly RecapGradient[] = [
  RECAP_BRAND_GRADIENT,
  weatherGradients.clearDay,
  weatherGradients.clearNight,
  weatherGradients.hot,
  weatherGradients.sunny,
  weatherGradients.cloudy,
  weatherGradients.drizzle,
  weatherGradients.snow,
  weatherGradients.ice,
  weatherGradients.foggy,
  weatherGradients.hazy,
  weatherGradients.default,
];

/**
 * Ink laid over the gradient at high opacity. The landing site scrims at 0.28
 * because its content is white-on-gradient by design; the recap is a dark
 * editorial surface whose hero copy sits straight on the background, so the
 * gradient reads as a slow hue shift under ink rather than as vivid color.
 */
export const RECAP_SCRIM = 'rgba(8, 11, 20, 0.82)';

/** Approximates the site's CSS `linear-gradient(160deg, …)`. */
export const RECAP_GRADIENT_START = { x: 0, y: 0 } as const;
export const RECAP_GRADIENT_END   = { x: 0.35, y: 1 } as const;

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
