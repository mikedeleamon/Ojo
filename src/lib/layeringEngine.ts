/**
 * layeringEngine.ts
 * -----------------
 * Layering Intelligence Engine — extends outfitEngine with layer-aware reasoning.
 *
 * Architecture:
 *  1. Layer classification  — maps clothingType to base / mid / outer
 *  2. Day range derivation  — extracts real high/low from hourly Forecast[]
 *  3. Layer necessity       — signal-based scoring (no hardcoded cold = 3 layers)
 *  4. Removability scoring  — heuristic from clothingType + fabricType
 *  5. Timeline builder      — morning/afternoon/evening steps on variable days
 *  6. Recommendation text   — natural language, context-aware
 *  7. Confidence score      — 0–1 based on weather clarity and layer coverage
 *
 * Constraints:
 *  - Pure functions only — no side effects, no closet access
 *  - Operates on slots already chosen by outfitEngine; never re-selects items
 *  - Gracefully degrades when metadata (fabricType, forecasts) is absent
 */

import { ClothingArticle, CurrentWeather, Forecast } from '../types';
import { OutfitSlot } from './outfitEngine';

// ─── Public output type ───────────────────────────────────────────────────────

export interface LayeringResult {
  layers: {
    base:  OutfitSlot | null;
    mid:   OutfitSlot | null;
    outer: OutfitSlot | null;
  };
  recommendation: string;
  timeline?: { time: string; action: string }[];
  confidence: number; // 0–1
}

// ─── 1. Layer classification ──────────────────────────────────────────────────
// Hoodie and Sweater are intentionally mid, not base — they insulate on top of
// a shirt rather than serving as the primary skin-contact layer.

type LayerCategory = 'base' | 'mid' | 'outer';

const LAYER_OF: Record<string, LayerCategory> = {
  // Base — primary coverage worn closest to skin
  Shirt:   'base',
  'T-Shirt': 'base',
  Blouse:  'base',
  Dress:   'base',
  // Mid — insulating layer, easy to add or remove
  Sweater: 'mid',
  Hoodie:  'mid',
  // Outer — protective shell
  Jacket:  'outer',
  Coat:    'outer',
};

const layerOf = (article: ClothingArticle): LayerCategory | null =>
  LAYER_OF[article.clothingType] ?? null;

/**
 * Pulls the first base, mid, and outer slot from an outfit.
 * Bottoms, footwear, and accessories are layer-neutral and ignored here.
 */
const extractLayers = (
  slots: OutfitSlot[],
): { base: OutfitSlot | null; mid: OutfitSlot | null; outer: OutfitSlot | null } => {
  let base:  OutfitSlot | null = null;
  let mid:   OutfitSlot | null = null;
  let outer: OutfitSlot | null = null;

  for (const slot of slots) {
    const layer = layerOf(slot.article);
    if (layer === 'base'  && !base)  base  = slot;
    if (layer === 'mid'   && !mid)   mid   = slot;
    if (layer === 'outer' && !outer) outer = slot;
  }

  return { base, mid, outer };
};

// ─── 2. Day temperature range ─────────────────────────────────────────────────
// Derive real high and low from the hourly forecast array.
// Falls back to the current feels-like temp when no forecasts are available,
// which produces a zero delta — suppressing timeline output gracefully.

const deriveDayRange = (
  forecasts:    Forecast[],
  fallbackTemp: number,
): { high: number; low: number } => {
  if (forecasts.length === 0) return { high: fallbackTemp, low: fallbackTemp };
  const temps = forecasts.map(f => f.Temperature.Value);
  return { high: Math.max(...temps), low: Math.min(...temps) };
};

// ─── 3. Layer necessity scoring ───────────────────────────────────────────────
// Flexible signal-based decisions — avoids hardcoded "cold = 3 layers" rules.

const layerNeedsMid = (currentTemp: number, tempDelta: number): boolean =>
  currentTemp < 65 || tempDelta > 10;

const layerNeedsOuter = (currentTemp: number, windSpeed: number): boolean =>
  currentTemp < 50 || windSpeed > 10;

// ─── 4. Removability scoring ──────────────────────────────────────────────────
// 0–1 score. Higher = the item is easy to shed mid-day.
// Scores are additive from type and fabric signals, clamped to [0, 1].
// Gracefully degrades if fabricType is absent.

const removabilityOf = (article: ClothingArticle): number => {
  let score = 0.50;

  // Clothing type signals
  if (article.clothingType === 'Hoodie')  score += 0.30; // pullover, casual, lightweight
  if (article.clothingType === 'Jacket')  score += 0.25; // zip/button — easy to carry
  if (article.clothingType === 'Sweater') score += 0.10; // slightly less convenient
  if (article.clothingType === 'Coat')    score -= 0.20; // bulkier, less likely to stow

  // Fabric signals — lightweight/synthetic fabrics are easier to pack and carry
  const fabric = article.fabricType ?? '';
  if (['Synthetic', 'Polyester', 'Fleece'].includes(fabric)) score += 0.10;
  if (['Wool', 'Leather'].includes(fabric))                  score -= 0.10;

  return Math.max(0, Math.min(1, score));
};

// ─── 5. Timeline builder ──────────────────────────────────────────────────────
// Generates morning / afternoon / evening action steps.
// Only fires when the day has meaningful temperature variation (>= 10 °F swing).
// Returns undefined on flat days — callers treat undefined as "no timeline".

const MEANINGFUL_DELTA_F = 10;

const buildTimeline = (
  forecasts: Forecast[],
  mid:       OutfitSlot | null,
  outer:     OutfitSlot | null,
  high:      number,
  low:       number,
): { time: string; action: string }[] | undefined => {
  if ((!mid && !outer) || forecasts.length === 0) return undefined;
  if (high - low < MEANINGFUL_DELTA_F) return undefined;

  // Sample one representative reading per time-of-day window
  const tempAt = (fromH: number, toH: number): number | null => {
    const match = forecasts.find(f => {
      const h = new Date(f.DateTime).getHours();
      return h >= fromH && h <= toH;
    });
    return match?.Temperature.Value ?? null;
  };

  const morningTemp   = tempAt(6,  10);
  const afternoonTemp = tempAt(12, 16);
  const eveningTemp   = tempAt(17, 21);

  const primaryLayer = outer ?? mid;
  const primaryName  = primaryLayer!.article.name || primaryLayer!.article.clothingType;
  const outerName    = outer?.article.name || outer?.article.clothingType;

  const steps: { time: string; action: string }[] = [];

  // Morning — typically coolest; keep layers on
  if (morningTemp !== null && morningTemp < 58) {
    steps.push({ time: 'Morning', action: `Keep your ${primaryName} on` });
  }

  // Afternoon — peak warmth; recommend shedding
  if (afternoonTemp !== null) {
    if (afternoonTemp > 68 && outer) {
      steps.push({ time: 'Afternoon', action: `Remove ${outerName}` });
    } else if (afternoonTemp > 74 && mid && !outer) {
      steps.push({ time: 'Afternoon', action: `Remove ${mid.article.name ?? mid.article.clothingType}` });
    }
  }

  // Evening — cools back down; re-layer
  if (eveningTemp !== null && eveningTemp < 62) {
    steps.push({ time: 'Evening', action: `Add ${primaryName} back` });
  }

  return steps.length > 0 ? steps : undefined;
};

// ─── 6. Natural language recommendation ───────────────────────────────────────
// Sentence varies based on which layers are active and whether a timeline exists.

const buildRecommendation = (
  base:         OutfitSlot | null,
  mid:          OutfitSlot | null,
  outer:        OutfitSlot | null,
  currentTemp:  number,
  hasTimeline:  boolean,
  missingMid:   boolean,
  missingOuter: boolean,
  raining:      boolean,
): string => {
  const baseName  = base?.article.name  || base?.article.clothingType  || 'base layer';
  const midName   = mid?.article.name   || mid?.article.clothingType;
  const outerName = outer?.article.name || outer?.article.clothingType;

  // Single layer — check whether layers are needed but absent before calling it fine
  if (!mid && !outer) {
    if (missingOuter && raining)
      return `Your ${baseName} alone won't hold up today — a waterproof outer layer is strongly recommended for the rain and chill.`;
    if (missingOuter)
      return `Your ${baseName} may be too light for ${currentTemp}°F — a jacket would make a real difference today.`;
    if (missingMid && raining)
      return `Your ${baseName} is light for these conditions — a mid layer and something water-resistant would keep you comfortable.`;
    if (missingMid)
      return `Your ${baseName} may feel a bit cool — a mid layer over top would help for ${currentTemp}°F.`;
    return currentTemp > 70
      ? `Your ${baseName} is all you need today — the weather is comfortable enough to keep it simple.`
      : `Your ${baseName} works well on its own for these conditions.`;
  }

  // Full three-layer stack
  if (mid && outer) {
    const rainSuffix = raining ? ` Make sure the ${outerName} can handle rain.` : '';
    return hasTimeline
      ? `Start with your ${midName} over the ${baseName}, then add the ${outerName} for cooler moments. You can drop the ${outerName} as the day warms up.${rainSuffix}`
      : `Layer your ${midName} over the ${baseName} with the ${outerName} on top for full coverage.${rainSuffix}`;
  }

  // Outer only (mid not needed)
  if (outer && !mid) {
    const rainNote = raining ? ` Rain is expected — keep the ${outerName} on.` : '';
    return hasTimeline
      ? `The ${outerName} will be welcome this morning — feel free to shed it once temperatures climb.${rainNote}`
      : `A ${outerName} over your ${baseName} is the right call for today.${rainNote}`;
  }

  // Mid only (outer not needed)
  if (mid && !outer) {
    const rainWarning = raining
      ? ` Rain is in the forecast though — consider grabbing a water-resistant layer too.`
      : '';
    return hasTimeline
      ? `Your ${midName} is a smart pick for the morning chill — easy to remove as the day heats up.${rainWarning}`
      : `Keep your ${midName} handy — it suits today's temperature without being too heavy.${rainWarning}`;
  }

  return 'Layer to your comfort based on how the day feels.';
};

// ─── 7. Confidence score ──────────────────────────────────────────────────────
// Starts at 1.0 and is discounted by factors that reduce certainty.
// High temperature extremes actually increase confidence — easier to dress for.

const computeConfidence = (
  currentTemp: number,
  tempDelta:   number,
  windSpeed:   number,
  hasMid:      boolean,
  hasOuter:    boolean,
): number => {
  let c = 1.0;

  // High day-to-day variability is harder to dress for
  if (tempDelta > 20) c -= 0.15;
  else if (tempDelta > 10) c -= 0.08;

  // Wind adds unpredictability
  if (windSpeed > 20) c -= 0.10;
  else if (windSpeed > 10) c -= 0.05;

  // Missing a recommended layer signals a closet gap — less confident output
  if (!hasMid  && currentTemp < 60) c -= 0.10;
  if (!hasOuter && currentTemp < 45) c -= 0.15;

  // Extreme temps are unambiguous — the right answer is clear
  if (currentTemp > 80 || currentTemp < 30) c += 0.05;

  return Math.max(0, Math.min(1, Math.round(c * 100) / 100));
};

// ─── Public API ───────────────────────────────────────────────────────────────

export const generateLayeringRecommendation = ({
  weather,
  forecasts,
  slots,
}: {
  weather:   CurrentWeather;
  forecasts: Forecast[];
  slots:     OutfitSlot[];
}): LayeringResult => {
  const currentTemp = weather.RealFeelTemperature.Imperial.Value;
  const windSpeed   = weather.Wind.Speed.Imperial.Value;
  const raining     = weather.HasPrecipitation;

  const { high, low } = deriveDayRange(forecasts, currentTemp);
  const tempDelta = high - low;

  const { base, mid, outer } = extractLayers(slots);

  const needsMid   = layerNeedsMid(currentTemp, tempDelta);
  const needsOuter = layerNeedsOuter(currentTemp, windSpeed) || raining;

  // Apply necessity + removability gates together.
  // An item that is needed but non-removable still surfaces — the removability
  // threshold is deliberately low (0.35 for outer) to avoid silently dropping
  // a coat on a cold day just because it's leather.
  const effectiveMid: OutfitSlot | null =
    mid && needsMid && removabilityOf(mid.article) >= 0.45
      ? mid
      : null;

  const effectiveOuter: OutfitSlot | null =
    outer && needsOuter && removabilityOf(outer.article) >= 0.35
      ? outer
      : null;

  // Layers that conditions call for but the outfit doesn't have (wardrobe gap)
  const missingMid   = needsMid   && !effectiveMid;
  const missingOuter = needsOuter && !effectiveOuter;

  const timeline = buildTimeline(forecasts, effectiveMid, effectiveOuter, high, low);

  return {
    layers:         { base, mid: effectiveMid, outer: effectiveOuter },
    recommendation: buildRecommendation(base, effectiveMid, effectiveOuter, currentTemp, !!timeline, missingMid, missingOuter, raining),
    timeline,
    confidence:     computeConfidence(currentTemp, tempDelta, windSpeed, !!effectiveMid, !!effectiveOuter),
  };
};
