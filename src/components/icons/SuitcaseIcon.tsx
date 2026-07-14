/**
 * SuitcaseIcon — Feather-style line icon (24×24 viewBox, stroke-only), matching
 * the stroke language of GearIcon / LocationsIcon / CameraIcon. Replaces the
 * 🧳 emoji used as a decorative "packing/trip" marker across TripFit so it
 * reads as designed rather than emoji-as-placeholder.
 */
import { Svg, Rect, Path } from 'react-native-svg';

interface SuitcaseIconProps {
    size?: number;
    color?: string;
    strokeWidth?: number;
}

const SuitcaseIcon = ({
    size = 16,
    color = 'rgba(255,255,255,0.85)',
    strokeWidth = 1.6,
}: SuitcaseIconProps) => (
    <Svg
        width={size}
        height={size}
        viewBox='0 0 24 24'
        fill='none'
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap='round'
        strokeLinejoin='round'
        accessibilityElementsHidden={true}
        importantForAccessibility='no'
    >
        <Rect x={3} y={7} width={18} height={13} rx={2} />
        <Path d='M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2' />
        <Path d='M3 12h18' />
    </Svg>
);

export default SuitcaseIcon;
