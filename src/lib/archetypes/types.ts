/**
 * Archetype types.
 *
 * An *archetype* is "the kind of garment most wardrobes in this climate
 * contain" — not a specific item, and not something the user owns. Archetypes
 * exist for exactly one purpose: to answer "what should I wear today?" for a
 * signed-in user whose closet cannot yet answer it.
 *
 * Nothing here is persisted. There is no per-user archetype closet, no
 * ownership tier and no promotion — a real closet that can dress the user takes
 * over completely (see genericOutfit.ts).
 *
 * The load-bearing decision (docs/zero-catalog-first-value.md §1): an archetype
 * resolves to a synthetic `ClothingArticle`, not to a new garment type. That is
 * why this carries `clothingType` + `fabricHint` and no warmth number —
 * `garmentWarmth()` in outfitEngine already derives warmth from exactly those
 * two fields, and duplicating it would create a second source of truth.
 */

import type { BodyZone } from '../../types';
import type { ClimateBand } from '../climate';
import type { GlyphKey } from './glyphs';

export type { ClimateBand, GlyphKey };

export interface GarmentArchetype {
  /** Stable id, e.g. 'mid_sweater_wool'. Namespaced into `arch:<id>` as an article _id. */
  id: string;
  /** What the user would call it, e.g. "Wool sweater". */
  displayName: string;
  /**
   * MUST be a key in both ROLE_MAP (src/lib/outfit/roles.ts) and — for
   * non-accessories — GARMENT_WARMTH_BASE (src/lib/outfitEngine.ts).
   * A type missing from ROLE_MAP does not throw; roleOf() silently returns
   * 'top'. Asserted in __tests__/catalog.test.ts.
   */
  clothingType: string;
  /** MUST be a key in FABRIC_WARMTH_MOD. Also drives rain resilience. */
  fabricHint: string;
  isAccessory: boolean;
  /** Accessories only — feeds zoneOf() so two head items never pair. */
  bodyZone?: BodyZone;
  /**
   * Gendered garments only ("Men's" / "Women's"); omitted means unisex.
   * Copied onto the synthetic article so the engine's *existing* gender filter
   * handles it — a "Men's" wardrobe is never described a skirt, and no new
   * mechanism is introduced to achieve that.
   */
  gender?: string;
  /** 0–1 per band: roughly "what share of wardrobes here contain one". */
  prevalence: Record<ClimateBand, number>;
  /** 0–1 — how ordinary an item this is. Breaks ties in selection. */
  commonality: number;
  glyph: GlyphKey;
}

/**
 * Prefix marking a synthetic article. Never collides with a Mongo ObjectId.
 *
 * Kept even though archetypes are now transient: it is the one cheap guarantee
 * that if a synthetic garment ever leaks into the wear log, the widget or the
 * preference profile, it is identifiable rather than indistinguishable from
 * something the user owns.
 */
export const ARCHETYPE_ID_PREFIX = 'arch:';

/** True when an article id refers to an archetype rather than a real garment. */
export const isArchetypeId = (id: string): boolean =>
  id.startsWith(ARCHETYPE_ID_PREFIX);
