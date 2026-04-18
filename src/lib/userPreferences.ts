/**
 * userPreferences.ts
 * ------------------
 * Persistent user preference learning stored in localStorage.
 * Tracks colour, fabric, and category frequency across logged outfits.
 * Structured so frequency counts can later feed an ML-based ranker
 * (e.g. exported as a feature vector for a collaborative-filter model).
 */

import { ClothingArticle } from '../types';

const PREFS_KEY = 'ojo_user_prefs';

export interface UserPreferenceProfile {
  /** Raw wear-frequency counts per colour name */
  colors:       Record<string, number>;
  /** Raw wear-frequency counts per fabric type */
  fabrics:      Record<string, number>;
  /** Raw wear-frequency counts per clothing category */
  categories:   Record<string, number>;
  /** Total outfits logged — used to normalise frequencies */
  totalOutfits: number;
}

const empty = (): UserPreferenceProfile => ({
  colors: {}, fabrics: {}, categories: {}, totalOutfits: 0,
});

// ─── Persistence ──────────────────────────────────────────────────────────────

export const loadPreferences = (): UserPreferenceProfile => {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    return raw ? { ...empty(), ...JSON.parse(raw) } : empty();
  } catch {
    return empty();
  }
};

export const savePreferences = (profile: UserPreferenceProfile): void => {
  try { localStorage.setItem(PREFS_KEY, JSON.stringify(profile)); } catch {}
};

export const clearPreferences = (): void => {
  try { localStorage.removeItem(PREFS_KEY); } catch {}
};

// ─── Mutation ─────────────────────────────────────────────────────────────────

/**
 * Call after the user confirms they wore an outfit.
 * Increments frequency counts for each article's colour, fabric, and category.
 */
export const updatePreferences = (articles: ClothingArticle[]): void => {
  const profile = loadPreferences();
  profile.totalOutfits += 1;

  for (const a of articles) {
    if (a.color) {
      profile.colors[a.color] = (profile.colors[a.color] ?? 0) + 1;
    }
    if (a.fabricType) {
      profile.fabrics[a.fabricType] = (profile.fabrics[a.fabricType] ?? 0) + 1;
    }
    if (a.clothingCategory) {
      profile.categories[a.clothingCategory] = (profile.categories[a.clothingCategory] ?? 0) + 1;
    }
  }

  savePreferences(profile);
};

// ─── Query helpers ────────────────────────────────────────────────────────────

/**
 * Returns a 0–1 preference score for a single article.
 * Uses Laplace-smoothed frequency so unseen items aren't zero-scored.
 */
export const articlePreferenceScore = (
  article: ClothingArticle,
  profile: UserPreferenceProfile,
): number => {
  const totalC = Math.max(1, Object.values(profile.colors).reduce((a, b) => a + b, 0));
  const totalF = Math.max(1, Object.values(profile.fabrics).reduce((a, b) => a + b, 0));
  const totalCat = Math.max(1, Object.values(profile.categories).reduce((a, b) => a + b, 0));

  // Laplace smoothing: (count + 1) / (total + |vocab|)
  const vocabC   = Object.keys(profile.colors).length   + 1;
  const vocabF   = Object.keys(profile.fabrics).length  + 1;
  const vocabCat = Object.keys(profile.categories).length + 1;

  const colorFreq = article.color
    ? ((profile.colors[article.color] ?? 0) + 1) / (totalC + vocabC)
    : 0.5 / vocabC;

  const fabricFreq = article.fabricType
    ? ((profile.fabrics[article.fabricType] ?? 0) + 1) / (totalF + vocabF)
    : 0.5 / vocabF;

  const catFreq = article.clothingCategory
    ? ((profile.categories[article.clothingCategory] ?? 0) + 1) / (totalCat + vocabCat)
    : 0.5 / vocabCat;

  // Weighted average: colour carries most signal
  const raw = colorFreq * 0.5 + fabricFreq * 0.3 + catFreq * 0.2;

  // Normalise to 0–1 via logistic curve so rare items still score > 0
  return 1 / (1 + Math.exp(-10 * (raw - 0.1)));
};
