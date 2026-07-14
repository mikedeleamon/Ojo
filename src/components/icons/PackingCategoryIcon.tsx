/**
 * PackingCategoryIcon
 * ───────────────────
 * Feather-style line icons (24×24 viewBox, stroke-only) for the five TripFit
 * packing-list categories, replacing the emoji PACKING_GROUPS used to carry
 * (👕 👖 🧥 👟 👜) so the packing list reads as designed rather than
 * emoji-as-placeholder. Dispatches on the same category keys categoryKey()
 * returns: 'top' | 'bottom' | 'outerwear' | 'footwear' | 'accessory'.
 */
import { Svg, Path } from 'react-native-svg';

interface ShapeProps {
    size: number;
    color: string;
    strokeWidth: number;
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

const TopShape = ({ size, color, strokeWidth }: ShapeProps) => (
    <Svg {...base(size, color, strokeWidth)}>
        <Path d='M9 3L4 6l2 4 2-1.5V20h8V8.5L18 10l2-4-5-3v.5c0 1.5-1.3 2.5-3 2.5s-3-1-3-2.5V3z' />
    </Svg>
);

const BottomShape = ({ size, color, strokeWidth }: ShapeProps) => (
    <Svg {...base(size, color, strokeWidth)}>
        <Path d='M7 3h10v9l-1.5 8h-3L12 12.5 11.5 20h-3L7 12V3z' />
    </Svg>
);

const OuterwearShape = ({ size, color, strokeWidth }: ShapeProps) => (
    <Svg {...base(size, color, strokeWidth)}>
        <Path d='M9 3L4 6l2 4 2-1.5V20h3.3V6.5' />
        <Path d='M15 3l5 3-2 4-2-1.5V20h-3.3V6.5' />
        <Path d='M9 3l2 2.5' />
        <Path d='M15 3l-2 2.5' />
    </Svg>
);

const FootwearShape = ({ size, color, strokeWidth }: ShapeProps) => (
    <Svg {...base(size, color, strokeWidth)}>
        <Path d='M3 18v-3c0-2 1.5-3 3-3h5l2-3h3v3h3c1.5 0 2.5 1 2.5 2.5V18H3z' />
    </Svg>
);

const AccessoryShape = ({ size, color, strokeWidth }: ShapeProps) => (
    <Svg {...base(size, color, strokeWidth)}>
        <Path d='M7 8c0-3 1.5-5 3-5h4c1.5 0 3 2 3 5' />
        <Path d='M5 8h14l-1 12H6L5 8z' />
    </Svg>
);

interface PackingCategoryIconProps {
    /** categoryKey() output — 'top' | 'bottom' | 'outerwear' | 'footwear' | 'accessory'. */
    category: string;
    size?: number;
    color?: string;
    strokeWidth?: number;
}

export const PackingCategoryIcon = ({
    category,
    size = 14,
    color = 'rgba(255,255,255,0.85)',
    strokeWidth = 1.6,
}: PackingCategoryIconProps) => {
    const shapeProps = { size, color, strokeWidth };
    switch (category) {
        case 'bottom':
            return <BottomShape {...shapeProps} />;
        case 'outerwear':
            return <OuterwearShape {...shapeProps} />;
        case 'footwear':
            return <FootwearShape {...shapeProps} />;
        case 'accessory':
            return <AccessoryShape {...shapeProps} />;
        case 'top':
        default:
            return <TopShape {...shapeProps} />;
    }
};
