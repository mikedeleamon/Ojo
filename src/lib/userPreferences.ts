/**
 * userPreferences.ts
 * ------------------
 * Persistent user preference learning.
 * Tracks colour, fabric, and category frequency across logged outfits.
 * Structured so frequency counts can later feed an ML-based ranker.
 */

import { ClothingArticle } from '../types';
import { storage, storageGetJSON } from './storage';
import { getUserId } from './auth';

const prefsKey = () => `ojo_user_prefs_${getUserId() ?? 'anon'}`;

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

// ─── Persistence ──────────────────────────────────────────────────────────────

export const loadPreferences = async (): Promise<UserPreferenceProfile> => {
  const data = await storageGetJSON<Partial<UserPreferenceProfile>>(storage, prefsKey(), {});
  return { ...empty(), ...data };
};

export const savePreferences = async (profile: UserPreferenceProfile): Promise<void> => {
  await storage.setItem(prefsKey(), JSON.stringify(profile));
  pushPreferencesToServer(profile);
};

export const clearPreferences = async (): Promise<void> => {
  await storage.removeItem(prefsKey());
};

// ─── Server sync ──────────────────────────────────────────────────────────────

async function pushPreferencesToServer(profile: UserPreferenceProfile): Promise<void> {
  try {
    const { default: client } = await import('../api/client');
    const { authHeaders } = await import('./auth');
    const config = authHeaders();
    if (!config.headers) return;
    await client.put('/api/preferences', profile, config);
  } catch {
    // fire-and-forget — local copy is the source of truth until server responds
  }
}

/**
 * Pull the server's preference profile and hydrate local storage.
 * Call once at app startup after the user is confirmed logged in.
 * Server wins on conflict — it holds the aggregate across all devices.
 */
export const syncPreferencesFromServer = async (): Promise<void> => {
  try {
    const { default: client } = await import('../api/client');
    const { authHeaders } = await import('./auth');
    const config = authHeaders();
    if (!config.headers) return;
    const { data } = await client.get<UserPreferenceProfile>('/api/preferences', config);
    if (data && typeof data.totalOutfits === 'number') {
      await storage.setItem(prefsKey(), JSON.stringify({ ...empty(), ...data }));
    }
  } catch {
    // Network failure — keep local data
  }
};

// ─── Mutation ─────────────────────────────────────────────────────────────────

/** Canonical key for a color pair (alphabetical order so A|B == B|A). */
const colorPairKey = (a: string, b: string): string =>
  a < b ? `${a}|${b}` : `${b}|${a}`;

export const updatePreferences = async (articles: ClothingArticle[]): Promise<void> => {
  const profile = await loadPreferences();
  profile.totalOutfits += 1;

  // Ensure colorPairs exists (migration for existing profiles)
  if (!profile.colorPairs) profile.colorPairs = {};

  for (const a of articles) {
    if (a.color)            profile.colors[a.color]               = (profile.colors[a.color]               ?? 0) + 1;
    if (a.fabricType)       profile.fabrics[a.fabricType]         = (profile.fabrics[a.fabricType]         ?? 0) + 1;
    if (a.clothingCategory) profile.categories[a.clothingCategory]= (profile.categories[a.clothingCategory]?? 0) + 1;
  }

  // Track color pairings from this outfit
  const outfitColors = articles.map(a => a.color).filter(Boolean) as string[];
  for (let i = 0; i < outfitColors.length; i++) {
    for (let j = i + 1; j < outfitColors.length; j++) {
      const key = colorPairKey(outfitColors[i], outfitColors[j]);
      profile.colorPairs[key] = (profile.colorPairs[key] ?? 0) + 1;
    }
  }

  await savePreferences(profile);
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
