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

import { ClothingArticle, CurrentWeather, Forecast, Settings } from '../types';
import { articlePreferenceScore, UserPreferenceProfile } from './userPreferences';
import { generateLayeringRecommendation, LayeringResult } from './layeringEngine';

// ─── Core types ───────────────────────────────────────────────────────────────

export type OutfitRole = 'top' | 'bottom' | 'fullBody' | 'outerwear' | 'footwear' | 'accessory';
export type WeatherBucket = 'hot' | 'warm' | 'cool' | 'cold' | 'freezing';

export interface OutfitSlot {
  role:    OutfitRole;
  article: ClothingArticle;
}

export type OutfitStatus = 'ok' | 'empty_closet' | 'insufficient';

export interface ScoreBreakdown {
  fabric:     number;  // 0–100
  color:      number;  // 0–100
  style:      number;  // 0–100
  simplicity: number;  // 0–100
  preference: number;  // 0–100
}

export interface OutfitResult {
  status:         OutfitStatus;
  headline:       string;
  slots:          OutfitSlot[];
  notes:          string[];
  score:          number;        // 0–100 composite
  scoreBreakdown: ScoreBreakdown;
  layering?:      LayeringResult;
}

// ─── Weather bucketing ────────────────────────────────────────────────────────

export const getWeatherBucket = (
  feelsLikeF: number,
  hiThreshold: number,
  loThreshold: number,
): WeatherBucket => {
  if (feelsLikeF >= hiThreshold)       return 'hot';
  if (feelsLikeF >= loThreshold)       return 'warm';
  if (feelsLikeF >= loThreshold - 15)  return 'cool';
  if (feelsLikeF >= 32)                return 'cold';
  return 'freezing';
};

// ─── 1. Hard weather filter ───────────────────────────────────────────────────
// Eliminates items that are clearly climatically impossible — these never enter
// the combination space, so the scorer never has to penalise them.

const HARD_EXCLUDE_HOT      = new Set(['Coat', 'Gloves', 'Scarf', 'Sweater']);
const HARD_EXCLUDE_COLD     = new Set(['Sandals', 'Shorts']);
const HARD_EXCLUDE_FREEZING = new Set(['Sandals', 'Shorts', 'Skirt']);

const isWeatherAppropriate = (
  a: ClothingArticle,
  bucket: WeatherBucket,
): boolean => {
  if (bucket === 'hot'                         && HARD_EXCLUDE_HOT.has(a.clothingType))      return false;
  if (bucket === 'freezing'                    && HARD_EXCLUDE_FREEZING.has(a.clothingType)) return false;
  if (bucket === 'cold'                        && HARD_EXCLUDE_COLD.has(a.clothingType))     return false;
  return true;
};

// ─── 2. Role classification ───────────────────────────────────────────────────

const ROLE_MAP: Record<string, OutfitRole> = {
  Shirt: 'top', 'T-Shirt': 'top', Blouse: 'top', Sweater: 'top', Hoodie: 'top',
  Jacket: 'outerwear', Coat: 'outerwear',
  Pants: 'bottom', Jeans: 'bottom', Shorts: 'bottom', Skirt: 'bottom',
  Dress: 'fullBody',
  Shoes: 'footwear', Sneakers: 'footwear', Boots: 'footwear', Sandals: 'footwear',
  Hat: 'accessory', Cap: 'accessory', Scarf: 'accessory', Gloves: 'accessory',
  Belt: 'accessory', Bag: 'accessory', Watch: 'accessory', Jewelry: 'accessory', Socks: 'accessory',
};

const roleOf = (a: ClothingArticle): OutfitRole =>
  ROLE_MAP[a.clothingType] ?? (a.isAccessory ? 'accessory' : 'top');

// ─── 3a. Fabric × weather scoring ────────────────────────────────────────────
// 0–1 score for how appropriate a fabric is in each weather bucket.
// Built as a lookup table so new fabrics can be added without changing logic.

// ─── Precipitation intensity grading ─────────────────────────────────────────
// Replaces the binary "raining" flag with a 0–1 intensity scale.
// Light drizzle barely affects fabric scoring; heavy downpours aggressively
// penalize absorbent fabrics and reward water-resistant ones.
export type PrecipIntensity = 'none' | 'light' | 'moderate' | 'heavy';

const classifyPrecipitation = (weather: CurrentWeather): PrecipIntensity => {
  if (!weather.HasPrecipitation) return 'none';
  const amountInch = weather.Precip1hr?.Imperial?.Value ?? 0;
  // AccuWeather precipitation rates (inches/hr): light < 0.1, moderate 0.1–0.3, heavy > 0.3
  if (amountInch >= 0.30) return 'heavy';
  if (amountInch >= 0.10) return 'moderate';
  // If HasPrecipitation but no amount data, infer from WeatherText
  const text = (weather.WeatherText ?? '').toLowerCase();
  if (text.includes('heavy') || text.includes('downpour')) return 'heavy';
  if (text.includes('shower') || text.includes('storm'))   return 'moderate';
  return 'light';
};

/** Multiplier for rain-related fabric adjustments based on intensity. */
const precipMultiplier = (intensity: PrecipIntensity): number => {
  switch (intensity) {
    case 'none':     return 0;
    case 'light':    return 0.4;
    case 'moderate': return 0.7;
    case 'heavy':    return 1.0;
  }
};

// Fabrics that typically require dry-cleaning (used in care notes).
const DRY_CLEAN_FABRICS = new Set(['Silk', 'Wool']);

// AccuWeather UVIndexText values considered high enough to warrant a hat note.
const UV_HIGH_LABELS = new Set(['High', 'Very High', 'Extreme']);

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
const garmentWarmth = (article: ClothingArticle): number => {
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

  // Rain modifier: scaled by precipitation intensity.
  // Heavy rain strongly penalizes absorbent fabrics; light drizzle barely matters.
  const pMul = precipMultiplier(precipIntensity);
  if (pMul > 0) {
    if (a.fabricType === 'Leather' || a.fabricType === 'Synthetic') s += 0.12 * pMul;
    if (a.fabricType === 'Linen'   || a.fabricType === 'Silk')      s -= 0.12 * pMul;
    if (a.fabricType === 'Cotton')                                   s -= 0.06 * pMul;
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
// 12-position RYB color wheel. Wheel position is 0–11 (30° per step).
// Harmony score is based on the angular distance between two colors.

const COLOR_WHEEL_POSITION: Record<string, number> = {
  // Position 0 — Red family
  Red: 0, Crimson: 0, Maroon: 0, Burgundy: 0,
  // Position 2 — Orange family
  Orange: 2, Coral: 2, Salmon: 2, Rust: 2,
  // Position 3 — Gold/yellow-orange
  Gold: 3,
  // Position 4 — Yellow family
  Yellow: 4,
  // Position 5 — Yellow-green
  Olive: 5, Khaki: 5,
  // Position 6 — Green family
  Green: 6, Mint: 6,
  // Position 7 — Blue-green
  Teal: 7, Cyan: 7,
  // Position 8 — Blue family
  Blue: 8, 'Sky Blue': 8, Cobalt: 8,
  // Position 9 — Blue-purple / dark blue
  Navy: 9, Indigo: 9,
  // Position 10 — Purple family
  Purple: 10, Violet: 10, Plum: 10,
  // Position 11 — Red-purple / pink
  Pink: 11, Magenta: 11, Lavender: 11, Rose: 11,
};

// Neutrals harmonise with everything — they don't interact with the wheel.
const COLOR_NEUTRALS = new Set([
  'Black', 'White', 'Grey', 'Gray', 'Beige', 'Brown',
  'Ivory', 'Cream', 'Tan', 'Silver', 'Multi',
]);

/**
 * Returns 0–1 harmony score for two colors.
 * Based on standard color theory interval relationships.
 */
const pairHarmony = (colorA: string, colorB: string): number => {
  // Neutrals pair perfectly with anything
  if (COLOR_NEUTRALS.has(colorA) || COLOR_NEUTRALS.has(colorB)) return 0.90;

  const posA = COLOR_WHEEL_POSITION[colorA];
  const posB = COLOR_WHEEL_POSITION[colorB];

  // Unknown color → treat as neutral
  if (posA === undefined || posB === undefined) return 0.70;

  // Angular distance on the wheel (0–6)
  const d = Math.min(Math.abs(posA - posB), 12 - Math.abs(posA - posB));

  // Harmony scoring by interval:
  if (d === 0) return 0.70;   // Monochromatic — clean but not dynamic
  if (d === 1) return 0.80;   // Analogous — pleasing, low contrast
  if (d === 2) return 0.65;   // Near-analogous — subtle
  if (d === 3) return 0.35;   // Quarter-wheel — can clash (e.g. red + yellow-green)
  if (d === 4) return 0.75;   // Tetradic — bold, structured
  if (d === 5) return 0.85;   // Split-complementary — visually exciting
  if (d === 6) return 1.00;   // Complementary — highest contrast harmony
  return 0.50;
};

// ─── Seasonal color palette ──────────────────────────────────────────────────
// Subtle boost for colors that feel season-appropriate. Nothing is penalized —
// only in-season colors get a small bonus, keeping the scoring additive.
type Season = 'spring' | 'summer' | 'autumn' | 'winter';

const currentSeason = (): Season => {
  const month = new Date().getMonth(); // 0-indexed
  if (month >= 2 && month <= 4) return 'spring';
  if (month >= 5 && month <= 7) return 'summer';
  if (month >= 8 && month <= 10) return 'autumn';
  return 'winter';
};

const SEASONAL_COLORS: Record<Season, Set<string>> = {
  spring: new Set(['Pink', 'Lavender', 'Mint', 'Coral', 'Sky Blue', 'Yellow', 'Rose', 'Cream']),
  summer: new Set(['White', 'Cyan', 'Coral', 'Yellow', 'Orange', 'Sky Blue', 'Teal', 'Mint']),
  autumn: new Set(['Rust', 'Burgundy', 'Olive', 'Brown', 'Gold', 'Maroon', 'Orange', 'Khaki', 'Tan']),
  winter: new Set(['Navy', 'Black', 'Burgundy', 'Plum', 'Indigo', 'Grey', 'Silver', 'Cobalt']),
};

/** Returns a 0–0.08 seasonal bonus based on how many outfit colors match the season. */
const seasonalBonus = (outfitColors: string[]): number => {
  const season = currentSeason();
  const palette = SEASONAL_COLORS[season];
  const matchCount = outfitColors.filter(c => palette.has(c)).length;
  if (outfitColors.length === 0) return 0;
  // Scale: 1 match = 0.03, 2+ = 0.05–0.08
  return Math.min(0.08, matchCount * 0.03);
};

const outfitColorScore = (slots: OutfitSlot[]): number => {
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

  // Add seasonal bonus — additive, capped at 1.0
  return Math.min(1.0, blended + seasonalBonus(outfitColors));
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
    const others = slots.filter(s => s !== slot);
    const avg = others.reduce(
      (sum, other) => sum + pairHarmony(slot.article.color!, other.article.color ?? 'Black'),
      0,
    ) / others.length;
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

// ─── 3d. Simplicity / neutrality scoring ─────────────────────────────────────
// Classic styling principle: neutral base + at most one accent color.

const NEUTRAL_BASE_COLORS = new Set(['Black', 'White', 'Grey', 'Beige', 'Brown', 'Navy']);

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

// Scoring weights vary by weather extremity — fabric matters more when comfort is critical.
const getWeights = (bucket: WeatherBucket) => {
  if (bucket === 'freezing' || bucket === 'hot') {
    return { fabric: 0.40, color: 0.22, style: 0.22, simplicity: 0.08, preference: 0.08 };
  }
  return { fabric: 0.30, color: 0.25, style: 0.25, simplicity: 0.10, preference: 0.10 };
};

// ─── Recency decay ─────────────��───────────────────────────���─────────────────
// Items worn yesterday get a full penalty; items worn 5 days ago get almost none.
// Exponential decay: penalty = base / (1 + daysSinceWorn).
// This naturally rotates the wardrobe without hard-blocking repeated items.
const RECENCY_PENALTY_BASE     = 0.15;   // penalty for item worn today/yesterday
const RECENCY_PENALTY_MAX      = 0.25;   // cap for entire outfit

/** Accepts either legacy Set<string> or Map<string, number> (id→daysSinceWorn). */
export type RecentlyWorn = Set<string> | Map<string, number>;

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
  const color      = outfitColorScore(slots);
  const style      = outfitStyleScore(slots, settings.clothingStyle);
  const simplicity = simplicityScore(slots);
  const preference = outfitPreferenceScore(slots, profile);

  const weights = getWeights(bucket);

  const recencyPenalty = Math.min(
    slots.reduce((sum, s) => sum + recencyPenaltyForArticle(s.article._id, recentlyWorn), 0),
    RECENCY_PENALTY_MAX,
  );

  const raw =
    fabric     * weights.fabric     +
    color      * weights.color      +
    style      * weights.style      +
    simplicity * weights.simplicity +
    preference * weights.preference
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

// ─── Main: generate top-K ranked outfits ──────────────────────────────────────

export const generateOutfits = (
  articles:     ClothingArticle[],
  weather:      CurrentWeather,
  settings:     Settings,
  recentlyWorn: RecentlyWorn          = new Set(),
  topK:         number               = 3,
  profile:      UserPreferenceProfile = { colors: {}, fabrics: {}, categories: {}, totalOutfits: 0 },
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
  const raining          = precipIntensity !== 'none';
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
  const bucket      = getWeatherBucket(feelsLikeF, settings.hiTempThreshold, settings.lowTempThreshold);

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
  const outerwears  = cap('outerwear');
  const footwears   = cap('footwear');
  const accessories = cap('accessory');

  const hasCoreTopBottom = tops.length > 0 && bottoms.length > 0;
  const hasFullBody      = fullBodies.length > 0;
  if (!hasCoreTopBottom && !hasFullBody) return empty_result('insufficient');

  // ── Phase 2: Build candidate lists for optional/conditional roles ─────────

  // Outerwear: required in cool/cold/freezing; optional if raining; skip otherwise
  const outerOptions: (ClothingArticle | null)[] =
    bucket === 'cool' || bucket === 'cold' || bucket === 'freezing'
      ? outerwears.length > 0 ? outerwears : [null]   // null → "missing" note
      : raining && outerwears.length > 0
        ? [...outerwears, null]                        // try both with + without
        : [null];                                      // hot/warm, no rain → skip

  const shoeOptions: (ClothingArticle | null)[] =
    footwears.length > 0 ? footwears : [null];

  // One accessory slot, optional.
  // When UV is high, hats and caps float to the front so they appear in top combos.
  const sortedAccessories = uvHigh
    ? [...accessories].sort((a, b) => {
        const aHat = (a.clothingType === 'Hat' || a.clothingType === 'Cap') ? -1 : 1;
        const bHat = (b.clothingType === 'Hat' || b.clothingType === 'Cap') ? -1 : 1;
        return aHat - bHat;
      })
    : accessories;
  const accOptions: (ClothingArticle | null)[] = [null, ...sortedAccessories.slice(0, 4)];

  // ── Phase 3: Enumerate all valid combinations and score each ──────────────

  const scored: ScoredCombo[] = [];

  // Build core combos (top+bottom, or full-body)
  const coreCombos: OutfitSlot[][] = [];
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

  // Cross-product with outerwear × footwear × accessory
  for (const core of coreCombos) {
    for (const outer of outerOptions) {
      for (const shoe of shoeOptions) {
        for (const acc of accOptions) {
          const slots: OutfitSlot[] = [...core];
          if (outer) slots.push({ role: 'outerwear', article: outer });
          if (shoe)  slots.push({ role: 'footwear',  article: shoe  });
          if (acc)   slots.push({ role: 'accessory', article: acc   });

          scored.push(scoreCombo(slots, bucket, effectiveFeelsLike, precipIntensity, humidity, windMph, isSnowing, settings, recentlyWorn, profile));
        }
      }
    }
  }

  // ── Phase 4: Sort → deduplicate → diversity filter → take top-K ──────────
  // Enforces that each result in the top-K differs from every already-picked
  // result by at least 2 non-accessory slots. This prevents 3 near-identical
  // outfits that only swap an accessory or shoes from dominating the results.
  scored.sort((a, b) => b.score - a.score);

  const CORE_ROLES: OutfitRole[] = ['top', 'bottom', 'fullBody', 'outerwear'];

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

  const buildNotes = (slots: OutfitSlot[], breakdown: ScoreBreakdown): string[] => {
    const notes: string[] = [];

    // ── Wardrobe gap notes ────────────────────────────────────────────────
    const needsOuter = bucket === 'cool' || bucket === 'cold' || bucket === 'freezing';
    if (needsOuter && !slots.some(s => s.role === 'outerwear')) {
      notes.push(
        bucket === 'freezing' || bucket === 'cold'
          ? 'No coat in your closet — add one for cold days.'
          : 'A light jacket would work well today.',
      );
    }
    if (!slots.some(s => s.role === 'footwear')) {
      notes.push('No footwear in your closet yet.');
    }

    // ── Condition notes ───────────────────────────────────────────────────
    if (precipIntensity === 'heavy')
      notes.push('Heavy rain expected — waterproof layers strongly recommended.');
    else if (precipIntensity === 'moderate')
      notes.push('Rain expected — a water-resistant layer is recommended.');
    else if (precipIntensity === 'light')
      notes.push('Light rain possible — consider a layer you can wipe down.');

    if (isSnowing && !slots.some(s => s.article.clothingType === 'Boots')) {
      notes.push('Snow expected — boots would serve you better.');
    }

    if (windMph >= 20 && (bucket === 'cool' || bucket === 'cold' || bucket === 'freezing')) {
      notes.push('Windy today — wind-resistant fabrics like Denim or Leather help.');
    }

    if (uvHigh && !slots.some(s => s.article.clothingType === 'Hat' || s.article.clothingType === 'Cap')) {
      notes.push(`UV is ${uvIndexText} today — a hat would help protect you.`);
    }

    // ── Score-based notes ─────────────────────────────────────────────────
    if (breakdown.color < 55) {
      const worst = findClashingArticle(slots);
      if (worst) {
        const name = worst.article.name ?? worst.article.clothingType;
        notes.push(`Color harmony is low (${breakdown.color}/100) — consider swapping the ${name}.`);
      }
    }

    if (breakdown.fabric < 45) {
      notes.push(`Fabric suitability is low (${breakdown.fabric}/100) — these materials may not suit today's weather.`);
    }

    if (breakdown.style < 50) {
      notes.push(`Style alignment is low (${breakdown.style}/100) — some pieces don't fit your ${settings.clothingStyle} style.`);
    }

    // ── Care notes ────────────────────────────────────────────────────────
    const dryCleanItems = slots.filter(
      s => s.article.fabricType && DRY_CLEAN_FABRICS.has(s.article.fabricType),
    );
    if (dryCleanItems.length > 0) {
      const names = dryCleanItems.map(s => s.article.name ?? s.article.clothingType).join(' & ');
      notes.push(`Dry-clean recommended for: ${names}.`);
    }

    return notes;
  };

  const results: OutfitResult[] = topList.map(combo => ({
    status:         'ok',
    headline:       headline(bucket),
    slots:          combo.slots,
    notes:          buildNotes(combo.slots, combo.breakdown),
    score:          combo.score,
    scoreBreakdown: combo.breakdown,
    layering:       generateLayeringRecommendation({ weather, forecasts, slots: combo.slots }),
  }));

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
