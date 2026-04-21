/**
 * Design tokens — single source of truth for the Ojo design system.
 *
 * On the web these values are mirrored in index.css as CSS custom properties.
 * The CSS vars remain authoritative for CSS Modules; these constants are for
 * any JS/TS that needs token values directly (e.g. inline styles, calculations,
 * and React Native StyleSheets on migration).
 *
 * React Native migration:
 *   - Delete index.css :root block
 *   - Replace all `var(--*)` references in StyleSheets with these imports
 *   - Add platform-specific overrides below if needed (e.g. iOS blur vs Android)
 */

// ─── Colours ──────────────────────────────────────────────────────────────────

export const colors = {
  // Backgrounds
  bgDefault: '#0F172A',          // var(--bg-default) base stop

  // Glass surfaces
  glassBg:        'rgba(255, 255, 255, 0.10)',
  glassBgStrong:  'rgba(255, 255, 255, 0.18)',
  glassBorder:    'rgba(255, 255, 255, 0.22)',

  // Text
  textPrimary:   'rgba(255, 255, 255, 0.97)',
  textSecondary: 'rgba(255, 255, 255, 0.65)',
  textMuted:     'rgba(255, 255, 255, 0.40)',

  // Semantic — danger
  dangerBg:      'rgba(239, 68, 68, 0.10)',
  dangerBorder:  'rgba(239, 68, 68, 0.28)',
  dangerText:    'rgba(252, 165, 165, 0.85)',
  dangerTextHi:  'rgba(252, 165, 165, 1.00)',

  // Semantic — success
  successBg:     'rgba(52, 211, 153, 0.12)',
  successBorder: 'rgba(52, 211, 153, 0.30)',
  successText:   'rgba(110, 231, 183, 1.00)',

  // Semantic — error (form messages)
  errorBg:       'rgba(239, 68, 68, 0.12)',
  errorBorder:   'rgba(239, 68, 68, 0.30)',
  errorText:     'rgba(252, 165, 165, 1.00)',

  // Misc
  white:        '#FFFFFF',
  saveBtnBg:    'rgba(255, 255, 255, 0.92)',
  saveBtnText:  '#0D1B2A',
} as const;

// ─── Weather background gradients ─────────────────────────────────────────────
// RN migration: use expo-linear-gradient with these stop arrays

export const weatherGradients = {
  sunny:        ['#F97316', '#FBBF24', '#FDE68A'],
  clearDay:     ['#0284C7', '#38BDF8', '#7DD3FC'],
  clearNight:   ['#020617', '#0C1445', '#1D2B6B'],
  partlyCloudy: ['#334155', '#475569', '#64748B'],
  cloudy:       ['#1F2937', '#374151', '#4B5563'],
  rainy:        ['#0C1A2E', '#1E3A5F', '#1D4ED8'],
  stormy:       ['#0F0C29', '#1E1B4B', '#302B63'],
  snow:         ['#5B8DB8', '#93C5FD', '#E0F2FE'],
  default:      ['#0F172A', '#1E293B', '#334155'],
} as const;

// ─── Spacing ──────────────────────────────────────────────────────────────────
// All values in pixels / dp (dp === px for RN purposes at 1x)

export const spacing = {
  xs:  6,
  sm:  12,
  md:  20,
  lg:  32,
  xl:  48,
} as const;

// ─── Border radii ─────────────────────────────────────────────────────────────

export const radius = {
  sm:   10,
  md:   18,
  lg:   28,
  pill: 999,
} as const;

// ─── Typography ───────────────────────────────────────────────────────────────
// RN migration: load fonts via expo-font, then use fontFamily strings here

export const fonts = {
  display: "'DM Serif Display', Georgia, serif",  // → 'DMSerifDisplay' in RN
  body:    "'Outfit', system-ui, sans-serif",      // → 'Outfit' in RN
} as const;

export const fontSizes = {
  xs:   11,
  sm:   13,
  base: 15,
  md:   16,
  lg:   18,
  xl:   24,
  xxl:  32,
} as const;

export const fontWeights = {
  light:   '300',
  regular: '400',
  medium:  '500',
  semibold:'600',
  bold:    '700',
} as const;

// ─── Shadows ──────────────────────────────────────────────────────────────────
// RN migration: decompose into { shadowColor, shadowOffset, shadowOpacity, shadowRadius, elevation }

export const shadows = {
  glass: '0 8px 32px rgba(0, 0, 0, 0.25)',
} as const;

// ─── Animation ────────────────────────────────────────────────────────────────
// RN migration: translate to Animated.timing / Reanimated withTiming duration+easing

export const animation = {
  durationMs: 250,
  easing: 'cubic-bezier(0.4, 0, 0.2, 1)',  // → Easing.bezier(0.4, 0, 0.2, 1) in RN
} as const;

// ─── Convenience re-exports ───────────────────────────────────────────────────

const theme = { colors, weatherGradients, spacing, radius, fonts, fontSizes, fontWeights, shadows, animation };
export default theme;
