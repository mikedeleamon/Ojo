import { Svg, Path } from 'react-native-svg';
import { useTheme } from '../../theme/ThemeContext';

export const HangerIcon = ({
    size = 24,
    color,
    decorative = false,
}: {
    size?: number;
    color?: string;
    decorative?: boolean;
}) => {
    const { colors: themeColors } = useTheme();
    const resolvedColor = color ?? themeColors.textSecondary;
    return (
        <Svg
            width={size}
            height={size}
            viewBox='0 0 24 24'
            fill='none'
            accessibilityElementsHidden={decorative}
            importantForAccessibility={decorative ? 'no' : 'auto'}
        >
            <Path
                d='M12 4a2 2 0 0 1 2 2c0 .74-.4 1.38-1 1.73V9l8 5.5A1 1 0 0 1 20 16H4a1 1 0 0 1-.99-1.5L11 9V7.73A2 2 0 0 1 12 4Z'
                stroke={resolvedColor}
                strokeWidth={1.5}
                strokeLinecap='round'
                strokeLinejoin='round'
            />
        </Svg>
    );
};
