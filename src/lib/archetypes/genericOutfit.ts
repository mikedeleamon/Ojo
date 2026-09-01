/**
 * genericOutfit.ts — today's advice for a user whose closet can't give any.
 *
 * This is the whole surviving feature. A signed-in user with an empty (or
 * too-sparse) closet still gets a real, weather-specific layering answer,
 * built from what a typical wardrobe in their climate would contain, plus a
 * prompt to add their own clothes.
 *
 * Two properties matter:
 *
 *   1. **It is advice, not a wardrobe.** Nothing is stored, nothing is
 *      presented as owned, and it never enters the wear log, the preference
 *      profile, the widget or the Morning Brief. The moment the real closet can
 *      dress the user, this stops being consulted entirely — the handoff is
 *      all-or-nothing by design, so nobody ever sees an assumed garment mixed
 *      into suggestions from clothes they actually own.
 *
 *   2. **Zero engine changes.** An archetype resolves to a `ClothingArticle`
 *      (docs/zero-catalog-first-value.md §1), so `generateOutfits` and
 *      `generateLayeringRecommendation` run untouched. That is also why the
 *      advice is as good as the real thing: it is produced by the same engine.
 */

import type { ClothingArticle, CurrentWeather, Forecast, Settings } from '../../types';
import { generateOutfits } from '../outfitEngine';
import { climateBandFor, type ClimateBand } from '../climate';
import { typicalWardrobe } from './typicalWardrobe';
import { ARCHETYPE_ID_PREFIX, type GarmentArchetype } from './types';

/**
 * One archetype as the engine sees it.
 *
 * `color`, `imageUrl`, `merchant`, `purchasePrice` are deliberately absent:
 *   - missing `color` scores neutrally (pairHarmony returns 0.7 for unknown
 *     colors) rather than being penalised — see outfit/colorHarmony.ts
 *   - the rest keep a synthetic garment structurally unable to masquerade as
 *     something the user owns
 */
export const archetypeToArticle = (a: GarmentArchetype): ClothingArticle => ({
  _id:          `${ARCHETYPE_ID_PREFIX}${a.id}`,
  clothingType: a.clothingType,
  name:         a.displayName,
  fabricType:   a.fabricHint,
  isAccessory:  a.isAccessory,
  ...(a.bodyZone ? { bodyZone: a.bodyZone } : {}),
  ...(a.gender   ? { gender:   a.gender   } : {}),
});

export interface GenericOutfit {
  /** Weather headline, e.g. "A bit cool — layer up." */
  headline: string;
  /** The layering advice in prose. Empty when the day needs no layering. */
  recommendation: string;
  /** Morning/afternoon/evening steps on a variable day. */
  timeline?: { time: string; action: string; hour: number }[];
  /** Weather-driven notes (rain, UV, wind) — the same ones a real outfit gets. */
  notes: string[];
  /** Which climate shaped the answer. Surfaced in the copy. */
  band: ClimateBand;
}

export interface GenericOutfitInput {
  weather: CurrentWeather;
  settings: Settings;
  forecasts?: Forecast[];
  /** The user's coordinates. Falls back to a temperate reading when unknown. */
  coords?: { lat: number; lon: number } | null;
}

/**
 * Build today's generic advice, or null if even the typical wardrobe can't
 * produce something wearable (which the invariant test says cannot happen for
 * any band × bucket, but a caller should not have to trust that at runtime).
 */
export function buildGenericOutfit(input: GenericOutfitInput): GenericOutfit | null {
  const { weather, settings, forecasts = [], coords } = input;

  // Temperate is the fallback, not an assumption about the user: it is the band
  // whose wardrobe spans the widest range of weather, so it is the least-wrong
  // answer when we have no coordinates.
  const band = coords ? climateBandFor(coords.lat, coords.lon) : 'temperate';

  const articles = typicalWardrobe(band, { gender: settings.gender })
    .map(archetypeToArticle);

  // topK 1 — there is no carousel here, and no preference profile to rank with.
  const { results, status } = generateOutfits(
    articles, weather, settings, new Set(), 1, undefined, forecasts,
  );
  if (status !== 'ok') return null;

  const top = results[0];
  if (!top || top.slots.length === 0) return null;

  return {
    headline:       top.headline,
    recommendation: top.layering?.recommendation ?? '',
    timeline:       top.layering?.timeline,
    notes:          top.notes,
    band,
  };
}

/**
 * The honest line. Kept close to the spec's wording because it is doing real
 * work: it says plainly that this is a generalisation, and what to do about it,
 * without ever withholding the advice itself.
 */
export const GENERIC_SUGGESTION_NOTE =
  'Based solely on the weather in your area — add your clothes for outfit suggestions built from what you actually own.';
