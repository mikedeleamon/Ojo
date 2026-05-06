/**
 * userPreferences.ts
 * ------------------
 * Persistent user preference learning.
 * Tracks colour, fabric, and category frequency across logged outfits.
 * Structured so frequency counts can later feed an ML-based ranker.
 */

import { ClothingArticle } from '../types';
import { storage, storageGetJSON } from './storage';

const PREFS_KEY = 'ojo_user_prefs';

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
  const data = await storageGetJSON<Partial<UserPreferenceProfile>>(storage, PREFS_KEY, {});
  return { ...empty(), ...data };
};

export const savePreferences = async (profile: UserPreferenceProfile): Promise<void> => {
  await storage.setItem(PREFS_KEY, JSON.stringify(profile));
};

export const clearPreferences = async (): Promise<void> => {
  await storage.removeItem(PREFS_KEY);
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

export const articlePreferenceScore = (
  article: ClothingArticle,
  profile: UserPreferenceProfile,
): number => {
  const totalC   = Math.max(1, Object.values(profile.colors).reduce((a, b) => a + b, 0));
  const totalF   = Math.max(1, Object.values(profile.fabrics).reduce((a, b) => a + b, 0));
  const totalCat = Math.max(1, Object.values(profile.categories).reduce((a, b) => a + b, 0));

  const vocabC   = Object.keys(profile.colors).length   + 1;
  const vocabF   = Object.keys(profile.fabrics).length  + 1;
  const vocabCat = Object.keys(profile.categories).length + 1;

  const colorFreq  = article.color            ? ((profile.colors[article.color]               ?? 0) + 1) / (totalC   + vocabC)   : 0.5 / vocabC;
  const fabricFreq = article.fabricType       ? ((profile.fabrics[article.fabricType]         ?? 0) + 1) / (totalF   + vocabF)   : 0.5 / vocabF;
  const catFreq    = article.clothingCategory ? ((profile.categories[article.clothingCategory]?? 0) + 1) / (totalCat + vocabCat) : 0.5 / vocabCat;

  const raw = colorFreq * 0.5 + fabricFreq * 0.3 + catFreq * 0.2;
  return 1 / (1 + Math.exp(-10 * (raw - 0.1)));
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
