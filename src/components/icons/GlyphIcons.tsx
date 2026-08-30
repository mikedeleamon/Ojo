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
}

const base = (size: number, color: string, strokeWidth: number) => ({
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none' as const,
    stroke: color,
    strokeWidth,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    accessibilityElementsHidden: true,
    importantForAccessibility: 'no' as const,
});

/** Paper plane — replaces ✈️ on trip/flight affordances. */
export const PlaneIcon = ({
    size = 16,
    color = 'rgba(255,255,255,0.85)',
    strokeWidth = 1.6,
}: GlyphProps) => (
    <Svg {...base(size, color, strokeWidth)}>
        <Path d='M22 2 11 13' />
        <Path d='M22 2 15 22l-4-9-9-4z' />
    </Svg>
);

/** Map pin — replaces 📍 on destination summaries. */
export const PinIcon = ({
    size = 16,
    color = 'rgba(255,255,255,0.85)',
    strokeWidth = 1.6,
}: GlyphProps) => (
    <Svg {...base(size, color, strokeWidth)}>
        <Path d='M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z' />
        <Circle cx={12} cy={10} r={3} />
    </Svg>
);

/** Circular arrows — replaces 🔄 on the stale-forecast refresh banner. */
export const RefreshIcon = ({
    size = 16,
    color = 'rgba(255,255,255,0.85)',
    strokeWidth = 1.6,
}: GlyphProps) => (
    <Svg {...base(size, color, strokeWidth)}>
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
}: GlyphProps) => (
    <Svg {...base(size, color, strokeWidth)}>
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
}: GlyphProps) => (
    <Svg {...base(size, color, strokeWidth)}>
        <Rect x={3} y={3} width={18} height={18} rx={2} ry={2} />
        <Circle cx={8.5} cy={8.5} r={1.5} />
        <Path d='m21 15-5-5L5 21' />
    </Svg>
);
