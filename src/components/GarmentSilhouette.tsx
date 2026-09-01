/**
 * GarmentSilhouette
 * ─────────────────
 * The line illustration for a garment that has no photo.
 *
 * Most closets have a few items the user added by hand and never photographed,
 * and until now every one of them rendered the same muted coat-hanger. A hanger
 * reads as a *failed image load* — a hole where a picture should be — rather
 * than as "no picture was taken". Drawing the garment instead says the right
 * thing, costs nothing, and makes a half-photographed closet look deliberate.
 *
 * Returns null for clothing types with no silhouette (e.g. Jewelry), so callers
 * keep the hanger as a last resort rather than rendering a wrong shape.
 */
import { useMemo } from 'react';
import { GARMENT_GLYPHS } from './icons/garments';
import type { GlyphKey } from '../lib/archetypes/glyphs';
import { useTheme } from '../theme/ThemeContext';

/**
 * `clothingType` (the engine's title-case vocabulary) → silhouette.
 *
 * Deliberately partial. `Hat` maps to the wide-brimmed shape rather than the
 * beanie because the app has a separate `Cap` type, so an ambiguous "Hat" is
 * more often a sun hat than winter headwear.
 */
const GLYPH_FOR_TYPE: Record<string, GlyphKey> = {
  'T-Shirt': 'tee',
  Tank:      'tee',
  Shirt:     'shirt',
  Blouse:    'blouse',
  Hoodie:    'hoodie',
  Sweater:   'sweater',
  Jacket:    'jacket',
  Coat:      'coat',
  Pants:     'trousers',
  Jeans:     'jeans',
  Shorts:    'shorts',
  Skirt:     'skirt',
  Dress:     'dress',
  Shoes:     'dressShoe',
  Sneakers:  'sneaker',
  Boots:     'boot',
  Sandals:   'sandal',
  Cap:       'cap',
  Hat:       'sunHat',
  Scarf:     'scarf',
  Gloves:    'gloves',
  Belt:      'belt',
  Bag:       'bag',
  Socks:     'socks',
  Watch:     'watch',
};

/** The silhouette component for a clothing type, or null when there isn't one. */
export const silhouetteFor = (clothingType?: string | null) => {
  if (!clothingType) return null;
  const key = GLYPH_FOR_TYPE[clothingType];
  return key ? GARMENT_GLYPHS[key] : null;
};

/** True when this garment has a silhouette to draw. Lets callers branch cheaply. */
export const hasSilhouette = (clothingType?: string | null): boolean =>
  silhouetteFor(clothingType) !== null;

interface Props {
  clothingType?: string | null;
  size?: number;
  color?: string;
  /** Already decorative by default — this illustration has no label of its
   *  own and is meant to sit inside an already-labeled photo frame/row. Pass
   *  false to expose it to the accessibility tree. */
  decorative?: boolean;
}

export default function GarmentSilhouette({ clothingType, size = 22, color, decorative = true }: Props) {
  const { colors } = useTheme();
  const Glyph = useMemo(() => silhouetteFor(clothingType), [clothingType]);
  if (!Glyph) return null;
  // Slightly lighter stroke than the app-chrome icons: this sits inside a photo
  // frame, so it should read as an illustration of a garment rather than as
  // another piece of UI furniture.
  return <Glyph size={size} color={color ?? colors.textMuted} strokeWidth={1.4} decorative={decorative} />;
}
