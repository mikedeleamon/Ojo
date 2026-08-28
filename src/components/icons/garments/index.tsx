/**
 * Garment glyphs
 * ──────────────
 * Line illustrations for the archetype closet — the garments a user is assumed
 * to own but has never photographed.
 *
 * Why these exist (docs/zero-catalog-first-value.md §5): when `imageUrl` is
 * absent, OutfitSuggestion falls back to a muted HangerIcon, which reads as a
 * *missing photo* — a broken-looking hole where a garment should be. An
 * archetype is not a garment whose photo failed to load; it is a garment we
 * are describing rather than showing, and it needs its own visual register.
 *
 * Language matches ClosetIcons/WeatherIcons: 24×24 viewBox, 1.5 stroke, round
 * caps and joins, no fill. Several archetypes deliberately share a silhouette —
 * "Cotton T-shirt" and "Performance tee" are the same shape, and the display
 * name carries the difference.
 *
 * The `Record<GlyphKey, GarmentGlyph>` annotation on GARMENT_GLYPHS is what
 * makes "every glyph key resolves to a real component" a compile-time
 * guarantee. It has to be: jest `testMatch` is `.ts` only, so no render test
 * can cover this file.
 */
import { Svg, Path, Rect, Circle, Ellipse } from 'react-native-svg';
import type { GlyphKey } from '../../../lib/archetypes/glyphs';

export interface GarmentGlyphProps {
  size?: number;
  color?: string;
  strokeWidth?: number;
}

export type GarmentGlyph = (props: GarmentGlyphProps) => React.ReactElement;

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

/** Builds a glyph from one or more path strings — the common case. */
const glyph = (...d: string[]): GarmentGlyph =>
  function Glyph({ size = 24, color = DEFAULT_COLOR, strokeWidth = 1.5 }: GarmentGlyphProps) {
    return (
      <Svg {...base(size, color, strokeWidth)}>
        {d.map((p, i) => <Path key={i} d={p} />)}
      </Svg>
    );
  };

// ─── Tops ─────────────────────────────────────────────────────────────────────
const Tee = glyph(
  'M9 4 L4.5 6.5 L3 10 L6 11.5 L6.5 10.5 V20 H17.5 V10.5 L18 11.5 L21 10 L19.5 6.5 L15 4',
  'M9 4 C10 5.8 14 5.8 15 4',
);

const Shirt = glyph(
  'M9 4 L5 6.2 L3.5 13 L6 13.5 V20 H18 V13.5 L20.5 13 L19 6.2 L15 4',
  'M9 4 L12 7.5 L15 4',
  'M12 7.5 V20',
);

const Blouse = glyph(
  'M9 4 L5 6.5 L3.5 12.5 L6 13.5 V20 H18 V13.5 L20.5 12.5 L19 6.5 L15 4 L12 8.5 Z',
  'M6 17.5 C9 19 15 19 18 17.5',
);

// ─── Mid layers ───────────────────────────────────────────────────────────────
const Hoodie = glyph(
  'M8.5 5.5 L4.5 7.5 L3 12.5 L6 13.5 V20 H18 V13.5 L21 12.5 L19.5 7.5 L15.5 5.5',
  'M8.5 5.5 C9.5 9 14.5 9 15.5 5.5',
  'M8.5 15.5 H15.5',
  'M10.5 8.5 V11 M13.5 8.5 V11',
);

const Sweater = glyph(
  'M9 4.5 L4.5 6.5 L3 12 L5.8 13 V19.5 H18.2 V13 L21 12 L19.5 6.5 L15 4.5',
  'M9 4.5 C10 6.6 14 6.6 15 4.5',
  'M5.8 17.5 H18.2',
);

const Cardigan = glyph(
  'M9 4.5 L4.5 6.5 L3 12 L5.8 13 V19.5 H18.2 V13 L21 12 L19.5 6.5 L15 4.5',
  'M9 4.5 L12 6.5 L15 4.5',
  'M12 6.5 V19.5',
);

// ─── Outerwear ────────────────────────────────────────────────────────────────
const Jacket = glyph(
  'M9 4 L4.5 6.5 L3.5 13 L6 13.5 V20 H18 V13.5 L20.5 13 L19.5 6.5 L15 4',
  'M9 4 L12 9 L15 4',
  'M12 9 V20',
  'M6.5 15.5 H9 M15 15.5 H17.5',
);

const Puffer = glyph(
  'M9 4 L4.5 6.5 L3.5 13 L6 13.5 V20 H18 V13.5 L20.5 13 L19.5 6.5 L15 4',
  'M9 4 L12 8 L15 4',
  'M12 8 V20',
  'M6 11.5 H18 M6 15 H18 M6 18 H18',
);

const Coat = glyph(
  'M9 3.5 L5 6 L4 21 H20 L19 6 L15 3.5',
  'M9 3.5 L12 8.5 L15 3.5',
  'M12 8.5 V21',
  'M6.5 13 H17.5',
);

const RainShell = glyph(
  'M8.5 5.5 L4.5 7.5 L3.5 13.5 L6 14 V20 H18 V14 L20.5 13.5 L19.5 7.5 L15.5 5.5',
  'M8.5 5.5 C9.5 9 14.5 9 15.5 5.5',
  'M12 9 V20',
);

// ─── Bottoms ──────────────────────────────────────────────────────────────────
const Jeans = glyph(
  'M6 4 H18 L17 21 H13.6 L12 11 L10.4 21 H7 Z',
  'M6 7 H18',
  'M8 9 L9.5 10.5 M16 9 L14.5 10.5',
);

const Trousers = glyph(
  'M6.5 4 H17.5 L16.8 21 H13.4 L12 10.5 L10.6 21 H7.2 Z',
  'M6.6 6.8 H17.4',
);

const Shorts = glyph(
  'M6 5 H18 L17.4 15.5 H13.6 L12 10.5 L10.4 15.5 H6.6 Z',
  'M6.1 7.8 H17.9',
);

const Skirt = glyph(
  'M7.5 5 H16.5 L20 20 H4 Z',
  'M7.6 7.8 H16.4',
);

const Leggings = glyph(
  'M7.5 4 H16.5 L15.4 21 H13.1 L12 11 L10.9 21 H8.6 Z',
  'M7.6 6.5 H16.4',
);

// ─── Full body ────────────────────────────────────────────────────────────────
const Dress = glyph(
  'M9 4 L7 6.2 L8.6 11 L5 20 H19 L15.4 11 L17 6.2 L15 4',
  'M9 4 L12 6.8 L15 4',
  'M8.6 11 H15.4',
);

// ─── Footwear ─────────────────────────────────────────────────────────────────
const Sneaker = glyph(
  'M3 17.5 V12.8 C3 12.2 3.5 11.8 4.3 11.8 H6.8 L9.8 14.2 H14.6 C18.2 14.2 21 15.2 21 17 V17.5 Z',
  'M3 15.8 H21',
  'M6.8 11.8 L8.4 13.6 M8.6 12.4 L10.2 14.2',
);

const DressShoe = glyph(
  'M3 17.5 V13.6 C3 13 3.4 12.6 4.2 12.6 H6.4 C8.2 12.6 9.6 14.2 12.4 14.9 C16 15.8 20 15.9 21 16.8 V17.5 Z',
  'M6.6 12.6 C7.4 13.9 8.4 14.5 9.6 14.8',
);

const Boot = glyph(
  'M6.5 4 H10.5 V13 C10.5 14.8 12.8 15.4 15.8 16 C18.4 16.5 20 16.9 20 18.4 V19.5 H6.5 Z',
  'M6.5 8 H10.5',
  'M6.5 17 H20',
);

const Sandal = glyph(
  'M4 17.5 H20',
  'M6.5 17.5 L10 11.5 M17.5 17.5 L14 11.5',
  'M8.2 14 H15.8',
);

// ─── Accessories ──────────────────────────────────────────────────────────────
const Cap = glyph(
  'M5.5 14.5 C5.5 9.8 8.4 7 12 7 C15.6 7 18.5 9.8 18.5 14.5 Z',
  'M18.5 14.5 C20.8 14.5 22 15.2 22 16.2 H5.5 V14.5',
  'M12 7 V4.8',
);

const Beanie = glyph(
  'M6 14 C6 9.6 8.6 6.5 12 6.5 C15.4 6.5 18 9.6 18 14 Z',
  'M4.8 14 H19.2 V17.2 H4.8 Z',
  'M12 6.5 V4.5',
);

const SunHat: GarmentGlyph = ({ size = 24, color = DEFAULT_COLOR, strokeWidth = 1.5 }) => (
  <Svg {...base(size, color, strokeWidth)}>
    <Path d="M8 13 C8 9 9.6 6.5 12 6.5 C14.4 6.5 16 9 16 13" />
    <Ellipse cx={12} cy={13.6} rx={9} ry={3} />
  </Svg>
);

const Scarf = glyph(
  'M8 5 C6 9 8.2 12 12 12 C15.8 12 18 9 16 5',
  'M10.2 11.8 V20 M13.8 11.8 V20',
  'M9.6 20 H10.8 M13.2 20 H14.4',
);

const Gloves = glyph(
  'M8 20 V10 C8 7 9.8 5 12 5 C14.2 5 16 7 16 10 V20 Z',
  'M16 12.5 C18 12.5 19.2 13.5 19.2 15 C19.2 16.5 18 17.4 16 17.4',
  'M10.2 8.6 V5.6 M12 7.8 V4.6 M13.8 8.6 V5.6',
);

const Belt: GarmentGlyph = ({ size = 24, color = DEFAULT_COLOR, strokeWidth = 1.5 }) => (
  <Svg {...base(size, color, strokeWidth)}>
    <Rect x={2} y={10} width={20} height={4} rx={1.2} />
    <Rect x={8.8} y={8.4} width={6.4} height={7.2} rx={1.2} />
    <Path d="M12 8.4 V15.6" />
  </Svg>
);

const Bag = glyph(
  'M5 9 H19 L18 20 H6 Z',
  'M9 9 V7 C9 5.3 15 5.3 15 7 V9',
);

const Socks = glyph(
  'M9 4 H14 V13 C14 15 15.2 16.2 16.6 17.1 C18.2 18.1 18 20.2 16 20.7 C14 21.2 11.9 20 10.5 18.4 C9.5 17.3 9 15.8 9 13.8 Z',
  'M9 7 H14',
);

const Watch: GarmentGlyph = ({ size = 24, color = DEFAULT_COLOR, strokeWidth = 1.5 }) => (
  <Svg {...base(size, color, strokeWidth)}>
    <Rect x={7.8} y={7.8} width={8.4} height={8.4} rx={2.4} />
    <Path d="M10 7.8 V4 H14 V7.8 M10 16.2 V20 H14 V16.2" />
    <Path d="M12 10.4 V12 L13.4 13" />
    <Circle cx={12} cy={12} r={0.01} />
  </Svg>
);

/**
 * The registry. The `Record<GlyphKey, GarmentGlyph>` annotation is load-bearing:
 * adding a key to GLYPH_KEYS without a component here is a compile error, and
 * an archetype can only name a key that exists.
 */
export const GARMENT_GLYPHS: Record<GlyphKey, GarmentGlyph> = {
  tee: Tee,
  shirt: Shirt,
  blouse: Blouse,
  hoodie: Hoodie,
  sweater: Sweater,
  cardigan: Cardigan,
  jacket: Jacket,
  puffer: Puffer,
  coat: Coat,
  rainShell: RainShell,
  jeans: Jeans,
  trousers: Trousers,
  shorts: Shorts,
  skirt: Skirt,
  leggings: Leggings,
  dress: Dress,
  sneaker: Sneaker,
  dressShoe: DressShoe,
  boot: Boot,
  sandal: Sandal,
  cap: Cap,
  beanie: Beanie,
  sunHat: SunHat,
  scarf: Scarf,
  gloves: Gloves,
  belt: Belt,
  bag: Bag,
  socks: Socks,
  watch: Watch,
};
