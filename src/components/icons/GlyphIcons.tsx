/**
 * GlyphIcons — Feather-style line icons (24×24 viewBox, stroke-only) that stand
 * in for the decorative emoji still scattered through TripFit and ArticleModal
 * (✈️ 📍 🔄 🌍 🖼). Same stroke language as GearIcon / LocationsIcon /
 * CameraIcon / SuitcaseIcon.
 *
 * These exist for the reason spelled out at the top of
 * WeatherIcons/PhraseWeatherIcon: the iOS Simulator runtime ships no usable
 * color-emoji font, so emoji render as missing-glyph boxes there while looking
 * fine on a physical device. Drawing them removes the system-font dependency so
 * simulator, device, and screenshot captures all agree.
 *
 * `color` defaults to `currentColor`-ish white so callers over dark glass can
 * drop them in without passing anything; callers on light surfaces pass their
 * own token.
 */

import { Svg, Circle, Path, Rect, Line } from 'react-native-svg';

interface GlyphProps {
    size?: number;
    color?: string;
    strokeWidth?: number;
    /** Already decorative by default — these icons have no label of their
     *  own and are meant to sit inside an already-labeled control. Pass
     *  false to expose one to the accessibility tree. */
    decorative?: boolean;
}

const base = (size: number, color: string, strokeWidth: number, decorative: boolean = true) => ({
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none' as const,
    stroke: color,
    strokeWidth,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    accessibilityElementsHidden: decorative,
    importantForAccessibility: (decorative ? 'no' : 'auto') as 'no' | 'auto',
});

/** Paper plane — replaces ✈️ on trip/flight affordances. */
export const PlaneIcon = ({
    size = 16,
    color = 'rgba(255,255,255,0.85)',
    strokeWidth = 1.6,
    decorative = true,
}: GlyphProps) => (
    <Svg {...base(size, color, strokeWidth, decorative)}>
        <Path d='M22 2 11 13' />
        <Path d='M22 2 15 22l-4-9-9-4z' />
    </Svg>
);

/** Map pin — replaces 📍 on destination summaries. */
export const PinIcon = ({
    size = 16,
    color = 'rgba(255,255,255,0.85)',
    strokeWidth = 1.6,
    decorative = true,
}: GlyphProps) => (
    <Svg {...base(size, color, strokeWidth, decorative)}>
        <Path d='M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z' />
        <Circle cx={12} cy={10} r={3} />
    </Svg>
);

/** Circular arrows — replaces 🔄 on the stale-forecast refresh banner. */
export const RefreshIcon = ({
    size = 16,
    color = 'rgba(255,255,255,0.85)',
    strokeWidth = 1.6,
    decorative = true,
}: GlyphProps) => (
    <Svg {...base(size, color, strokeWidth, decorative)}>
        <Path d='M23 4v6h-6' />
        <Path d='M1 20v-6h6' />
        <Path d='M3.51 9a9 9 0 0 1 14.85-3.36L23 10' />
        <Path d='M20.49 15a9 9 0 0 1-14.85 3.36L1 14' />
    </Svg>
);

/** Globe — replaces 🌍 in the empty-trips state. */
export const GlobeIcon = ({
    size = 16,
    color = 'rgba(255,255,255,0.85)',
    strokeWidth = 1.6,
    decorative = true,
}: GlyphProps) => (
    <Svg {...base(size, color, strokeWidth, decorative)}>
        <Circle cx={12} cy={12} r={10} />
        <Line x1={2} y1={12} x2={22} y2={12} />
        <Path d='M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z' />
    </Svg>
);

/** Framed picture — replaces 🖼 on the photo-library button. */
export const PhotoLibraryIcon = ({
    size = 16,
    color = 'rgba(255,255,255,0.85)',
    strokeWidth = 1.6,
    decorative = true,
}: GlyphProps) => (
    <Svg {...base(size, color, strokeWidth, decorative)}>
        <Rect x={3} y={3} width={18} height={18} rx={2} ry={2} />
        <Circle cx={8.5} cy={8.5} r={1.5} />
        <Path d='m21 15-5-5L5 21' />
    </Svg>
);

// ─── Navigation glyphs ──────────────────────────────────────────────────────
// On a regular iPhone, buttons that open another page show one of these in
// place of their text label (see useIconOnlyNav). The control keeps the old
// text as its accessibilityLabel.

/** Left chevron — back / return to the previous page. */
export const ChevronLeftIcon = ({
    size = 20,
    color = 'rgba(255,255,255,0.85)',
    strokeWidth = 2,
    decorative = true,
}: GlyphProps) => (
    <Svg {...base(size, color, strokeWidth, decorative)}>
        <Path d='M15 6l-6 6 6 6' />
    </Svg>
);

/** Right arrow — "go to" for a nudge that opens another page. */
export const ArrowRightIcon = ({
    size = 18,
    color = 'rgba(255,255,255,0.85)',
    strokeWidth = 1.8,
    decorative = true,
}: GlyphProps) => (
    <Svg {...base(size, color, strokeWidth, decorative)}>
        <Line x1={5} y1={12} x2={19} y2={12} />
        <Path d='M12 5l7 7-7 7' />
    </Svg>
);

/** Key — forgot / reset password. */
export const KeyIcon = ({
    size = 20,
    color = 'rgba(255,255,255,0.85)',
    strokeWidth = 1.6,
    decorative = true,
}: GlyphProps) => (
    <Svg {...base(size, color, strokeWidth, decorative)}>
        <Circle cx={7.5} cy={15.5} r={4.5} />
        <Path d='M10.7 12.3 21 2' />
        <Path d='m16 7 3 3' />
        <Path d='m19 4 2 2' />
    </Svg>
);

/** Person with a plus — create an account. */
export const PersonPlusIcon = ({
    size = 20,
    color = 'rgba(255,255,255,0.85)',
    strokeWidth = 1.6,
    decorative = true,
}: GlyphProps) => (
    <Svg {...base(size, color, strokeWidth, decorative)}>
        <Path d='M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2' />
        <Circle cx={9} cy={7} r={4} />
        <Line x1={19} y1={8} x2={19} y2={14} />
        <Line x1={22} y1={11} x2={16} y2={11} />
    </Svg>
);

/** Arrow into a door — sign in. */
export const SignInIcon = ({
    size = 20,
    color = 'rgba(255,255,255,0.85)',
    strokeWidth = 1.6,
    decorative = true,
}: GlyphProps) => (
    <Svg {...base(size, color, strokeWidth, decorative)}>
        <Path d='M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4' />
        <Path d='m10 17 5-5-5-5' />
        <Line x1={15} y1={12} x2={3} y2={12} />
    </Svg>
);

/** Four-point sparkle — Ojo Pro. */
export const SparkleIcon = ({
    size = 18,
    color = 'rgba(255,255,255,0.85)',
    strokeWidth = 1.6,
    decorative = true,
}: GlyphProps) => (
    <Svg {...base(size, color, strokeWidth, decorative)}>
        <Path d='M12 3c.5 4.5 2.5 6.5 7 7-4.5.5-6.5 2.5-7 7-.5-4.5-2.5-6.5-7-7 4.5-.5 6.5-2.5 7-7z' />
    </Svg>
);
