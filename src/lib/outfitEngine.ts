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

import { ClothingArticle, CurrentWeather, Settings } from '../types';
import { loadPreferences, articlePreferenceScore } from './userPreferences';

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

const HARD_EXCLUDE_HOT  = new Set(['Coat', 'Gloves', 'Scarf']);
const HARD_EXCLUDE_COLD = new Set(['Sandals', 'Shorts']);

const isWeatherAppropriate = (
  a: ClothingArticle,
  bucket: WeatherBucket,
): boolean => {
  if (bucket === 'hot'      && HARD_EXCLUDE_HOT.has(a.clothingType))  return false;
  if ((bucket === 'cold' || bucket === 'freezing') && HARD_EXCLUDE_COLD.has(a.clothingType)) return false;
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

const fabricScore = (
  a: ClothingArticle,
  bucket: WeatherBucket,
  raining: boolean,
  humidity: number,
  humidityThreshold: number,
): number => {
  const base = a.fabricType
    ? (FABRIC_WEATHER[a.fabricType]?.[bucket] ?? 0.50)
    : 0.50;

  let s = base;

  // Rain modifier: water-resistant fabrics get a bonus
  if (raining) {
    if (a.fabricType === 'Leather' || a.fabricType === 'Synthetic') s += 0.10;
    if (a.fabricType === 'Linen'   || a.fabricType === 'Silk')      s -= 0.10;
  }

  // Humidity modifier: breathable fabrics preferred in humid conditions
  if (humidity > humidityThreshold) {
    if (a.fabricType === 'Linen' || a.fabricType === 'Cotton') s += 0.08;
    if (a.fabricType === 'Wool'  || a.fabricType === 'Polyester') s -= 0.05;
  }

  return Math.max(0, Math.min(1, s));
};

const outfitFabricScore = (
  slots: OutfitSlot[],
  bucket: WeatherBucket,
  raining: boolean,
  humidity: number,
  humidityThreshold: number,
): number => {
  if (slots.length === 0) return 0;
  const sum = slots.reduce(
    (acc, s) => acc + fabricScore(s.article, bucket, raining, humidity, humidityThreshold),
    0,
  );
  return sum / slots.length;
};

// ─── 3b. Color harmony scoring ────────────────────────────────────────────────
// 12-position RYB color wheel. Wheel position is 0–11 (30° per step).
// Harmony score is based on the angular distance between two colors.

const COLOR_WHEEL_POSITION: Record<string, number> = {
  Red: 0, Orange: 2, Yellow: 4, Green: 6,
  Blue: 8, Navy: 9, Purple: 10, Pink: 11,
};

// Neutrals harmonise with everything — they don't interact with the wheel.
const COLOR_NEUTRALS = new Set(['Black', 'White', 'Grey', 'Beige', 'Brown', 'Multi']);

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

const outfitColorScore = (slots: OutfitSlot[]): number => {
  const colors = slots.map(s => s.article.color).filter(Boolean) as string[];
  if (colors.length < 2) return 0.70;  // single color → neutral score

  let total = 0, pairs = 0;
  for (let i = 0; i < colors.length; i++) {
    for (let j = i + 1; j < colors.length; j++) {
      total += pairHarmony(colors[i], colors[j]);
      pairs++;
    }
  }
  return pairs > 0 ? total / pairs : 0.70;
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

const outfitPreferenceScore = (slots: OutfitSlot[]): number => {
  if (slots.length === 0) return 0.50;
  const profile = loadPreferences();
  const scores = slots.map(s => articlePreferenceScore(s.article, profile));
  return scores.reduce((a, b) => a + b, 0) / scores.length;
};

// ─── 4. Outfit composite scorer ───────────────────────────────────────────────

// Scoring weights — must sum to 1.
const WEIGHTS = {
  fabric:     0.30,
  color:      0.25,
  style:      0.25,
  simplicity: 0.10,
  preference: 0.10,
} as const;

// Recency penalty per recently-worn article slot (encourages variety).
const RECENCY_PENALTY_PER_SLOT = 0.12;

interface ScoredCombo {
  slots:     OutfitSlot[];
  score:     number;           // 0–100
  breakdown: ScoreBreakdown;
}

const scoreCombo = (
  slots:          OutfitSlot[],
  bucket:         WeatherBucket,
  raining:        boolean,
  humidity:       number,
  settings:       Settings,
  recentlyWorn:   Set<string>,
): ScoredCombo => {
  const fabric     = outfitFabricScore(slots, bucket, raining, humidity, settings.humidityPreference);
  const color      = outfitColorScore(slots);
  const style      = outfitStyleScore(slots, settings.clothingStyle);
  const simplicity = simplicityScore(slots);
  const preference = outfitPreferenceScore(slots);

  const recencyPenalty = slots.filter(s => recentlyWorn.has(s.article._id)).length
    * RECENCY_PENALTY_PER_SLOT;

  const raw =
    fabric     * WEIGHTS.fabric  +
    color      * WEIGHTS.color   +
    style      * WEIGHTS.style   +
    simplicity * WEIGHTS.simplicity +
    preference * WEIGHTS.preference
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
  raining: boolean,
  humidity: number,
  humidityThreshold: number,
): ClothingArticle[] =>
  [...articles]
    .sort((a, b) =>
      fabricScore(b, bucket, raining, humidity, humidityThreshold) -
      fabricScore(a, bucket, raining, humidity, humidityThreshold)
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
  recentlyWorn: Set<string> = new Set(),
  topK:         number      = 3,
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
  const feelsLikeF = weather.RealFeelTemperature.Imperial.Value;
  const raining    = weather.HasPrecipitation;
  const humidity   = weather.RelativeHumidity;
  const bucket     = getWeatherBucket(feelsLikeF, settings.hiTempThreshold, settings.lowTempThreshold);

  // ── Phase 1: Hard filter → role bucketing → pre-rank per bucket ───────────
  const byRole = new Map<OutfitRole, ClothingArticle[]>();
  for (const a of articles) {
    if (!isWeatherAppropriate(a, bucket)) continue;
    const r = roleOf(a);
    if (!byRole.has(r)) byRole.set(r, []);
    byRole.get(r)!.push(a);
  }

  const cap = (role: OutfitRole) =>
    topNByFabric(byRole.get(role) ?? [], bucket, raining, humidity, settings.humidityPreference);

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

  // One accessory slot, optional
  const accOptions: (ClothingArticle | null)[] = [null, ...accessories.slice(0, 4)];

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

          scored.push(scoreCombo(slots, bucket, raining, humidity, settings, recentlyWorn));
        }
      }
    }
  }

  // ── Phase 4: Sort → deduplicate → take top-K ─────────────────────────────
  scored.sort((a, b) => b.score - a.score);

  const seen    = new Set<string>();
  const topList: ScoredCombo[] = [];

  for (const combo of scored) {
    // Dedup key: sorted article IDs (order-independent)
    const key = combo.slots.map(s => s.article._id).sort().join('|');
    if (!seen.has(key)) {
      seen.add(key);
      topList.push(combo);
      if (topList.length >= topK) break;
    }
  }

  // ── Phase 5: Attach notes and build OutfitResult[] ───────────────────────

  const buildNotes = (slots: OutfitSlot[]): string[] => {
    const notes: string[] = [];
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
    if (raining) notes.push('Rain expected — waterproof layers recommended.');
    return notes;
  };

  const results: OutfitResult[] = topList.map(combo => ({
    status:         'ok',
    headline:       headline(bucket),
    slots:          combo.slots,
    notes:          buildNotes(combo.slots),
    score:          combo.score,
    scoreBreakdown: combo.breakdown,
  }));

  return { results, status: 'ok' };
};

// ─── Backwards-compatible single-result export ────────────────────────────────

export const generateOutfit = (
  articles:     ClothingArticle[],
  weather:      CurrentWeather,
  settings:     Settings,
  recentlyWorn: Set<string> = new Set(),
): OutfitResult => {
  const { results, status } = generateOutfits(articles, weather, settings, recentlyWorn, 1);
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
