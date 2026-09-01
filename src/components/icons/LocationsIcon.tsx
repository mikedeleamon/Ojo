import { Svg, Circle, Path } from 'react-native-svg';

interface LocationsIconProps {
    width?: number;
    height?: number;
    stroke?: string;
    strokeWidth?: number;
    /** Already decorative by default — no label of its own, meant to sit
     *  inside an already-labeled control. Pass false to expose it. */
    decorative?: boolean;
}

// Map-pin glyph, matching GearIcon's stroke style. Used to open the
// saved-cities switcher from the weather HUD header.
const LocationsIcon = ({
    width = 22,
    height = 22,
    stroke = 'rgba(255,255,255,0.85)',
    strokeWidth = 1.5,
    decorative = true,
}: LocationsIconProps) => (
    <Svg
        width={width}
        height={height}
        viewBox='0 0 24 24'
        fill='none'
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeLinecap='round'
        strokeLinejoin='round'
        accessibilityElementsHidden={decorative}
        importantForAccessibility={decorative ? 'no' : 'auto'}
    >
        <Path d='M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z' />
        <Circle cx={12} cy={10} r={3} />
    </Svg>
);

export default LocationsIcon;
