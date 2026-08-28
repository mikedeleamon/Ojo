/**
 * typicalWardrobe.ts — what a wardrobe in this climate usually contains.
 *
 * Pure selection over the catalog. Nothing here is stored against a user; the
 * result is rebuilt on demand and thrown away.
 *
 * The release-blocking rule (docs/zero-catalog-first-value.md §4.1): prevalence
 * alone does NOT guarantee a wearable answer. `generateOutfits` has two empty
 * exits, and the reachable one is `insufficient` — it fires *after*
 * `isWeatherAppropriate` and gender filtering. A tropical selection of only
 * tops, shorts and sandals produces nothing at all on a freezing morning, which
 * is exactly the empty state this feature exists to remove.
 *
 * So prevalence is only the starting selection. The invariant below is what
 * actually ships:
 *
 *   For every ClimateBand and every WeatherBucket, the selected set must
 *   survive isWeatherAppropriate with at least one `top`, one `bottom`, and one
 *   `footwear`.
 *
 * (The spec allows "one bottom OR one fullBody". This enforces `bottom`
 * outright, which is strictly stronger and — unlike fullBody — cannot be
 * removed by the engine's gender filter, since every fullBody archetype in the
 * catalog is gendered.)
 */

import { roleOf } from '../outfit/roles';
import { isWeatherAppropriate } from '../outfit/weatherBuckets';
import type { OutfitRole, WeatherBucket } from '../outfit/types';
import type { ClimateBand } from '../climate';
import { ARCHETYPE_CATALOG } from './catalog';
import { archetypeToArticle } from './genericOutfit';
import type { GarmentArchetype } from './types';

/** An archetype at or above this prevalence is selected outright. */
export const PREVALENCE_THRESHOLD = 0.7;

export const WEATHER_BUCKETS: readonly WeatherBucket[] = [
  'hot', 'warm', 'cool', 'cold', 'freezing',
] as const;

/** Roles the invariant guarantees in every bucket. */
const REQUIRED_ROLES: readonly OutfitRole[] = ['top', 'bottom', 'footwear'] as const;

/**
 * Whether a garment belongs in a wardrobe with this preference.
 * Mirrors the engine's own rule (unisex and "All" always pass) so the selection
 * can never lean on something generateOutfits would immediately filter out.
 */
export const matchesGender = (a: GarmentArchetype, userGender?: string): boolean => {
  if (!userGender || userGender === 'All') return true;
  if (!a.gender) return true;
  return a.gender === userGender;
};

const roleCache = new WeakMap<GarmentArchetype, OutfitRole>();
const roleOfArchetype = (a: GarmentArchetype): OutfitRole => {
  const hit = roleCache.get(a);
  if (hit) return hit;
  const role = roleOf(archetypeToArticle(a));
  roleCache.set(a, role);
  return role;
};

const survives = (a: GarmentArchetype, bucket: WeatherBucket): boolean =>
  isWeatherAppropriate(archetypeToArticle(a), bucket);

export interface WardrobeOptions {
  /** The user's wardrobe preference — "Men's" / "Women's" / "All". */
  gender?: string;
  catalog?: readonly GarmentArchetype[];
  threshold?: number;
}

/**
 * The garments a typical wardrobe in this band holds, ordered by how ordinary
 * they are.
 */
export function typicalWardrobe(
  band: ClimateBand,
  opts: WardrobeOptions = {},
): GarmentArchetype[] {
  const catalog   = opts.catalog ?? ARCHETYPE_CATALOG;
  const threshold = opts.threshold ?? PREVALENCE_THRESHOLD;

  const eligible = catalog.filter(a => matchesGender(a, opts.gender));
  const chosen = new Set<GarmentArchetype>(
    eligible.filter(a => a.prevalence[band] >= threshold),
  );

  // ── Back-fill to satisfy the invariant ────────────────────────────────────
  // For each bucket, any required role with nothing surviving the weather
  // filter pulls in the highest-prevalence candidate that does survive.
  for (const bucket of WEATHER_BUCKETS) {
    for (const role of REQUIRED_ROLES) {
      const covered = [...chosen].some(
        a => roleOfArchetype(a) === role && survives(a, bucket),
      );
      if (covered) continue;

      const candidate = eligible
        .filter(a => roleOfArchetype(a) === role && survives(a, bucket))
        .sort((x, y) =>
          (y.prevalence[band] - x.prevalence[band]) ||
          (y.commonality - x.commonality) ||
          x.id.localeCompare(y.id),
        )[0];

      // No candidate at all means the catalog itself cannot dress this bucket —
      // a catalog bug, caught by __tests__/typicalWardrobe.test.ts, not a
      // runtime concern.
      if (candidate) chosen.add(candidate);
    }
  }

  return [...chosen].sort(
    (x, y) => (y.commonality - x.commonality) || x.id.localeCompare(y.id),
  );
}

/**
 * Exported for the release-blocking test: does this set cover every required
 * role in every bucket? Returns the failures, empty when sound.
 */
export function invariantFailures(
  archetypes: readonly GarmentArchetype[],
): { bucket: WeatherBucket; role: OutfitRole }[] {
  const failures: { bucket: WeatherBucket; role: OutfitRole }[] = [];
  for (const bucket of WEATHER_BUCKETS) {
    for (const role of REQUIRED_ROLES) {
      const ok = archetypes.some(
        a => roleOfArchetype(a) === role && survives(a, bucket),
      );
      if (!ok) failures.push({ bucket, role });
    }
  }
  return failures;
}
