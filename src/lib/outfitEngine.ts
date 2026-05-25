/**
 * outfitEngine.ts
 * ---------------
 * Scoring-based outfit recommendation engine.
 *
 * Architecture:
 *  1. Hard weather filter  — eliminates climatically impossible items
 *  2. Role bucketing       — groups articles into top/bottom/etc., capped for perf
 *  3. Combination generator— enumerates ALL valid cross-role combos
 *  4. Multi-factor scorer  — fabric×weather, color harmony, style, simplicity, preference
 *  5. Dedup + rank         — returns top-K unique outfits sorted by score
 *
 * Designed so the scoring pipeline can later be swapped for an ML ranker
 * by replacing scoreOutfit() with a model inference call.
 */

import { ClothingArticle, CurrentWeather, Forecast, Settings, OutfitOccasion } from '../types';
import {
  articlePreferenceScore, colorPairingBonus, UserPreferenceProfile,
  PERSONALIZATION_THRESHOLD, LEARNING_THRESHOLD,
} from './userPreferences';
import { buildLayeringContext, generateLayeringRecommendation } from './layeringEngine';
import type {
  OutfitRole,
  WeatherBucket,
  OutfitSlot,
  OutfitStatus,
  ScoreBreakdown,
  OutfitResult,
  PrecipIntensity,
  RecentlyWorn,
} from './outfit/types';
import {
  getWeatherBucket,
  isWeatherAppropriate,
  classifyPrecipitation,
  precipMultiplier,
  UV_HIGH_LABELS,
  AQI_HIGH_LABELS,
  POLLEN_HIGH_LABELS,
} from './outfit/weatherBuckets';
import { roleOf, articleZoneLabel, buildAccCombos } from './outfit/roles';
import { COLOR_NEUTRALS, NEUTRAL_BASE_COLORS, pairHarmony } from './outfit/colorHarmony';
import { currentSeason, SEASONAL_COLORS, seasonalBonus, type Season } from './outfit/seasons';

// Re-export public surface for backwards compatibility with existing callers.
export type {
  OutfitRole,
  WeatherBucket,
  OutfitSlot,
  OutfitStatus,
  ScoreBreakdown,
  OutfitResult,
  PrecipIntensity,
  RecentlyWorn,
  Season,
};
export {
  getWeatherBucket,
  articleZoneLabel,
  COLOR_NEUTRALS,
  pairHarmony,
  currentSeason,
  SEASONAL_COLORS,
};

// ─── 3a. Fabric × weather scoring ────────────────────────────────────────────
// 0–1 score for how appropriate a fabric is in each weather bucket.
// Built as a lookup table so new fabrics can be added without changing logic.

// Fabrics that typically require dry-cleaning (used in care notes).
const DRY_CLEAN_FABRICS = new Set(['Silk', 'Wool']);

const FABRIC_WEATHER: Record<string, Record<WeatherBucket, number>> = {
  Cotton:    { hot: 0.90, warm: 0.80, cool: 0.60, cold: 0.30, freezing: 0.10 },
  Linen:     { hot: 1.00, warm: 0.90, cool: 0.50, cold: 0.15, freezing: 0.05 },
  Silk:      { hot: 0.80, warm: 0.70, cool: 0.50, cold: 0.20, freezing: 0.10 },
  Polyester: { hot: 0.50, warm: 0.60, cool: 0.70, cold: 0.65, freezing: 0.55 },
  Denim:     { hot: 0.40, warm: 0.60, cool: 0.80, cold: 0.65, freezing: 0.50 },
  Wool:      { hot: 0.10, warm: 0.30, cool: 0.80, cold: 1.00, freezing: 1.00 },
  Fleece:    { hot: 0.05, warm: 0.20, cool: 0.85, cold: 1.00, freezing: 1.00 },
  Leather:   { hot: 0.20, warm: 0.45, cool: 0.80, cold: 0.90, freezing: 0.80 },
  Synthetic: { hot: 0.45, warm: 0.55, cool: 0.70, cold: 0.70, freezing: 0.65 },
  Other:     { hot: 0.50, warm: 0.50, cool: 0.50, cold: 0.50, freezing: 0.50 },
};

// ─── 3a-bis. Garment thermal weight ───────────────────────────────────────────
// Base warmth from cut/coverage/construction + fabric modifier for material
// insulating properties. A fleece hoodie is significantly warmer than a cotton
// hoodie — the fabric modifier captures this.
// 0 = no insulation (tank), 1 = maximum insulation (heavy coat).

const GARMENT_WARMTH_BASE: Record<string, number> = {
  Tank:       0.00,
  'T-Shirt':  0.05,
  Blouse:     0.05,
  Shirt:      0.15,  // long-sleeve button-up
  Hoodie:     0.45,
  Sweater:    0.60,
  Jacket:     0.65,
  Coat:       0.88,
  // Bottoms
  Shorts:     0.05,
  Skirt:      0.10,
  Dress:      0.15,
  Pants:      0.35,
  Jeans:      0.45,
  // Footwear
  Sandals:    0.00,
  Sneakers:   0.30,
  Shoes:      0.40,
  Boots:      0.70,
};

// Fabric contribution to garment warmth — added to base.
// Positive = insulates more; negative = breathes more / less warm.
const FABRIC_WARMTH_MOD: Record<string, number> = {
  Fleece:     0.15,
  Wool:       0.12,
  Leather:    0.08,
  Polyester:  0.03,
  Synthetic:  0.03,
  Denim:      0.02,
  Cotton:     0.00,
  Silk:      -0.03,
  Linen:     -0.05,
  Other:      0.00,
};

/** Effective garment warmth = base (from clothingType) + modifier (from fabricType), clamped [0, 1]. */
export const garmentWarmth = (article: ClothingArticle): number => {
  const base = GARMENT_WARMTH_BASE[article.clothingType] ?? 0.30;
  const mod  = FABRIC_WARMTH_MOD[article.fabricType ?? 'Other'] ?? 0.00;
  return Math.max(0, Math.min(1, base + mod));
};

/**
 * Ideal aggregate garment warmth for a given feels-like temperature.
 * True linear interpolation so every degree produces a unique target —
 * no boundary artifacts between e.g. 59°F and 60°F.
 *
 * Range: 1.00 at ≤20°F (maximum insulation) → 0.05 at ≥90°F (near-nothing).
 * Clamped at both ends so extreme inputs don't produce nonsensical values.
 */
const idealWarmthForFeelsLike = (feelsLikeF: number): number => {
  const clamped = Math.max(20, Math.min(90, feelsLikeF));
  // Linear from 1.00 (at 20°F) to 0.05 (at 90°F)
  return 1.00 - ((clamped - 20) / 70) * 0.95;
};

const fabricScore = (
  a: ClothingArticle,
  bucket: WeatherBucket,
  feelsLikeF: number,
  precipIntensity: PrecipIntensity,
  humidity: number,
  humidityThreshold: number,
  windMph: number,
  isSnowing: boolean,
): number => {
  const base = a.fabricType
    ? (FABRIC_WEATHER[a.fabricType]?.[bucket] ?? 0.50)
    : 0.50;

  let s = base;

  // Rain modifier: scaled by precipitation intensity and per-fabric resilience.
  // Each fabric has a rain resilience score (0–1): 0 = absorbs instantly, 1 = fully waterproof.
  // The modifier rewards resilient fabrics and penalizes absorbent ones, proportional to intensity.
  const RAIN_RESILIENCE: Record<string, number> = {
    Synthetic: 0.85,  // shell fabrics, nylon — designed for water
    Polyester: 0.70,  // water-resistant, dries fast
    Leather:   0.55,  // water-resistant but can stain/damage over time
    Denim:     0.40,  // absorbs but doesn't disintegrate
    Fleece:    0.35,  // absorbs, gets heavy
    Cotton:    0.25,  // absorbs readily
    Wool:      0.30,  // absorbs slowly but retains warmth when wet
    Silk:      0.10,  // ruined by water
    Linen:     0.15,  // absorbs instantly, wrinkles
    Other:     0.40,
  };

  const pMul = precipMultiplier(precipIntensity);
  if (pMul > 0) {
    const resilience = RAIN_RESILIENCE[a.fabricType ?? 'Other'] ?? 0.40;
    // Resilient fabrics (>0.5) get a bonus; absorbent fabrics (<0.5) get a penalty
    // Scaled by intensity: heavy rain = full effect, light drizzle = 40%
    const rainMod = (resilience - 0.50) * 0.24 * pMul;  // range: -0.10 to +0.10 at full intensity
    s += rainMod;
  }

  // Humidity × temperature interaction (heat index).
  // High humidity at high temps is far more oppressive than at low temps.
  // We compute a simplified heat index and scale fabric modifiers accordingly.
  // NWS simplified formula: HI = 0.5 * (T + 61.0 + (T-68)*1.2 + RH*0.094)
  // Only meaningful above ~80°F; below that, humidity affects comfort less.
  const heatIndex = feelsLikeF >= 75
    ? 0.5 * (feelsLikeF + 61.0 + (feelsLikeF - 68) * 1.2 + humidity * 0.094)
    : feelsLikeF;
  const heatStress = heatIndex >= 95 ? 'extreme' : heatIndex >= 85 ? 'high' : 'normal';

  if (heatStress !== 'normal') {
    // In heat-stress conditions, moisture-wicking is critical
    const intensity = heatStress === 'extreme' ? 1.0 : 0.6;
    if (a.fabricType === 'Synthetic' || a.fabricType === 'Polyester') s += 0.12 * intensity;
    if (a.fabricType === 'Linen')                                     s += 0.10 * intensity;
    if (a.fabricType === 'Cotton')                                    s += 0.04 * intensity;  // breathable but absorbs
    if (a.fabricType === 'Wool'  || a.fabricType === 'Fleece')        s -= 0.12 * intensity;
    if (a.fabricType === 'Leather')                                   s -= 0.10 * intensity;
  } else if (humidity > humidityThreshold) {
    // Standard humidity modifier for non-heat-stress conditions
    if (a.fabricType === 'Linen' || a.fabricType === 'Cotton') s += 0.08;
    if (a.fabricType === 'Wool'  || a.fabricType === 'Polyester') s -= 0.05;
  }

  // Wind modifier: dense/windproof fabrics score better in cold + breezy conditions
  if (windMph >= 15 && (bucket === 'cool' || bucket === 'cold' || bucket === 'freezing')) {
    const bump = windMph >= 25 ? 0.10 : 0.06;
    if (['Leather', 'Denim', 'Synthetic', 'Wool', 'Fleece'].includes(a.fabricType ?? '')) s += bump;
    if (['Linen', 'Silk', 'Cotton'].includes(a.fabricType ?? ''))                         s -= bump * 0.7;
  }

  // Snow modifier: Boots surface naturally to the top of the footwear bucket
  if (isSnowing && a.clothingType === 'Boots') s += 0.15;

  // ── Thermal alignment (uses feels-like, not raw temp) ─────────────────────
  // Blends fabric-weather (70%) with garment thermal alignment (30%) so that
  // within a single bucket, garments closer to the ideal warmth for the actual
  // feels-like temp are preferred. Garment warmth now accounts for both the
  // clothing type AND fabric material (e.g. fleece hoodie > cotton hoodie).
  const garmentW   = garmentWarmth(a);
  const ideal      = idealWarmthForFeelsLike(feelsLikeF);
  const thermalAlign = 1 - Math.min(1, Math.abs(garmentW - ideal));
  s = s * 0.70 + thermalAlign * 0.30;

  return Math.max(0, Math.min(1, s));
};

const outfitFabricScore = (
  slots: OutfitSlot[],
  bucket: WeatherBucket,
  feelsLikeF: number,
  precipIntensity: PrecipIntensity,
  humidity: number,
  humidityThreshold: number,
  windMph: number,
  isSnowing: boolean,
): number => {
  if (slots.length === 0) return 0;
  const sum = slots.reduce(
    (acc, s) => acc + fabricScore(s.article, bucket, feelsLikeF, precipIntensity, humidity, humidityThreshold, windMph, isSnowing),
    0,
  );
  return sum / slots.length;
};

// ─── 3b. Color harmony scoring ────────────────────────────────────────────────
// Pure helpers live in ./outfit/colorHarmony and ./outfit/seasons.

const outfitColorScore = (slots: OutfitSlot[], profile?: UserPreferenceProfile): number => {
  const outfitColors = slots.map(s => s.article.color).filter(Boolean) as string[];
  if (outfitColors.length < 2) return 0.70;  // single color → neutral score

  let total = 0, pairs = 0, minPair = 1.0;
  for (let i = 0; i < outfitColors.length; i++) {
    for (let j = i + 1; j < outfitColors.length; j++) {
      const h = pairHarmony(outfitColors[i], outfitColors[j]);
      total += h;
      pairs++;
      if (h < minPair) minPair = h;
    }
  }
  const harmonyAvg = pairs > 0 ? total / pairs : 0.70;

  // Blend average (70%) with worst pair (30%) so a single clash isn't hidden
  // in a 4–5 item outfit. This makes swap suggestions more actionable.
  const blended = harmonyAvg * 0.70 + minPair * 0.30;

  // Add seasonal bonus + learned color pairing bonus — additive, capped at 1.0
  const seasonal = seasonalBonus(outfitColors);
  const pairing  = profile ? colorPairingBonus(outfitColors, profile) : 0;
  return Math.min(1.0, blended + seasonal + pairing);
};

// Returns the outfit slot whose color clashes most with the rest, or null if
// no meaningful clash exists. Used to generate targeted swap suggestions.
const findClashingArticle = (slots: OutfitSlot[]): OutfitSlot | null => {
  const coloredSlots = slots.filter(
    s => s.article.color && !COLOR_NEUTRALS.has(s.article.color),
  );
  if (coloredSlots.length < 2) return null;

  let minAvg = Infinity, worst: OutfitSlot | null = null;
  for (const slot of coloredSlots) {
    const coloredOthers = slots.filter(s => s !== slot && s.article.color);
    if (coloredOthers.length === 0) continue;
    const avg = coloredOthers.reduce(
      (sum, other) => sum + pairHarmony(slot.article.color!, other.article.color!),
      0,
    ) / coloredOthers.length;
    if (avg < minAvg) { minAvg = avg; worst = slot; }
  }
  return minAvg < 0.65 ? worst : null;
};

// ─── 3c. Style alignment scoring ─────────────────────────────────────────────
// Each clothing style has affinities for certain clothing types, categories,
// and fabrics. Scores are additive and capped at 1.

const STYLE_AFFINITIES: Record<string, { types: string[]; categories: string[]; fabrics: string[] }> = {
  Casual:           { types: ['T-Shirt','Jeans','Sneakers','Hoodie','Cap','Shorts'],         categories: ['Casual','Lounge'],               fabrics: ['Cotton','Denim'] },
  'Business Casual':{ types: ['Shirt','Blouse','Pants','Shoes','Belt','Watch'],               categories: ['Business Casual'],               fabrics: ['Cotton','Silk','Polyester','Wool'] },
  Formal:           { types: ['Shirt','Blouse','Pants','Dress','Shoes','Belt','Watch','Bag'], categories: ['Formal'],                        fabrics: ['Silk','Wool','Cotton','Leather'] },
  Athletic:         { types: ['T-Shirt','Shorts','Sneakers','Socks'],                         categories: ['Athletic'],                      fabrics: ['Synthetic','Polyester','Cotton'] },
  Streetwear:       { types: ['Hoodie','Sneakers','Jeans','Cap','Jacket'],                    categories: ['Casual','Streetwear'],           fabrics: ['Cotton','Denim','Synthetic'] },
  Minimalist:       { types: ['T-Shirt','Shirt','Pants','Sneakers','Shoes'],                  categories: ['Casual','Business Casual'],      fabrics: ['Cotton','Linen','Silk'] },
  Outdoor:          { types: ['Jacket','Coat','Boots','Pants'],                               categories: ['Outdoor'],                       fabrics: ['Synthetic','Wool','Leather','Fleece'] },
  Urban:            { types: ['Jacket','Jeans','Sneakers','Hoodie','Cap'],                    categories: ['Casual'],                        fabrics: ['Denim','Cotton','Synthetic'] },
  Cozy:             { types: ['Hoodie','Sweater','Pants','Sneakers'],                         categories: ['Lounge','Casual'],               fabrics: ['Fleece','Wool','Cotton'] },
  Preppy:           { types: ['Shirt','Blouse','Pants','Shoes','Belt'],                       categories: ['Business Casual','Casual'],      fabrics: ['Cotton','Wool','Denim'] },
};

const articleStyleScore = (a: ClothingArticle, style: string): number => {
  const aff = STYLE_AFFINITIES[style];
  if (!aff) return 0.50;

  let s = 0.25; // baseline — every item contributes something
  if (aff.types.includes(a.clothingType))                                s += 0.45;
  if (a.clothingCategory && aff.categories.includes(a.clothingCategory)) s += 0.20;
  if (a.fabricType       && aff.fabrics.includes(a.fabricType))          s += 0.10;
  return Math.min(1, s);
};

const outfitStyleScore = (slots: OutfitSlot[], style: string): number => {
  if (slots.length === 0) return 0;
  return slots.reduce((sum, s) => sum + articleStyleScore(s.article, style), 0) / slots.length;
};

// ─── 3c-bis. Occasion formality scoring ──────────────────────────────────────
// Optional context signal that adjusts which items feel appropriate.
// 'work' penalizes very casual items; 'weekend' rewards relaxed pieces;
// 'date' rewards polished items; 'athletic' strongly rewards sport gear.

const OCCASION_FORMALITY: Record<string, number> = {
  // 0 = very casual, 1 = very formal
  'T-Shirt': 0.15, Hoodie: 0.20, Shorts: 0.15, Cap: 0.10,
  Jeans: 0.30, Sneakers: 0.25, Sandals: 0.10,
  Shirt: 0.60, Blouse: 0.65, Pants: 0.55, Shoes: 0.60,
  Belt: 0.55, Watch: 0.50, Dress: 0.70, Coat: 0.60,
  Jacket: 0.50, Sweater: 0.45, Boots: 0.50, Skirt: 0.50,
};

/** Target formality range for each occasion (min, ideal, max). */
const OCCASION_TARGETS: Record<OutfitOccasion, { min: number; ideal: number; max: number }> = {
  everyday: { min: 0.00, ideal: 0.35, max: 1.00 },  // no penalty
  work:     { min: 0.40, ideal: 0.60, max: 0.85 },
  weekend:  { min: 0.00, ideal: 0.25, max: 0.55 },
  date:     { min: 0.35, ideal: 0.55, max: 0.80 },
  outdoor:  { min: 0.00, ideal: 0.30, max: 0.60 },
  athletic: { min: 0.00, ideal: 0.15, max: 0.35 },
};

/**
 * Returns 0–1 score for how well an outfit fits an occasion.
 * Measures average formality of pieces against the occasion's target range.
 */
const occasionScore = (slots: OutfitSlot[], occasion: OutfitOccasion): number => {
  if (occasion === 'everyday') return 0.70; // neutral — no filtering
  const target = OCCASION_TARGETS[occasion];
  if (!target || slots.length === 0) return 0.70;

  const avgFormality = slots.reduce(
    (sum, s) => sum + (OCCASION_FORMALITY[s.article.clothingType] ?? 0.40),
    0,
  ) / slots.length;

  // Score based on distance from ideal
  const dist = Math.abs(avgFormality - target.ideal);
  // Penalty for being outside the acceptable range
  const outOfRange = avgFormality < target.min
    ? target.min - avgFormality
    : avgFormality > target.max
      ? avgFormality - target.max
      : 0;

  return Math.max(0, Math.min(1, 1.0 - dist * 0.8 - outOfRange * 1.5));
};

// ─── 3d. Simplicity / neutrality scoring ─────────────────────────────────────
// Classic styling principle: neutral base + at most one accent color.

const simplicityScore = (slots: OutfitSlot[]): number => {
  const colors = slots.map(s => s.article.color).filter(Boolean) as string[];
  if (colors.length === 0) return 0.60;

  const accents = colors.filter(c => !NEUTRAL_BASE_COLORS.has(c)).length;

  // All neutrals: clean, timeless
  if (accents === 0) return 0.85;
  // One accent pop: ideal
  if (accents === 1) return 1.00;
  // Two accents: ok if color wheel says they work
  if (accents === 2) return 0.60;
  // Three+ accents: busy
  return 0.30;
};

// ─── 3e. User preference scoring ─────────────────────────────────────────────

const outfitPreferenceScore = (slots: OutfitSlot[], profile: UserPreferenceProfile): number => {
  if (slots.length === 0) return 0.50;
  const scores = slots.map(s => articlePreferenceScore(s.article, profile));
  return scores.reduce((a, b) => a + b, 0) / scores.length;
};

// ─── 4. Outfit composite scorer ───────────────────────────────────────────────

/**
 * Personalization level for external callers (e.g. the UI score badge).
 * Mirrors the thresholds in userPreferences.ts without a circular import.
 */
export const personalizedScoreLevel = (totalOutfits: number): 'none' | 'learning' | 'active' =>
  totalOutfits >= PERSONALIZATION_THRESHOLD ? 'active' :
  totalOutfits >= LEARNING_THRESHOLD        ? 'learning' : 'none';

// Scoring weights vary by weather extremity — fabric matters more when comfort is critical.
// Preference weight scales up as the user logs more outfits (personal style ranker).
const getWeights = (bucket: WeatherBucket, totalOutfits: number) => {
  const extreme = bucket === 'freezing' || bucket === 'hot';
  const base = extreme
    ? { fabric: 0.40, color: 0.22, style: 0.22, simplicity: 0.08, preference: 0.08 }
    : { fabric: 0.30, color: 0.25, style: 0.25, simplicity: 0.10, preference: 0.10 };

  // Graduated personalization: preference weight grows as data accumulates.
  // Surplus is taken proportionally from fabric/color/style/simplicity so weights sum to 1.
  const boost =
    totalOutfits >= PERSONALIZATION_THRESHOLD ? 2.5 :
    totalOutfits >= LEARNING_THRESHOLD        ? 1.5 : 1.0;

  if (boost === 1.0) return base;

  const newPref   = Math.min(0.25, base.preference * boost);
  const delta     = newPref - base.preference;
  const nonPrefSum = 1 - base.preference;
  const scale     = (nonPrefSum - delta) / nonPrefSum;

  return {
    fabric:     base.fabric     * scale,
    color:      base.color      * scale,
    style:      base.style      * scale,
    simplicity: base.simplicity * scale,
    preference: newPref,
  };
};

// ─── Recency decay ─────────────��───────────────────────────���─────────────────
// Items worn yesterday get a full penalty; items worn 5 days ago get almost none.
// Exponential decay: penalty = base / (1 + daysSinceWorn).
// This naturally rotates the wardrobe without hard-blocking repeated items.
const RECENCY_PENALTY_BASE     = 0.15;   // penalty for item worn today/yesterday
const RECENCY_PENALTY_MAX      = 0.25;   // cap for entire outfit

const recencyPenaltyForArticle = (id: string, worn: RecentlyWorn): number => {
  if (worn instanceof Map) {
    const days = worn.get(id);
    if (days === undefined) return 0;
    // Exponential decay: worn today = full penalty, 3 days ago ≈ 25%, 7 days ago ≈ 12%
    return RECENCY_PENALTY_BASE / (1 + days);
  }
  // Legacy Set — flat penalty if present
  return worn.has(id) ? RECENCY_PENALTY_BASE * 0.67 : 0;
};

interface ScoredCombo {
  slots:     OutfitSlot[];
  score:     number;           // 0–100
  breakdown: ScoreBreakdown;
}

const scoreCombo = (
  slots:          OutfitSlot[],
  bucket:         WeatherBucket,
  feelsLikeF:     number,
  precipIntensity: PrecipIntensity,
  humidity:       number,
  windMph:        number,
  isSnowing:      boolean,
  settings:       Settings,
  recentlyWorn:   RecentlyWorn,
  profile:        UserPreferenceProfile,
): ScoredCombo => {
  const fabric     = outfitFabricScore(slots, bucket, feelsLikeF, precipIntensity, humidity, settings.humidityPreference, windMph, isSnowing);
  const color      = outfitColorScore(slots, profile);
  const style      = outfitStyleScore(slots, settings.clothingStyle);
  const simplicity = simplicityScore(slots);
  const preference = outfitPreferenceScore(slots, profile);
  const occasion   = occasionScore(slots, settings.occasion ?? 'everyday');

  const weights = getWeights(bucket, profile.totalOutfits);

  const recencyPenalty = Math.min(
    slots.reduce((sum, s) => sum + recencyPenaltyForArticle(s.article._id, recentlyWorn), 0),
    RECENCY_PENALTY_MAX,
  );

  // Occasion modifier: when occasion is set (not 'everyday'), it acts as a
  // multiplier on the style weight — appropriate occasions amplify style fit,
  // inappropriate ones dampen it. Keeps total weight budget stable.
  const occasionMod = (settings.occasion && settings.occasion !== 'everyday')
    ? (occasion - 0.50) * 0.12  // range: -0.06 to +0.06
    : 0;

  const raw =
    fabric     * weights.fabric     +
    color      * weights.color      +
    style      * weights.style      +
    simplicity * weights.simplicity +
    preference * weights.preference
    + occasionMod
    - recencyPenalty;

  return {
    slots,
    score: Math.round(Math.max(0, Math.min(1, raw)) * 100),
    breakdown: {
      fabric:     Math.round(fabric     * 100),
      color:      Math.round(color      * 100),
      style:      Math.round(style      * 100),
      simplicity: Math.round(simplicity * 100),
      preference: Math.round(preference * 100),
    },
  };
};

// ─── 5. Combination generator + engine entry point ───────────────────────────

/**
 * Maximum articles per role bucket to consider during combination generation.
 * Pre-filtering by individual fabric score keeps the search space tractable
 * for large wardrobes while ensuring quality candidates are included.
 */
const BUCKET_CAP = 8;

const topNByFabric = (
  articles: ClothingArticle[],
  bucket: WeatherBucket,
  feelsLikeF: number,
  precipIntensity: PrecipIntensity,
  humidity: number,
  humidityThreshold: number,
  windMph: number,
  isSnowing: boolean,
): ClothingArticle[] =>
  [...articles]
    .sort((a, b) =>
      fabricScore(b, bucket, feelsLikeF, precipIntensity, humidity, humidityThreshold, windMph, isSnowing) -
      fabricScore(a, bucket, feelsLikeF, precipIntensity, humidity, humidityThreshold, windMph, isSnowing)
    )
    .slice(0, BUCKET_CAP);

// ─── Headline copy ─────────────────────────────────────────────────────────────

const headline = (b: WeatherBucket): string =>
  b === 'hot'      ? "It's hot — keep it light."     :
  b === 'warm'     ? "Nice out — here's what works." :
  b === 'cool'     ? "A bit cool — layer up."        :
  b === 'cold'     ? "Bundle up today."              :
                     "Dress warm — it's freezing.";

// ─── Notes builder ────────────────────────────────────────────────────────────

interface NotesContext {
  bucket:           WeatherBucket;
  precipIntensity:  PrecipIntensity;
  windMph:          number;
  uvHigh:           boolean;
  uvIndexText:      string;
  isSnowing:        boolean;
  settings:         Settings;
  aqiHigh?:         boolean;
  pollenHigh?:      boolean;
}

const buildNotes = (
  slots:     OutfitSlot[],
  breakdown: ScoreBreakdown,
  ctx:       NotesContext,
): string[] => {
  const notes: string[] = [];

  // ── Wardrobe gap notes ────────────────────────────────────────────────
  const needsOuter = ctx.bucket === 'cool' || ctx.bucket === 'cold' || ctx.bucket === 'freezing';
  if (needsOuter && !slots.some(s => s.role === 'outerwear')) {
    notes.push(
      ctx.bucket === 'freezing' || ctx.bucket === 'cold'
        ? 'No coat in your closet — add one for cold days.'
        : 'A light jacket would work well today.',
    );
  }
  if (!slots.some(s => s.role === 'footwear')) {
    notes.push('No footwear in your closet yet.');
  }

  // ── Condition notes ───────────────────────────────────────────────────
  if (ctx.precipIntensity === 'heavy')
    notes.push('Heavy rain expected — waterproof layers strongly recommended.');
  else if (ctx.precipIntensity === 'moderate')
    notes.push('Rain expected — a water-resistant layer is recommended.');
  else if (ctx.precipIntensity === 'light')
    notes.push('Light rain possible — consider a layer you can wipe down.');

  if (ctx.isSnowing && !slots.some(s => s.article.clothingType === 'Boots')) {
    notes.push('Snow expected — boots would serve you better.');
  }

  if (ctx.windMph >= 20 && (ctx.bucket === 'cool' || ctx.bucket === 'cold' || ctx.bucket === 'freezing')) {
    notes.push('Windy today — wind-resistant fabrics like Denim or Leather help.');
  }

  if (ctx.uvHigh && !slots.some(s => s.article.clothingType === 'Hat' || s.article.clothingType === 'Cap')) {
    notes.push(`UV is ${ctx.uvIndexText} today — a hat would help protect you.`);
  }

  if (ctx.aqiHigh) {
    const hasAsthma = ctx.settings.sensitivities?.asthma;
    const syntheticSlots = slots.filter(s =>
      s.article.fabricType === 'Polyester' || s.article.fabricType === 'Synthetic',
    );
    if (hasAsthma) {
      notes.push('Air quality is poor today — choose breathable natural fabrics (Cotton, Linen) and consider a mask outdoors.');
    } else if (syntheticSlots.length > 0) {
      notes.push('Air quality is reduced today — breathable fabrics like Cotton or Linen are more comfortable.');
    } else {
      notes.push('Air quality is reduced today — limit outdoor exposure during peak hours.');
    }
  }

  if (ctx.pollenHigh) {
    const hasAllergies = ctx.settings.sensitivities?.allergies;
    const naturalFabricSlots = slots.filter(s =>
      s.article.fabricType === 'Cotton' || s.article.fabricType === 'Linen' || s.article.fabricType === 'Wool',
    );
    if (hasAllergies && naturalFabricSlots.length > 0) {
      const names = naturalFabricSlots.map(s => s.article.name || s.article.clothingType).join(' & ');
      notes.push(`High pollen today — natural fabrics like ${names.split(' & ')[0]}'s fabric can trap allergens. Machine-washable synthetics are easier to clean after outdoor exposure.`);
    } else if (hasAllergies) {
      notes.push('High pollen today — shower and change clothes after spending time outdoors.');
    } else {
      notes.push('Pollen levels are high today — allergy sufferers should take precautions.');
    }
  }

  // ── Fabric care warnings (rain-sensitive items) ────────────────────────
  if (ctx.precipIntensity !== 'none') {
    const RAIN_FRAGILE: Record<string, string> = {
      Silk:   'damaged by water and may stain permanently',
      Linen:  'prone to water marks and heavy wrinkling when wet',
    };
    for (const slot of slots) {
      const fabric = slot.article.fabricType ?? '';
      const warning = RAIN_FRAGILE[fabric];
      if (warning) {
        const name = slot.article.name || slot.article.clothingType;
        if (ctx.precipIntensity === 'heavy' || ctx.precipIntensity === 'moderate') {
          notes.push(`⚠ Your ${name} (${fabric}) can be ${warning} — strongly consider swapping it today.`);
        } else {
          notes.push(`Your ${name} (${fabric}) can be ${warning} — keep an eye on the sky.`);
        }
      }
    }
    // Leather gets a softer warning (water-resistant but can stain over time)
    const leatherItems = slots.filter(s => s.article.fabricType === 'Leather');
    if (leatherItems.length > 0 && (ctx.precipIntensity === 'heavy' || ctx.precipIntensity === 'moderate')) {
      const names = leatherItems.map(s => s.article.name || s.article.clothingType).join(' & ');
      notes.push(`Your ${names} (Leather) can water-stain in heavy rain — treat with protectant or swap.`);
    }
  }

  // ── Score-based notes ─────────────────────────────────────────────────
  if (breakdown.color < 55) {
    const worst = findClashingArticle(slots);
    if (worst) {
      const name = worst.article.name || worst.article.clothingType;
      notes.push(`Color harmony is low (${breakdown.color}/100) — consider swapping the ${name}.`);
    }
  }

  if (breakdown.fabric < 45) {
    notes.push(`Fabric suitability is low (${breakdown.fabric}/100) — these materials may not suit today's weather.`);
  }

  if (breakdown.style < 50) {
    notes.push(`Style alignment is low (${breakdown.style}/100) — some pieces don't fit your ${ctx.settings.clothingStyle} style.`);
  }

  // ── Care notes ────────────────────────────────────────────────────────
  const dryCleanItems = slots.filter(
    s => s.article.fabricType && DRY_CLEAN_FABRICS.has(s.article.fabricType),
  );
  if (dryCleanItems.length > 0) {
    const names = dryCleanItems.map(s => s.article.name || s.article.clothingType).join(' & ');
    notes.push(`Dry-clean recommended for: ${names}.`);
  }

  return notes;
};

// ─── Main: generate top-K ranked outfits ──────────────────────────────────────

export const generateOutfits = (
  articles:     ClothingArticle[],
  weather:      CurrentWeather,
  settings:     Settings,
  recentlyWorn: RecentlyWorn          = new Set(),
  topK:         number               = 3,
  profile:      UserPreferenceProfile = { colors: {}, fabrics: {}, categories: {}, colorPairs: {}, totalOutfits: 0 },
  forecasts:    Forecast[]           = [],
): { results: OutfitResult[]; status: OutfitStatus } => {

  // ── Early exits ──────────────────────────────────────────────────────────
  const empty_result = (status: OutfitStatus): { results: OutfitResult[]; status: OutfitStatus } => ({
    status,
    results: [{
      status,
      headline: '',
      slots:    [],
      notes:    [],
      score:    0,
      scoreBreakdown: { fabric: 0, color: 0, style: 0, simplicity: 0, preference: 0 },
    }],
  });

  if (articles.length === 0) return empty_result('empty_closet');

  // ── Weather context ───────────────────────────────────────────────────────
  const feelsLikeF       = weather.RealFeelTemperature.Imperial.Value;
  const precipIntensity  = classifyPrecipitation(weather);
  const humidity         = weather.RelativeHumidity;
  const windMph          = weather.Wind.Speed.Imperial.Value;
  const uvIndexText      = weather.UVIndexText ?? '';
  const isSnowing        = /snow/i.test(weather.WeatherText ?? '');
  const uvHigh           = UV_HIGH_LABELS.has(uvIndexText);

  // ── Time-of-day warmth adjustment ──────────────────────────────────────────
  // In the morning (before noon) the user is dressing for the full day ahead,
  // which may include cooler temps later. We blend the current feels-like with
  // the forecast low so the ideal warmth leans warmer. By afternoon the current
  // reading is representative — no adjustment needed.
  const currentHour = new Date().getHours();
  let effectiveFeelsLike = feelsLikeF;
  if (forecasts.length > 0 && currentHour < 12) {
    const feelsOffset = feelsLikeF - weather.Temperature.Imperial.Value;
    const forecastTemps = forecasts.map(f => f.Temperature.Value + feelsOffset);
    const forecastLow = Math.min(...forecastTemps);
    // Blend factor: at 6 AM lean 40% toward the day's low; at 11 AM lean 10%
    const blendFactor = Math.max(0.10, 0.40 - (currentHour - 6) * 0.05);
    effectiveFeelsLike = feelsLikeF * (1 - blendFactor) + forecastLow * blendFactor;
  }
  const bucket      = getWeatherBucket(effectiveFeelsLike, settings.hiTempThreshold, settings.lowTempThreshold);

  // ── Phase 1: Hard filter → role bucketing → pre-rank per bucket ───────────
  const byRole = new Map<OutfitRole, ClothingArticle[]>();
  for (const a of articles) {
    if (!isWeatherAppropriate(a, bucket)) continue;
    const r = roleOf(a);
    if (!byRole.has(r)) byRole.set(r, []);
    byRole.get(r)!.push(a);
  }

  const cap = (role: OutfitRole) =>
    topNByFabric(byRole.get(role) ?? [], bucket, effectiveFeelsLike, precipIntensity, humidity, settings.humidityPreference, windMph, isSnowing);

  const tops        = cap('top');
  const bottoms     = cap('bottom');
  const fullBodies  = cap('fullBody');
  const midLayers   = cap('midLayer');
  const outerwears  = cap('outerwear');
  const footwears   = cap('footwear');
  const accessories = cap('accessory');

  const hasCoreTopBottom = tops.length > 0 && bottoms.length > 0;
  const hasFullBody      = fullBodies.length > 0;
  if (!hasCoreTopBottom && !hasFullBody) return empty_result('insufficient');

  // ── Phase 2: Build candidate lists for optional/conditional roles ─────────

  // Mid layer (Hoodie, Sweater): excluded in hot; required in cold/freezing if
  // available; optional (try with and without) in cool and warm.
  // Capped at 4 to avoid combinatorial explosion with large wardrobes.
  const midOptions: (ClothingArticle | null)[] =
    bucket === 'hot' || midLayers.length === 0
      ? [null]
      : bucket === 'cold' || bucket === 'freezing'
        ? midLayers.slice(0, 4)
        : [...midLayers.slice(0, 4), null];  // cool/warm: optional

  // Outerwear: required in cool/cold/freezing; required if moderate+ rain;
  // optional if light rain; skip otherwise
  const outerOptions: (ClothingArticle | null)[] =
    bucket === 'cool' || bucket === 'cold' || bucket === 'freezing'
      ? outerwears.length > 0 ? outerwears : [null]   // null → "missing" note
      : (precipIntensity === 'heavy' || precipIntensity === 'moderate') && outerwears.length > 0
        ? outerwears                                   // moderate+ rain → require
        : precipIntensity === 'light' && outerwears.length > 0
          ? [...outerwears, null]                      // light rain → optional
          : [null];                                    // no rain → skip

  const shoeOptions: (ClothingArticle | null)[] =
    footwears.length > 0 ? footwears : [null];

  // Accessory combos: up to 2 non-competing accessories (different body zones).
  // When UV is high, hats and caps float to the front to appear in top combos.
  const sortedAccessories = uvHigh
    ? [...accessories].sort((a, b) => {
        const aHat = (a.clothingType === 'Hat' || a.clothingType === 'Cap') ? -1 : 1;
        const bHat = (b.clothingType === 'Hat' || b.clothingType === 'Cap') ? -1 : 1;
        return aHat - bHat;
      })
    : accessories;
  const accCombos = buildAccCombos(sortedAccessories);

  // ── Phase 3: Enumerate combinations with two-pass optimization ─────────────
  // When the search space is large (>200 core combos), a cheap fabric-only first
  // pass prunes to the top 50 cores before the expensive full cross-product.
  // This keeps performance linear with closet size while preserving quality.

  const scored: ScoredCombo[] = [];

  // Build core combos (top+bottom, or full-body)
  let coreCombos: OutfitSlot[][] = [];
  for (const fb of fullBodies) {
    coreCombos.push([{ role: 'fullBody', article: fb }]);
  }
  if (hasCoreTopBottom) {
    for (const top of tops) {
      for (const bottom of bottoms) {
        coreCombos.push([
          { role: 'top',    article: top    },
          { role: 'bottom', article: bottom },
        ]);
      }
    }
  }

  // Two-pass pruning: if core combos exceed threshold, pre-rank by fabric score
  const CORE_COMBO_THRESHOLD = 200;
  const CORE_COMBO_KEEP      = 50;

  if (coreCombos.length > CORE_COMBO_THRESHOLD) {
    // Cheap pass: score only by fabric appropriateness (no color/style/preference)
    const withFabricScore = coreCombos.map(slots => ({
      slots,
      cheapScore: outfitFabricScore(slots, bucket, effectiveFeelsLike, precipIntensity, humidity, settings.humidityPreference, windMph, isSnowing),
    }));
    withFabricScore.sort((a, b) => b.cheapScore - a.cheapScore);
    coreCombos = withFabricScore.slice(0, CORE_COMBO_KEEP).map(x => x.slots);
  }

  // Full cross-product with midLayer × outerwear × footwear × accessory combos
  for (const core of coreCombos) {
    for (const mid of midOptions) {
      for (const outer of outerOptions) {
        for (const shoe of shoeOptions) {
          for (const accCombo of accCombos) {
            const slots: OutfitSlot[] = [...core];
            if (mid)   slots.push({ role: 'midLayer',  article: mid   });
            if (outer) slots.push({ role: 'outerwear', article: outer });
            if (shoe)  slots.push({ role: 'footwear',  article: shoe  });
            for (const acc of accCombo) {
              slots.push({ role: 'accessory', article: acc });
            }

            scored.push(scoreCombo(slots, bucket, effectiveFeelsLike, precipIntensity, humidity, windMph, isSnowing, settings, recentlyWorn, profile));
          }
        }
      }
    }
  }

  // ── Phase 4: Sort → deduplicate → diversity filter → take top-K ──────────
  // Enforces that each result in the top-K differs from every already-picked
  // result by at least 2 non-accessory slots. This prevents 3 near-identical
  // outfits that only swap an accessory or shoes from dominating the results.
  scored.sort((a, b) => b.score - a.score);

  const CORE_ROLES: OutfitRole[] = ['top', 'bottom', 'fullBody', 'midLayer', 'outerwear'];

  /** Returns the array of article IDs in "core" roles (non-accessory, non-footwear). */
  const coreIds = (slots: OutfitSlot[]): string[] =>
    slots.filter(s => CORE_ROLES.indexOf(s.role) !== -1).map(s => s.article._id);

  /** Count how many core slots differ between two outfits. */
  const coreDifference = (a: OutfitSlot[], b: OutfitSlot[]): number => {
    const idsA = coreIds(a);
    const idsB = coreIds(b);
    const setB = new Set(idsB);
    let shared = 0;
    for (let i = 0; i < idsA.length; i++) {
      if (setB.has(idsA[i])) shared++;
    }
    const totalUnique = idsA.length + idsB.length - shared;
    return totalUnique - shared; // number of IDs that appear in one but not both
  };

  const seen    = new Set<string>();
  const topList: ScoredCombo[] = [];

  for (const combo of scored) {
    // Dedup key: sorted article IDs (order-independent)
    const key = combo.slots.map(s => s.article._id).sort().join('|');
    if (seen.has(key)) continue;

    // Diversity gate: must differ by at least 2 core slots from every already-picked outfit
    const diverse = topList.every(
      picked => coreDifference(combo.slots, picked.slots) >= 2,
    );
    if (!diverse) continue;

    seen.add(key);
    topList.push(combo);
    if (topList.length >= topK) break;
  }

  // ── Phase 5: Attach notes and build OutfitResult[] ───────────────────────

  const notesCtx: NotesContext = {
    bucket, precipIntensity, windMph, uvHigh, uvIndexText, isSnowing, settings,
    aqiHigh:    weather.AirQualityText  ? AQI_HIGH_LABELS.has(weather.AirQualityText)  : undefined,
    pollenHigh: weather.PollenCategory  ? POLLEN_HIGH_LABELS.has(weather.PollenCategory) : undefined,
  };

  // Build layering context once — weather/forecast/settings inputs are constant
  // across all outfit candidates, so deriveDayRange, rainForecast, and necessity
  // scoring should not be repeated inside the per-outfit map below.
  const layeringCtx = buildLayeringContext({ weather, forecasts, settings });

  const isPersonalized = profile.totalOutfits >= PERSONALIZATION_THRESHOLD;

  const results: OutfitResult[] = topList.map(combo => {
    const layering = generateLayeringRecommendation({ context: layeringCtx, slots: combo.slots });

    // Confidence-weighted score boost: outfits with high layering confidence
    // (well-matched layers, stable weather) get a small bump; low confidence
    // (wardrobe gaps, high variability) gets nothing. Range: 0 to +3 points.
    const confidenceBoost = Math.round((layering.confidence - 0.5) * 6);
    const adjustedScore = Math.max(0, Math.min(100, combo.score + confidenceBoost));

    return {
      status:          'ok' as OutfitStatus,
      headline:        headline(bucket),
      slots:           combo.slots,
      notes:           buildNotes(combo.slots, combo.breakdown, notesCtx),
      score:           adjustedScore,
      scoreBreakdown:  combo.breakdown,
      layering,
      isPersonalized,
    };
  });

  // Re-sort after confidence adjustment (may swap adjacent results)
  results.sort((a, b) => b.score - a.score);

  return { results, status: 'ok' };
};

// ─── Backwards-compatible single-result export ────────────────────────────────

export const generateOutfit = (
  articles:     ClothingArticle[],
  weather:      CurrentWeather,
  settings:     Settings,
  recentlyWorn: RecentlyWorn = new Set(),
  forecasts:    Forecast[]  = [],
): OutfitResult => {
  const { results, status } = generateOutfits(articles, weather, settings, recentlyWorn, 1, undefined, forecasts);
  return results[0] ?? {
    status,
    headline:       '',
    slots:          [],
    notes:          [],
    score:          0,
    scoreBreakdown: { fabric: 0, color: 0, style: 0, simplicity: 0, preference: 0 },
  };
};

// ─── Backwards-compatible weather headline ────────────────────────────────────

export const weatherHeadline = (weather: CurrentWeather, settings: Settings): string =>
  headline(getWeatherBucket(
    weather.RealFeelTemperature.Imperial.Value,
    settings.hiTempThreshold,
    settings.lowTempThreshold,
  ));
