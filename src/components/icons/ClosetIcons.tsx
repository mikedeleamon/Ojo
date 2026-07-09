/**
 * ClosetIcons
 * ───────────
 * Feather-style line icons used across the closet screen, matching the stroke
 * language of GearIcon / LocationsIcon (24×24 viewBox, 1.5 stroke, round caps).
 * They replace the emoji/glyphs the screen used to lean on so the UI reads as
 * intentionally designed rather than placeholder.
 */
import { Svg, Circle, Path, Rect, Line, Defs, LinearGradient, Stop } from 'react-native-svg';

interface IconProps {
    size?: number;
    color?: string;
    strokeWidth?: number;
}

const DEFAULT_COLOR = 'rgba(255,255,255,0.85)';

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

export const SearchIcon = ({ size = 16, color = DEFAULT_COLOR, strokeWidth = 1.5 }: IconProps) => (
    <Svg {...base(size, color, strokeWidth)}>
        <Circle cx={11} cy={11} r={7} />
        <Path d='M21 21l-4.3-4.3' />
    </Svg>
);

// Composite suitcase + codebase plane — TripFit entry point icon.
// Diagonal gradient (light lime → deep green) applied to both the stroked
// suitcase and the filled plane so they read as one cohesive surface.
export const TripFitIcon = ({ size = 24 }: { size?: number }) => (
    <Svg
        width={size}
        height={size}
        viewBox='0 0 64 64'
        fill='none'
        strokeWidth={2.8}
        strokeLinecap='round'
        strokeLinejoin='round'
        accessibilityElementsHidden
        importantForAccessibility='no'
    >
        <Defs>
            <LinearGradient
                id='tripGrad'
                x1='16' y1='14' x2='48' y2='56'
                gradientUnits='userSpaceOnUse'
            >
                <Stop offset='0' stopColor='#C8FF78' />
                <Stop offset='1' stopColor='#4BAA15' />
            </LinearGradient>
        </Defs>
        <Rect x={16} y={18} width={32} height={36} rx={4} stroke='url(#tripGrad)' />
        <Path d='M26 18v-4h12v4' stroke='url(#tripGrad)' />
        <Circle cx={24} cy={56} r={1.5} stroke='url(#tripGrad)' />
        <Circle cx={40} cy={56} r={1.5} stroke='url(#tripGrad)' />
        <Path
            d='M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5z'
            fill='url(#tripGrad)'
            stroke='none'
            transform='translate(21.65 24.525) scale(0.9)'
        />
    </Svg>
);

export const CheckIcon = ({ size = 16, color = DEFAULT_COLOR, strokeWidth = 1.8 }: IconProps) => (
    <Svg {...base(size, color, strokeWidth)}>
        <Path d='M20 6L9 17l-5-5' />
    </Svg>
);

export const CloseIcon = ({ size = 16, color = DEFAULT_COLOR, strokeWidth = 1.6 }: IconProps) => (
    <Svg {...base(size, color, strokeWidth)}>
        <Path d='M18 6L6 18M6 6l12 12' />
    </Svg>
);

// Descending bars — "sort" affordance.
export const SortIcon = ({ size = 18, color = DEFAULT_COLOR, strokeWidth = 1.5 }: IconProps) => (
    <Svg {...base(size, color, strokeWidth)}>
        <Path d='M4 7h13M4 12h9M4 17h5' />
    </Svg>
);

// Sliders — "filters" affordance.
export const FilterIcon = ({ size = 16, color = DEFAULT_COLOR, strokeWidth = 1.5 }: IconProps) => (
    <Svg {...base(size, color, strokeWidth)}>
        <Line x1={4} y1={8} x2={20} y2={8} />
        <Line x1={4} y1={16} x2={20} y2={16} />
        <Circle cx={9} cy={8} r={2.4} />
        <Circle cx={15} cy={16} r={2.4} />
    </Svg>
);

export const GridIcon = ({ size = 18, color = DEFAULT_COLOR, strokeWidth = 1.5 }: IconProps) => (
    <Svg {...base(size, color, strokeWidth)}>
        <Rect x={4} y={4} width={7} height={7} rx={1.5} />
        <Rect x={13} y={4} width={7} height={7} rx={1.5} />
        <Rect x={13} y={13} width={7} height={7} rx={1.5} />
        <Rect x={4} y={13} width={7} height={7} rx={1.5} />
    </Svg>
);

export const ListIcon = ({ size = 18, color = DEFAULT_COLOR, strokeWidth = 1.5 }: IconProps) => (
    <Svg {...base(size, color, strokeWidth)}>
        <Path d='M9 6h11M9 12h11M9 18h11' />
        <Circle cx={4.5} cy={6} r={1.1} fill={color} stroke='none' />
        <Circle cx={4.5} cy={12} r={1.1} fill={color} stroke='none' />
        <Circle cx={4.5} cy={18} r={1.1} fill={color} stroke='none' />
    </Svg>
);

export const MoreIcon = ({ size = 18, color = DEFAULT_COLOR, strokeWidth = 1.5 }: IconProps) => (
    <Svg {...base(size, color, strokeWidth)}>
        <Circle cx={5} cy={12} r={1.4} fill={color} stroke='none' />
        <Circle cx={12} cy={12} r={1.4} fill={color} stroke='none' />
        <Circle cx={19} cy={12} r={1.4} fill={color} stroke='none' />
    </Svg>
);

export const PlusIcon = ({ size = 20, color = DEFAULT_COLOR, strokeWidth = 1.6 }: IconProps) => (
    <Svg {...base(size, color, strokeWidth)}>
        <Path d='M12 5v14M5 12h14' />
    </Svg>
);

export const ChevronRightIcon = ({ size = 18, color = DEFAULT_COLOR, strokeWidth = 1.5 }: IconProps) => (
    <Svg {...base(size, color, strokeWidth)}>
        <Path d='M9 6l6 6-6 6' />
    </Svg>
);
