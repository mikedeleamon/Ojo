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

export const darkColors = {
  // Backgrounds
  bgDefault: '#0F172A',          // var(--bg-default) base stop

  // Glass surfaces
  glassBg:        'rgba(255, 255, 255, 0.10)',
  glassBgStrong:  'rgba(255, 255, 255, 0.18)',
  glassBorder:    'rgba(255, 255, 255, 0.22)',

  // Text
  textPrimary:   'rgba(255, 255, 255, 0.97)',
  textSecondary: 'rgba(255, 255, 255, 0.65)',
  textMuted:     'rgba(255, 255, 255, 0.55)',

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
  toggleThumbActive: '#34D399',
  toggleTrackActive: 'rgba(52, 211, 153, 0.5)',
} as const;

export const lightColors = {
  bgDefault:      '#FAFAFA',
  glassBg:        'rgba(0, 0, 0, 0.05)',
  glassBgStrong:  'rgba(0, 0, 0, 0.09)',
  glassBorder:    'rgba(0, 0, 0, 0.16)',
  textPrimary:    '#111113',
  textSecondary:  '#404045',
  textMuted:      '#5C5C63',
  dangerBg:       'rgba(220, 38, 38, 0.08)',
  dangerBorder:   'rgba(220, 38, 38, 0.30)',
  dangerText:     '#B91C1C',
  dangerTextHi:   '#991B1B',
  successBg:      'rgba(5, 150, 105, 0.10)',
  successBorder:  'rgba(5, 150, 105, 0.32)',
  successText:    '#047857',
  errorBg:        'rgba(220, 38, 38, 0.08)',
  errorBorder:    'rgba(220, 38, 38, 0.30)',
  errorText:      '#B91C1C',
  white:          '#FFFFFF',
  saveBtnBg:      '#111113',
  saveBtnText:    '#FAFAFA',
  toggleThumbActive: '#059669',
  toggleTrackActive: 'rgba(5, 150, 105, 0.45)',
} as const;

// ─── Brand hero tint ──────────────────────────────────────────────────────────
// The logo's mint→leaf gradient, laid OVER a glass surface (not replacing it)
// so a primary "hero" button reads as brand-tinted glass rather than a solid
// fill. Per-theme because the mint end is invisible on the light background
// and needs deeper, warmer stops.
export const brandHeroTint: { dark: [string, string]; light: [string, string] } = {
  dark:  ['rgba(79, 238, 195, 0.42)', 'rgba(101, 186, 2, 0.42)'],
  light: ['rgba(18, 185, 140, 0.32)', 'rgba(76, 154, 22, 0.34)'],
};

// Backward-compat alias — files not yet updated still compile fine
export const colors = darkColors;

export type ColorTokens = { readonly [K in keyof typeof darkColors]: string };

// ─── Weather background gradients ─────────────────────────────────────────────
// RN migration: use expo-linear-gradient with these stop arrays

export const weatherGradients = {
  // ── Clear / Sun ───────────────────────────────────────────────────────────
  sunny:        ['#F97316', '#FBBF24', '#FDE68A'],   // vivid orange-gold
  clearDay:     ['#0284C7', '#38BDF8', '#7DD3FC'],   // sky blue
  clearNight:   ['#020617', '#0C1445', '#1D2B6B'],   // deep midnight
  hot:          ['#7C2D12', '#C2410C', '#FBBF24'],   // scorched amber-gold

  // ── Time-of-day sky (clear/sunny only) ────────────────────────────────────
  // Blended by solar elevation in lib/weather/skyGradient, so the sky moves
  // continuously through the day instead of snapping on the IsDayTime boolean.
  // Stops read top → bottom of screen: zenith, mid-sky, horizon.
  //
  // Each twilight band has an evening and a morning variant, because they don't
  // look alike in reality. Daytime convection lifts dust and pollution into the
  // lower atmosphere, so evening air is aerosol-heavy and scatters long
  // wavelengths hard — deep saturated reds. Overnight the air stabilises and
  // particulates settle out, so dawn light passes through cleaner air and skews
  // softer, cooler and pinker. The same asymmetry turns evening blue hour
  // violet (residual warmth over the ozone Chappuis band) while morning blue
  // hour stays a purer, cooler blue.
  //
  // Evening (sun descending):
  goldenHour:   ['#0C4A8A', '#E8834A', '#FCD34D'],   // low sun, warm gold horizon
  sunset:       ['#1E1B4B', '#C2410C', '#F59E0B'],   // civil twilight, burnt orange
  blueHour:     ['#0B1026', '#1E3A8A', '#7C3AED'],   // nautical twilight, violet
  // Morning (sun ascending) — paler, cooler, rosier counterparts:
  dawnGold:     ['#0E5BA8', '#EFA184', '#F9E29A'],   // clean blue, peach, pale lemon
  dawn:         ['#1B2C63', '#C85A7C', '#F5A98D'],   // civil twilight, rose + coral
  dawnBlue:     ['#070C1F', '#153A82', '#3B7DD8'],   // nautical twilight, cool blue

  // ── Clouds ────────────────────────────────────────────────────────────────
  partlyCloudy: ['#334155', '#475569', '#64748B'],
  cloudy:       ['#1F2937', '#374151', '#4B5563'],

  // ── Precipitation ─────────────────────────────────────────────────────────
  drizzle:      ['#0F2236', '#1B4A7A', '#4A90D9'],   // lighter than rainy
  rainy:        ['#0C1A2E', '#1E3A5F', '#1D4ED8'],
  stormy:       ['#0F0C29', '#1E1B4B', '#302B63'],

  // ── Winter ────────────────────────────────────────────────────────────────
  snow:         ['#5B8DB8', '#93C5FD', '#E0F2FE'],
  ice:          ['#0A1929', '#1B3A5C', '#3A7AB5'],   // cold steel blue

  // ── Atmosphere ────────────────────────────────────────────────────────────
  foggy:        ['#374151', '#6B7280', '#9CA3AF'],   // cool grey mist
  hazy:         ['#3B2F1E', '#7A6040', '#BAA07A'],   // warm ochre dust

  // ── Fallback ──────────────────────────────────────────────────────────────
  default:      ['#0F172A', '#1E293B', '#334155'],
} as const;

// ─── Spacing ──────────────────────────────────────────────────────────────────
// All values in pixels / dp (dp === px for RN purposes at 1x)

export const spacing = {
  xs:     6,
  xsPlus: 8,   // between xs/sm — tight within-group spacing (icon+label rows, compact cards)
  sm:     12,
  smPlus: 16,  // between sm/md — grouped-section spacing without the full md jump
  md:     20,
  lg:     32,
  xl:     48,
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
  display:        'DMSerifDisplay',
  // Scoped to the Home hero (city name + big temperature) and its sticky
  // mini-header mirror. Everything else stays on `display`.
  hero:           'Fraunces-SemiBold',  // 600, opsz 72
  body:           'Outfit',           // 400 Regular
  bodyLight:      'Outfit-Light',     // 300
  bodyRegular:    'Outfit-Regular',   // 400
  bodyMedium:     'Outfit-Medium',    // 500
  bodySemiBold:   'Outfit-SemiBold',  // 600
  bodyBold:       'Outfit-Bold',      // 700
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
  glass: {
    shadowColor:   '#000000',
    shadowOffset:  { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius:  16,
    elevation:     8,
  },
} as const;

// ─── Animation ────────────────────────────────────────────────────────────────
// Use with Reanimated: withTiming(value, { duration, easing: Easing.bezier(...) })

export const animation = {
  durationMs:   250,
  easingParams: [0.4, 0, 0.2, 1] as [number, number, number, number],
} as const;

// ─── Convenience re-exports ───────────────────────────────────────────────────

const theme = { colors, darkColors, lightColors, weatherGradients, spacing, radius, fonts, fontSizes, fontWeights, shadows, animation };
export default theme;
