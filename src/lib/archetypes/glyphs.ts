/**
 * glyphs.ts — the glyph vocabulary, as data.
 *
 * Kept free of React so `catalog.ts` and its tests can depend on it under the
 * node test environment (jest `testMatch` is `.ts` only — see the note in
 * docs/zero-catalog-first-value.md §5).
 *
 * The components these name are used for any garment without a photo, real or
 * archetype — see src/components/GarmentSilhouette.tsx.
 *
 * The other half of the contract lives in
 * `src/components/icons/garments/index.tsx`, which declares
 * `Record<GlyphKey, GarmentGlyph>`. That makes "every key resolves to a real
 * component" a compile-time guarantee rather than a runtime hope; this file
 * makes "every archetype names a real key" a testable one.
 *
 * Several archetypes deliberately share a glyph — "Cotton T-shirt" and
 * "Performance tee" are the same silhouette. The archetype's `displayName`
 * carries the distinction; the glyph carries the shape.
 */

export const GLYPH_KEYS = [
  // Tops
  'tee', 'shirt', 'blouse',
  // Mid layers
  'hoodie', 'sweater', 'cardigan',
  // Outerwear
  'jacket', 'puffer', 'coat', 'rainShell',
  // Bottoms
  'jeans', 'trousers', 'shorts', 'skirt', 'leggings',
  // Full body
  'dress',
  // Footwear
  'sneaker', 'dressShoe', 'boot', 'sandal',
  // Accessories
  'cap', 'beanie', 'sunHat', 'scarf', 'gloves', 'belt', 'bag', 'socks', 'watch',
] as const;

export type GlyphKey = typeof GLYPH_KEYS[number];

const GLYPH_KEY_SET: ReadonlySet<string> = new Set(GLYPH_KEYS);

export const isGlyphKey = (v: string): v is GlyphKey => GLYPH_KEY_SET.has(v);
