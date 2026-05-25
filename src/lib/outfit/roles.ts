import type { ClothingArticle, BodyZone } from '../../types';
import type { OutfitRole } from './types';

const ROLE_MAP: Record<string, OutfitRole> = {
  Shirt: 'top', 'T-Shirt': 'top', Blouse: 'top',
  Hoodie: 'midLayer', Sweater: 'midLayer',
  Jacket: 'outerwear', Coat: 'outerwear',
  Pants: 'bottom', Jeans: 'bottom', Shorts: 'bottom', Skirt: 'bottom',
  Dress: 'fullBody',
  Shoes: 'footwear', Sneakers: 'footwear', Boots: 'footwear', Sandals: 'footwear',
  Hat: 'accessory', Cap: 'accessory', Scarf: 'accessory', Gloves: 'accessory',
  Belt: 'accessory', Bag: 'accessory', Watch: 'accessory', Jewelry: 'accessory', Socks: 'accessory',
};

export const roleOf = (a: ClothingArticle): OutfitRole =>
  ROLE_MAP[a.clothingType] ?? (a.isAccessory ? 'accessory' : 'top');

const ZONE_FROM_TYPE: Record<string, BodyZone> = {
  Hat: 'Head', Cap: 'Head',
  Scarf: 'Neck', Jewelry: 'Neck',
  Gloves: 'Hand',
  Belt: 'Waist',
  Watch: 'Wrist',
  Socks: 'Ankle',
  Bag: 'Carried',
};

export const zoneOf = (a: ClothingArticle): BodyZone =>
  a.bodyZone ?? ZONE_FROM_TYPE[a.clothingType] ?? 'Carried';

/** Human-readable zone label for an accessory article. */
export const articleZoneLabel = (a: ClothingArticle): string =>
  a.bodyZone ?? ZONE_FROM_TYPE[a.clothingType] ?? 'Extra';

/**
 * Generates all valid accessory combinations:
 *   - empty (no accessories)
 *   - single items
 *   - pairs from different body zones (non-competing)
 * Capped at 4 input articles to keep the combination space manageable.
 */
export const buildAccCombos = (accessories: ClothingArticle[]): ClothingArticle[][] => {
  const items = accessories.slice(0, 4);
  const combos: ClothingArticle[][] = [[]];
  for (const a of items) combos.push([a]);
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      if (zoneOf(items[i]) !== zoneOf(items[j])) {
        combos.push([items[i], items[j]]);
      }
    }
  }
  return combos;
};
