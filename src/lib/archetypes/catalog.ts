/**
 * catalog.ts — the archetype catalog, as a typed module (not JSON) so every
 * `clothingType` / `fabricHint` / `glyph` is checkable at compile time and by
 * __tests__/catalog.test.ts.
 *
 * Two hard constraints on every entry (see docs/zero-catalog-first-value.md §2):
 *   1. `clothingType` is a key in ROLE_MAP — otherwise roleOf() silently
 *      returns 'top' and the garment lands in the wrong slot.
 *   2. `clothingType` is a key in GARMENT_WARMTH_BASE (non-accessories) and
 *      `fabricHint` is a key in FABRIC_WARMTH_MOD — otherwise garmentWarmth()
 *      falls back to a default and the thermal alignment score is fiction.
 *
 * `prevalence` is a rough "share of wardrobes in this climate that contain one",
 * used only to pick a starting seed. It is not measured data and does not need
 * to be; the user corrects it by adding real clothes.
 */

import type { ClimateBand } from '../climate';
import type { GarmentArchetype } from './types';

/** Terse helper so the table below reads as a table. Order: tropical, arid, temperate, continental, polar. */
const p = (
  tropical: number, arid: number, temperate: number, continental: number, polar: number,
): Record<ClimateBand, number> => ({ tropical, arid, temperate, continental, polar });

export const ARCHETYPE_CATALOG: readonly GarmentArchetype[] = [
  // ── Tops ────────────────────────────────────────────────────────────────────
  { id: 'top_tee_cotton',      displayName: 'Cotton T-shirt',     clothingType: 'T-Shirt', fabricHint: 'Cotton',    isAccessory: false, prevalence: p(0.95, 0.95, 0.95, 0.92, 0.80), commonality: 1.00, glyph: 'tee' },
  { id: 'top_tee_performance', displayName: 'Performance tee',    clothingType: 'T-Shirt', fabricHint: 'Synthetic', isAccessory: false, prevalence: p(0.75, 0.80, 0.70, 0.65, 0.60), commonality: 0.62, glyph: 'tee' },
  { id: 'top_shirt_oxford',    displayName: 'Button-up shirt',    clothingType: 'Shirt',   fabricHint: 'Cotton',    isAccessory: false, prevalence: p(0.70, 0.75, 0.85, 0.85, 0.70), commonality: 0.88, glyph: 'shirt' },
  { id: 'top_shirt_linen',     displayName: 'Linen shirt',        clothingType: 'Shirt',   fabricHint: 'Linen',     isAccessory: false, prevalence: p(0.80, 0.85, 0.45, 0.30, 0.10), commonality: 0.55, glyph: 'shirt' },
  { id: 'top_shirt_flannel',   displayName: 'Flannel shirt',      clothingType: 'Shirt',   fabricHint: 'Wool',      isAccessory: false, prevalence: p(0.10, 0.35, 0.70, 0.80, 0.75), commonality: 0.60, glyph: 'shirt' },
  { id: 'top_base_thermal',    displayName: 'Thermal base layer', clothingType: 'Shirt',   fabricHint: 'Synthetic', isAccessory: false, prevalence: p(0.05, 0.20, 0.40, 0.75, 0.95), commonality: 0.45, glyph: 'shirt' },
  { id: 'top_blouse_cotton',   displayName: 'Cotton blouse',      clothingType: 'Blouse',  fabricHint: 'Cotton',    isAccessory: false, gender: "Women's", prevalence: p(0.70, 0.70, 0.75, 0.70, 0.55), commonality: 0.58, glyph: 'blouse' },
  { id: 'top_blouse_silk',     displayName: 'Silk blouse',        clothingType: 'Blouse',  fabricHint: 'Silk',      isAccessory: false, gender: "Women's", prevalence: p(0.45, 0.45, 0.55, 0.50, 0.30), commonality: 0.40, glyph: 'blouse' },

  // ── Mid layers ──────────────────────────────────────────────────────────────
  { id: 'mid_hoodie_cotton',   displayName: 'Cotton hoodie',      clothingType: 'Hoodie',  fabricHint: 'Cotton',    isAccessory: false, prevalence: p(0.55, 0.65, 0.85, 0.85, 0.70), commonality: 0.92, glyph: 'hoodie' },
  { id: 'mid_hoodie_fleece',   displayName: 'Fleece hoodie',      clothingType: 'Hoodie',  fabricHint: 'Fleece',    isAccessory: false, prevalence: p(0.15, 0.35, 0.65, 0.80, 0.90), commonality: 0.70, glyph: 'hoodie' },
  { id: 'mid_sweater_wool',    displayName: 'Wool sweater',       clothingType: 'Sweater', fabricHint: 'Wool',      isAccessory: false, prevalence: p(0.05, 0.30, 0.70, 0.88, 0.95), commonality: 0.80, glyph: 'sweater' },
  { id: 'mid_sweater_knit',    displayName: 'Knit sweater',       clothingType: 'Sweater', fabricHint: 'Cotton',    isAccessory: false, prevalence: p(0.30, 0.50, 0.80, 0.80, 0.65), commonality: 0.75, glyph: 'sweater' },
  { id: 'mid_cardigan_light',  displayName: 'Light cardigan',     clothingType: 'Sweater', fabricHint: 'Linen',     isAccessory: false, prevalence: p(0.45, 0.55, 0.65, 0.50, 0.25), commonality: 0.50, glyph: 'cardigan' },

  // ── Outerwear ───────────────────────────────────────────────────────────────
  { id: 'outer_jacket_denim',  displayName: 'Denim jacket',       clothingType: 'Jacket',  fabricHint: 'Denim',     isAccessory: false, prevalence: p(0.30, 0.55, 0.80, 0.75, 0.40), commonality: 0.78, glyph: 'jacket' },
  { id: 'outer_rain_shell',    displayName: 'Rain shell',         clothingType: 'Jacket',  fabricHint: 'Synthetic', isAccessory: false, prevalence: p(0.70, 0.35, 0.80, 0.75, 0.70), commonality: 0.72, glyph: 'rainShell' },
  { id: 'outer_jacket_leather',displayName: 'Leather jacket',     clothingType: 'Jacket',  fabricHint: 'Leather',   isAccessory: false, prevalence: p(0.15, 0.35, 0.55, 0.55, 0.35), commonality: 0.45, glyph: 'jacket' },
  { id: 'outer_jacket_puffer', displayName: 'Puffer jacket',      clothingType: 'Jacket',  fabricHint: 'Polyester', isAccessory: false, prevalence: p(0.05, 0.25, 0.55, 0.85, 0.92), commonality: 0.68, glyph: 'puffer' },
  { id: 'outer_blazer',        displayName: 'Blazer',             clothingType: 'Jacket',  fabricHint: 'Wool',      isAccessory: false, prevalence: p(0.35, 0.40, 0.60, 0.60, 0.45), commonality: 0.55, glyph: 'jacket' },
  { id: 'outer_coat_wool',     displayName: 'Wool coat',          clothingType: 'Coat',    fabricHint: 'Wool',      isAccessory: false, prevalence: p(0.02, 0.15, 0.50, 0.80, 0.85), commonality: 0.60, glyph: 'coat' },
  { id: 'outer_coat_parka',    displayName: 'Insulated parka',    clothingType: 'Coat',    fabricHint: 'Synthetic', isAccessory: false, prevalence: p(0.02, 0.10, 0.35, 0.78, 0.96), commonality: 0.55, glyph: 'coat' },
  { id: 'outer_coat_trench',   displayName: 'Trench coat',        clothingType: 'Coat',    fabricHint: 'Cotton',    isAccessory: false, prevalence: p(0.10, 0.15, 0.45, 0.40, 0.20), commonality: 0.35, glyph: 'coat' },

  // ── Bottoms ─────────────────────────────────────────────────────────────────
  { id: 'bot_jeans',           displayName: 'Jeans',              clothingType: 'Jeans',   fabricHint: 'Denim',     isAccessory: false, prevalence: p(0.70, 0.85, 0.95, 0.95, 0.85), commonality: 0.98, glyph: 'jeans' },
  { id: 'bot_chinos',          displayName: 'Chinos',             clothingType: 'Pants',   fabricHint: 'Cotton',    isAccessory: false, prevalence: p(0.65, 0.80, 0.85, 0.82, 0.65), commonality: 0.85, glyph: 'trousers' },
  { id: 'bot_trousers_wool',   displayName: 'Wool trousers',      clothingType: 'Pants',   fabricHint: 'Wool',      isAccessory: false, prevalence: p(0.05, 0.25, 0.55, 0.75, 0.85), commonality: 0.50, glyph: 'trousers' },
  { id: 'bot_trousers_linen',  displayName: 'Linen trousers',     clothingType: 'Pants',   fabricHint: 'Linen',     isAccessory: false, prevalence: p(0.80, 0.75, 0.45, 0.30, 0.10), commonality: 0.48, glyph: 'trousers' },
  { id: 'bot_joggers',         displayName: 'Joggers',            clothingType: 'Pants',   fabricHint: 'Synthetic', isAccessory: false, prevalence: p(0.50, 0.60, 0.75, 0.75, 0.70), commonality: 0.72, glyph: 'trousers' },
  { id: 'bot_leggings',        displayName: 'Leggings',           clothingType: 'Pants',   fabricHint: 'Polyester', isAccessory: false, gender: "Women's", prevalence: p(0.45, 0.55, 0.75, 0.80, 0.75), commonality: 0.65, glyph: 'leggings' },
  { id: 'bot_shorts_cotton',   displayName: 'Cotton shorts',      clothingType: 'Shorts',  fabricHint: 'Cotton',    isAccessory: false, prevalence: p(0.95, 0.92, 0.80, 0.70, 0.35), commonality: 0.90, glyph: 'shorts' },
  { id: 'bot_shorts_athletic', displayName: 'Athletic shorts',    clothingType: 'Shorts',  fabricHint: 'Synthetic', isAccessory: false, prevalence: p(0.85, 0.85, 0.75, 0.70, 0.50), commonality: 0.70, glyph: 'shorts' },
  { id: 'bot_skirt',           displayName: 'Skirt',              clothingType: 'Skirt',   fabricHint: 'Cotton',    isAccessory: false, gender: "Women's", prevalence: p(0.70, 0.65, 0.70, 0.65, 0.40), commonality: 0.60, glyph: 'skirt' },

  // ── Full body ───────────────────────────────────────────────────────────────
  { id: 'full_dress_cotton',   displayName: 'Day dress',          clothingType: 'Dress',   fabricHint: 'Cotton',    isAccessory: false, gender: "Women's", prevalence: p(0.80, 0.75, 0.70, 0.60, 0.35), commonality: 0.70, glyph: 'dress' },
  { id: 'full_dress_linen',    displayName: 'Linen dress',        clothingType: 'Dress',   fabricHint: 'Linen',     isAccessory: false, gender: "Women's", prevalence: p(0.75, 0.70, 0.40, 0.25, 0.10), commonality: 0.45, glyph: 'dress' },
  { id: 'full_dress_knit',     displayName: 'Knit dress',         clothingType: 'Dress',   fabricHint: 'Wool',      isAccessory: false, gender: "Women's", prevalence: p(0.05, 0.20, 0.55, 0.65, 0.55), commonality: 0.40, glyph: 'dress' },

  // ── Footwear ────────────────────────────────────────────────────────────────
  { id: 'shoe_sneakers',       displayName: 'Sneakers',           clothingType: 'Sneakers',fabricHint: 'Synthetic', isAccessory: false, prevalence: p(0.88, 0.92, 0.95, 0.95, 0.85), commonality: 0.98, glyph: 'sneaker' },
  { id: 'shoe_sneakers_canvas',displayName: 'Canvas sneakers',    clothingType: 'Sneakers',fabricHint: 'Cotton',    isAccessory: false, prevalence: p(0.75, 0.75, 0.75, 0.65, 0.40), commonality: 0.70, glyph: 'sneaker' },
  { id: 'shoe_dress_leather',  displayName: 'Dress shoes',        clothingType: 'Shoes',   fabricHint: 'Leather',   isAccessory: false, prevalence: p(0.55, 0.60, 0.70, 0.70, 0.60), commonality: 0.65, glyph: 'dressShoe' },
  { id: 'shoe_loafers',        displayName: 'Loafers',            clothingType: 'Shoes',   fabricHint: 'Other',     isAccessory: false, prevalence: p(0.55, 0.55, 0.60, 0.55, 0.40), commonality: 0.52, glyph: 'dressShoe' },
  { id: 'shoe_boots_leather',  displayName: 'Leather boots',      clothingType: 'Boots',   fabricHint: 'Leather',   isAccessory: false, prevalence: p(0.15, 0.45, 0.75, 0.85, 0.80), commonality: 0.75, glyph: 'boot' },
  { id: 'shoe_boots_insulated',displayName: 'Insulated boots',    clothingType: 'Boots',   fabricHint: 'Synthetic', isAccessory: false, prevalence: p(0.02, 0.15, 0.40, 0.78, 0.95), commonality: 0.50, glyph: 'boot' },
  { id: 'shoe_sandals',        displayName: 'Sandals',            clothingType: 'Sandals', fabricHint: 'Synthetic', isAccessory: false, prevalence: p(0.95, 0.90, 0.70, 0.55, 0.20), commonality: 0.85, glyph: 'sandal' },

  // ── Accessories ─────────────────────────────────────────────────────────────
  // `bodyZone` is explicit rather than left to ZONE_FROM_TYPE so buildAccCombos
  // can never pair two head items, even if that table changes.
  { id: 'acc_cap',             displayName: 'Cap',                clothingType: 'Cap',     fabricHint: 'Cotton',    isAccessory: true, bodyZone: 'Head',    prevalence: p(0.85, 0.88, 0.80, 0.75, 0.60), commonality: 0.80, glyph: 'cap' },
  { id: 'acc_beanie',          displayName: 'Beanie',             clothingType: 'Hat',     fabricHint: 'Wool',      isAccessory: true, bodyZone: 'Head',    prevalence: p(0.02, 0.20, 0.55, 0.85, 0.95), commonality: 0.65, glyph: 'beanie' },
  { id: 'acc_sun_hat',         displayName: 'Sun hat',            clothingType: 'Hat',     fabricHint: 'Cotton',    isAccessory: true, bodyZone: 'Head',    prevalence: p(0.70, 0.80, 0.45, 0.35, 0.15), commonality: 0.45, glyph: 'sunHat' },
  { id: 'acc_scarf',           displayName: 'Scarf',              clothingType: 'Scarf',   fabricHint: 'Wool',      isAccessory: true, bodyZone: 'Neck',    prevalence: p(0.05, 0.25, 0.60, 0.85, 0.92), commonality: 0.62, glyph: 'scarf' },
  { id: 'acc_gloves',          displayName: 'Gloves',             clothingType: 'Gloves',  fabricHint: 'Wool',      isAccessory: true, bodyZone: 'Hand',    prevalence: p(0.02, 0.15, 0.45, 0.82, 0.95), commonality: 0.55, glyph: 'gloves' },
  { id: 'acc_belt',            displayName: 'Belt',               clothingType: 'Belt',    fabricHint: 'Leather',   isAccessory: true, bodyZone: 'Waist',   prevalence: p(0.70, 0.75, 0.80, 0.80, 0.70), commonality: 0.70, glyph: 'belt' },
  { id: 'acc_bag',             displayName: 'Everyday bag',       clothingType: 'Bag',     fabricHint: 'Other',     isAccessory: true, bodyZone: 'Carried', prevalence: p(0.75, 0.75, 0.80, 0.80, 0.75), commonality: 0.68, glyph: 'bag' },
  { id: 'acc_watch',           displayName: 'Watch',              clothingType: 'Watch',   fabricHint: 'Other',     isAccessory: true, bodyZone: 'Wrist',   prevalence: p(0.55, 0.55, 0.60, 0.60, 0.55), commonality: 0.40, glyph: 'watch' },
  { id: 'acc_socks_wool',      displayName: 'Wool socks',         clothingType: 'Socks',   fabricHint: 'Wool',      isAccessory: true, bodyZone: 'Ankle',   prevalence: p(0.05, 0.20, 0.50, 0.80, 0.95), commonality: 0.42, glyph: 'socks' },
] as const;

const BY_ID = new Map(ARCHETYPE_CATALOG.map(a => [a.id, a]));

export const archetypeById = (id: string): GarmentArchetype | undefined => BY_ID.get(id);
