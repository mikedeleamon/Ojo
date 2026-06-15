/**
 * userPreferences.ts
 * ------------------
 * User preference learning — colour, fabric, and category frequency across the
 * outfits the user has logged.
 *
 * The profile is NOT persisted on its own. Outfit history (`outfitHistory.ts`,
 * synced to the server) is the single source of truth; the profile is a pure
 * *derived view* of it via `derivePreferenceProfile`. This removes a whole class
 * of bugs the old standalone store had — stale Style DNA after a reinstall,
 * cross-device divergence from a last-writer-wins push, and a write-only server
 * copy that was never read back.
 */

import { ClothingArticle, Closet, OutfitHistoryEntry } from '../types';

export interface UserPreferenceProfile {
  colors:       Record<string, number>;
  fabrics:      Record<string, number>;
  categories:   Record<string, number>;
  colorPairs:   Record<string, number>;  // "Navy|Rust" → frequency
  totalOutfits: number;
}

const empty = (): UserPreferenceProfile => ({
  colors: {}, fabrics: {}, categories: {}, colorPairs: {}, totalOutfits: 0,
});

/** Canonical key for a color pair (alphabetical order so A|B == B|A). */
const colorPairKey = (a: string, b: string): string =>
  a < b ? `${a}|${b}` : `${b}|${a}`;

// ─── Derivation ─────────────────────────────────────────────────────────────

/**
 * Rebuild the preference profile from outfit history, joining each entry's
 * article IDs against the current closets to recover colour/fabric/category.
 *
 * `totalOutfits` counts every history entry (one per logged outfit) regardless
 * of whether its articles still exist, so the "outfits logged" progression is
 * stable even after items are deleted. Attribute counts (colors/fabrics/…) only
 * include articles still present in a closet — a deleted garment can't
 * contribute a colour we no longer know. Because history is capped at the most
 * recent 60 entries, the profile is naturally recency-weighted.
 */
export const derivePreferenceProfile = (
  closets: Closet[],
  history: OutfitHistoryEntry[],
): UserPreferenceProfile => {
  const profile = empty();

  // articleId → article, across every closet
  const byId = new Map<string, ClothingArticle>();
  for (const closet of closets) {
    for (const article of closet.articles) byId.set(article._id, article);
  }

  for (const entry of history) {
    profile.totalOutfits += 1;

    const outfitColors: string[] = [];
    for (const id of entry.articleIds) {
      const a = byId.get(id);
      if (!a) continue;
      if (a.color)            profile.colors[a.color]                = (profile.colors[a.color]                ?? 0) + 1;
      if (a.fabricType)       profile.fabrics[a.fabricType]          = (profile.fabrics[a.fabricType]          ?? 0) + 1;
      if (a.clothingCategory) profile.categories[a.clothingCategory] = (profile.categories[a.clothingCategory] ?? 0) + 1;
      if (a.color) outfitColors.push(a.color);
    }

    // Color pairings within this outfit
    for (let i = 0; i < outfitColors.length; i++) {
      for (let j = i + 1; j < outfitColors.length; j++) {
        const key = colorPairKey(outfitColors[i], outfitColors[j]);
        profile.colorPairs[key] = (profile.colorPairs[key] ?? 0) + 1;
      }
    }
  }

  return profile;
};

// ─── Query helpers ────────────────────────────────────────────────────────────

/**
 * Scores how well an article matches the user's learned preferences.
 *
 * Each dimension (color, fabric, category) is scored as a relative preference:
 *   (count + 1) / (maxCount + 1)
 *
 * This keeps the score in [0, 1] and stays discriminative regardless of how
 * much history exists. The previous sigmoid approach saturated once the
 * smoothed frequency exceeded the 0.1 threshold, making "worn 5 times" and
 * "worn 50 times" indistinguishable.
 *
 * Cold start: with no history, maxCount = 0 for all dimensions, so every
 * article scores 1/1 = 1.0 — equal preference until data accumulates.
 * Unseen attributes score 1/(maxCount+1), the natural floor.
 */
export const articlePreferenceScore = (
  article: ClothingArticle,
  profile: UserPreferenceProfile,
): number => {
  const relScore = (countMap: Record<string, number>, key: string | undefined): number => {
    const maxCount = Object.values(countMap).reduce((m, v) => (v > m ? v : m), 0);
    const count    = key ? (countMap[key] ?? 0) : 0;
    return (count + 1) / (maxCount + 1);
  };

  const colorScore  = relScore(profile.colors,      article.color);
  const fabricScore = relScore(profile.fabrics,      article.fabricType);
  const catScore    = relScore(profile.categories,   article.clothingCategory);

  return colorScore * 0.5 + fabricScore * 0.3 + catScore * 0.2;
};

// ─── Style DNA ────────────────────────────────────────────────────────────────

/** How much the ranker has learned from the user's outfit history. */
export type PersonalizationLevel = 'none' | 'learning' | 'active';

export interface StyleDNA {
  topColors:    string[];
  topFabric:    string | null;
  topCategory:  string | null;
  level:        PersonalizationLevel;
  totalOutfits: number;
}

export const PERSONALIZATION_THRESHOLD = 30;
export const LEARNING_THRESHOLD        = 10;

/** Compute the user's style fingerprint from their preference history. */
export const computeStyleDNA = (profile: UserPreferenceProfile): StyleDNA => {
  const level: PersonalizationLevel =
    profile.totalOutfits >= PERSONALIZATION_THRESHOLD ? 'active' :
    profile.totalOutfits >= LEARNING_THRESHOLD        ? 'learning' : 'none';

  const topColors = Object.entries(profile.colors)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([c]) => c);

  const topFabric = Object.entries(profile.fabrics)
    .sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  const topCategory = Object.entries(profile.categories)
    .sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  return { topColors, topFabric, topCategory, level, totalOutfits: profile.totalOutfits };
};

/**
 * Returns a 0–0.10 bonus for an outfit based on how often its color pairings
 * have appeared in the user's history. Frequently-chosen combos get boosted
 * beyond what the generic color wheel says.
 */
export const colorPairingBonus = (
  outfitColors: string[],
  profile: UserPreferenceProfile,
): number => {
  if (!profile.colorPairs || outfitColors.length < 2 || profile.totalOutfits < 3) return 0;

  const totalPairs = Math.max(1, Object.values(profile.colorPairs).reduce((a, b) => a + b, 0));
  let bonus = 0;
  let pairs = 0;

  for (let i = 0; i < outfitColors.length; i++) {
    for (let j = i + 1; j < outfitColors.length; j++) {
      const key = outfitColors[i] < outfitColors[j]
        ? `${outfitColors[i]}|${outfitColors[j]}`
        : `${outfitColors[j]}|${outfitColors[i]}`;
      const freq = (profile.colorPairs[key] ?? 0) / totalPairs;
      bonus += freq;
      pairs++;
    }
  }

  if (pairs === 0) return 0;
  // Normalize and cap: high-frequency pairs get up to 0.10 bonus
  const avgFreq = bonus / pairs;
  return Math.min(0.10, avgFreq * 2.0);
};
