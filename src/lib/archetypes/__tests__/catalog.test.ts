/**
 * The catalog is data, so it is validated rather than exercised. Every
 * assertion here corresponds to a way a bad row would fail *silently* at
 * runtime — see docs/zero-catalog-first-value.md §7.
 */
import { ARCHETYPE_CATALOG, archetypeById } from '../catalog';
import { GLYPH_KEYS, isGlyphKey } from '../glyphs';
import { archetypeToArticle } from '../genericOutfit';
import { ROLE_MAP, roleOf } from '../../outfit/roles';
import { GARMENT_WARMTH_BASE, FABRIC_WARMTH_MOD } from '../../outfitEngine';
import { CLIMATE_BANDS } from '../../climate';

/**
 * Mirror of the map in src/components/GarmentSilhouette.tsx. Duplicated here on
 * purpose: that file imports react-native-svg, which cannot load under the node
 * test environment (jest `testMatch` is `.ts` only). Keeping a plain key set in
 * lockstep is the cheapest way to still catch a catalog type with no silhouette.
 */
const GLYPH_FOR_CLOTHING_TYPE = new Set([
  'T-Shirt', 'Tank', 'Shirt', 'Blouse', 'Hoodie', 'Sweater', 'Jacket', 'Coat',
  'Pants', 'Jeans', 'Shorts', 'Skirt', 'Dress', 'Shoes', 'Sneakers', 'Boots',
  'Sandals', 'Cap', 'Hat', 'Scarf', 'Gloves', 'Belt', 'Bag', 'Socks', 'Watch',
]);

describe('archetype catalog', () => {
  it('is non-trivial', () => {
    expect(ARCHETYPE_CATALOG.length).toBeGreaterThanOrEqual(45);
  });

  it('has unique ids', () => {
    const ids = ARCHETYPE_CATALOG.map(a => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every clothingType is a key in ROLE_MAP', () => {
    // A type missing here does not throw — roleOf() falls through to 'top' and
    // the garment quietly lands in the wrong slot forever.
    for (const a of ARCHETYPE_CATALOG) {
      expect(Object.prototype.hasOwnProperty.call(ROLE_MAP, a.clothingType))
        .toBe(true);
    }
  });

  it('every garment clothingType is a key in GARMENT_WARMTH_BASE', () => {
    // Accessories are exempt by design: GARMENT_WARMTH_BASE covers body-warmth
    // garments only, and an accessory's warmth never enters an outfit's thermal
    // alignment — it is scored on its own, where the 0.30 default is inert.
    for (const a of ARCHETYPE_CATALOG) {
      if (a.isAccessory) continue;
      expect(Object.prototype.hasOwnProperty.call(GARMENT_WARMTH_BASE, a.clothingType))
        .toBe(true);
    }
  });

  it('every fabricHint is a key in FABRIC_WARMTH_MOD', () => {
    for (const a of ARCHETYPE_CATALOG) {
      expect(Object.prototype.hasOwnProperty.call(FABRIC_WARMTH_MOD, a.fabricHint))
        .toBe(true);
    }
  });

  it('every glyph is a real glyph key', () => {
    // The other half of the contract — that every key resolves to an exported
    // component — is enforced by the `Record<GlyphKey, GarmentGlyph>` type on
    // src/components/icons/garments/index.tsx, checked by `tsc --noEmit`.
    // A render test cannot cover it: jest `testMatch` is `.ts` only.
    for (const a of ARCHETYPE_CATALOG) {
      expect(isGlyphKey(a.glyph)).toBe(true);
    }
  });

  it('uses every declared glyph (no dead silhouettes)', () => {
    const used = new Set(ARCHETYPE_CATALOG.map(a => a.glyph));
    for (const key of GLYPH_KEYS) expect(used.has(key)).toBe(true);
  });

  it('every clothingType in the catalog has a silhouette', () => {
    // GarmentSilhouette maps the engine's clothingType vocabulary onto these
    // glyphs for any garment without a photo, real or archetype. A catalog type
    // missing from that map silently falls back to a coat-hanger.
    for (const a of ARCHETYPE_CATALOG) {
      expect(`${a.clothingType}:${GLYPH_FOR_CLOTHING_TYPE.has(a.clothingType)}`)
        .toBe(`${a.clothingType}:true`);
    }
  });

  it('prevalence covers all bands with values in [0,1]', () => {
    for (const a of ARCHETYPE_CATALOG) {
      for (const band of CLIMATE_BANDS) {
        const v = a.prevalence[band];
        expect(typeof v).toBe('number');
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(1);
      }
      expect(a.commonality).toBeGreaterThan(0);
      expect(a.commonality).toBeLessThanOrEqual(1);
    }
  });

  it('accessories carry a bodyZone, garments do not', () => {
    for (const a of ARCHETYPE_CATALOG) {
      if (a.isAccessory) {
        expect(a.bodyZone).toBeDefined();
        expect(roleOf(archetypeToArticle(a))).toBe('accessory');
      } else {
        expect(a.bodyZone).toBeUndefined();
        expect(roleOf(archetypeToArticle(a))).not.toBe('accessory');
      }
    }
  });

  it('only ever declares a real wardrobe gender', () => {
    for (const a of ARCHETYPE_CATALOG) {
      if (a.gender === undefined) continue;
      expect(["Men's", "Women's"]).toContain(a.gender);
    }
  });

  it('archetypeById finds every entry and nothing else', () => {
    for (const a of ARCHETYPE_CATALOG) expect(archetypeById(a.id)).toBe(a);
    expect(archetypeById('does_not_exist')).toBeUndefined();
  });
});
