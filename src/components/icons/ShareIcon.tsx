/**
 * ShareIcon — the platform "share" glyph (a box with an arrow leaving it), in
 * the same Feather-style stroke as CameraIcon / GearIcon. Replaces the "···"
 * that used to stand for share on the outfit card, which read as "more".
 */
import { Svg, Path } from 'react-native-svg';

interface ShareIconProps {
    size?: number;
    color?: string;
    strokeWidth?: number;
    /** Decorative by default: it sits inside an already-labeled control. */
    decorative?: boolean;
}

const ShareIcon = ({
    size = 16,
    color = 'rgba(255,255,255,0.85)',
    strokeWidth = 1.6,
    decorative = true,
}: ShareIconProps) => (
    <Svg
        width={size}
        height={size}
        viewBox='0 0 24 24'
        fill='none'
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap='round'
        strokeLinejoin='round'
        accessibilityElementsHidden={decorative}
        importantForAccessibility={decorative ? 'no' : 'auto'}
    >
        <Path d='M8 9H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2h-2' />
        <Path d='M12 15V3' />
        <Path d='M8 7l4-4 4 4' />
    </Svg>
);

export default ShareIcon;
