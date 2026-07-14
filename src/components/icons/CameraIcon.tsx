/**
 * CameraIcon — Feather-style line icon (24×24 viewBox, stroke-only), matching
 * the stroke language of GearIcon / LocationsIcon. Replaces the 📸 emoji used
 * as a "share to Instagram" affordance so it reads as designed rather than
 * emoji-as-placeholder.
 */
import { Svg, Circle, Path } from 'react-native-svg';

interface CameraIconProps {
    size?: number;
    color?: string;
    strokeWidth?: number;
}

const CameraIcon = ({
    size = 16,
    color = 'rgba(255,255,255,0.85)',
    strokeWidth = 1.6,
}: CameraIconProps) => (
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
        <Path d='M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z' />
        <Circle cx={12} cy={13} r={4} />
    </Svg>
);

export default CameraIcon;
