/**
 * layeringEngine.ts
 * -----------------
 * Layering Intelligence Engine — extends outfitEngine with layer-aware reasoning.
 *
 * Architecture:
 *  1. Layer extraction      — maps OutfitRole to base / mid / outer
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

import { ClothingArticle, CurrentWeather, Forecast, Settings } from '../types';
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

// ─── 1. Layer extraction ──────────────────────────────────────────────────────
// Reads the role already assigned by outfitEngine — no separate clothingType
// lookup needed. This keeps the two engines in sync: any new type that
// outfitEngine classifies as 'midLayer' or 'outerwear' is automatically
// recognised here without needing a parallel LAYER_OF table update.

/**
 * Pulls the first base, mid, and outer slot from an outfit using the role
 * already assigned by outfitEngine. Bottoms, footwear, and accessories are
 * layer-neutral and ignored here.
 */
const extractLayers = (
  slots: OutfitSlot[],
): { base: OutfitSlot | null; mid: OutfitSlot | null; outer: OutfitSlot | null } => {
  let base:  OutfitSlot | null = null;
  let mid:   OutfitSlot | null = null;
  let outer: OutfitSlot | null = null;

  for (const slot of slots) {
    if ((slot.role === 'top' || slot.role === 'fullBody') && !base) base  = slot;
    if (slot.role === 'midLayer'  && !mid)                          mid   = slot;
    if (slot.role === 'outerwear' && !outer)                        outer = slot;
  }

  return { base, mid, outer };
};

// ─── 2. Day temperature range ─────────────────────────────────────────────────
// Derive a feels-like high/low from the hourly forecast array.
//
// The Forecast type only carries raw Temperature, but every layering decision
// downstream is made on a feels-like basis (currentTemp = RealFeel). To keep
// units consistent we apply the current feels-like offset (RealFeel - airTemp)
// to each forecast value. This is a coarse approximation — real RealFeel varies
// with humidity and solar load throughout the day — but it's far better than
// mixing raw forecast temps with feels-like current temps when computing the
// day delta.
//
// Falls back to currentFeelsLike when no forecasts are available, producing a
// zero delta and suppressing timeline output gracefully.

const deriveDayRange = (
  forecasts:        Forecast[],
  currentAirTemp:   number,
  currentFeelsLike: number,
): { high: number; low: number; offset: number } => {
  const offset = currentFeelsLike - currentAirTemp;
  if (forecasts.length === 0) {
    return { high: currentFeelsLike, low: currentFeelsLike, offset };
  }
  const feelsTemps = forecasts.map(f => f.Temperature.Value + offset);
  return { high: Math.max(...feelsTemps), low: Math.min(...feelsTemps), offset };
};

// ─── 3. Layer necessity scoring ───────────────────────────────────────────────
// Flexible signal-based decisions — avoids hardcoded "cold = 3 layers" rules.
// Wind chill is computed using the NWS formula so that 50°F + 25 mph wind
// correctly triggers outer layer necessity (effective temp ≈ 43°F).

/**
 * NWS Wind Chill formula (valid for temps ≤ 50°F and wind ≥ 3 mph).
 * Returns effective temperature accounting for wind exposure.
 * Above 50°F or below 3 mph wind, returns raw temp (wind chill not applicable).
 */
const windChill = (tempF: number, windMph: number): number => {
  if (tempF > 50 || windMph < 3) return tempF;
  return 35.74 + 0.6215 * tempF - 35.75 * Math.pow(windMph, 0.16) + 0.4275 * tempF * Math.pow(windMph, 0.16);
};

const layerNeedsMid = (currentTemp: number, tempDelta: number, windSpeed: number, threshold: number): boolean => {
  const effective = windChill(currentTemp, windSpeed);
  return effective < threshold || tempDelta > 10;
};

const layerNeedsOuter = (currentTemp: number, windSpeed: number, threshold: number): boolean => {
  const effective = windChill(currentTemp, windSpeed);
  return effective < threshold || windSpeed > 10;
};

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
// Generates event-driven action steps based on:
//   a) Temperature inflection points (warming/cooling beyond thresholds)
//   b) Precipitation transitions (rain starting/stopping)
// Produces up to 5 steps for a highly variable day. Returns undefined on flat,
// dry days — callers treat undefined as "no timeline".

const MEANINGFUL_DELTA_F = 10;
const TEMP_SHED_THRESHOLD = 68;   // above this, recommend removing outer
const TEMP_COLD_THRESHOLD = 58;   // below this, recommend keeping layers
const TEMP_RELAYER_THRESHOLD = 62; // below this in evening, re-layer

/** Formats hour (0–23) as human-readable time label. */
const hourLabel = (h: number): string => {
  if (h < 6)  return 'Early morning';
  if (h < 10) return 'Morning';
  if (h < 12) return 'Late morning';
  if (h < 14) return 'Early afternoon';
  if (h < 17) return 'Afternoon';
  if (h < 20) return 'Evening';
  return 'Night';
};

/**
 * Estimates sunset hour from forecast IsDaylight transitions.
 * Finds the last forecast hour marked as daylight — sunset follows.
 * Falls back to a seasonal approximation if no IsDaylight data is available.
 */
const estimateSunsetHour = (forecasts: Forecast[]): number => {
  // Find the transition from IsDaylight=true → false
  let lastDaylightHour = -1;
  for (const f of forecasts) {
    if (f.IsDaylight) {
      lastDaylightHour = new Date(f.DateTime).getHours();
    }
  }
  if (lastDaylightHour >= 0) return lastDaylightHour;

  // Seasonal fallback (Northern Hemisphere approximation):
  // Summer sunset ~20:30, Winter sunset ~17:00, Spring/Fall ~18:30
  const month = new Date().getMonth();
  if (month >= 5 && month <= 7) return 20;  // Jun–Aug
  if (month >= 11 || month <= 1) return 17; // Dec–Feb
  return 18; // Mar–May, Sep–Nov
};

/** Detects precipitation transitions in the forecast. */
const detectPrecipTransitions = (forecasts: Forecast[]): { hour: number; starting: boolean }[] => {
  const transitions: { hour: number; starting: boolean }[] = [];
  // Check IconPhrase for rain/snow keywords
  const isWet = (phrase: string) => /rain|shower|storm|snow|sleet|drizzle/i.test(phrase);

  let prevWet = false;
  for (const f of forecasts) {
    const wet = isWet(f.IconPhrase);
    if (wet && !prevWet) {
      transitions.push({ hour: new Date(f.DateTime).getHours(), starting: true });
    } else if (!wet && prevWet) {
      transitions.push({ hour: new Date(f.DateTime).getHours(), starting: false });
    }
    prevWet = wet;
  }
  return transitions;
};

const buildTimeline = (
  forecasts:    Forecast[],
  mid:          OutfitSlot | null,
  outer:        OutfitSlot | null,
  high:         number,
  low:          number,
  feelsOffset:  number,
): { time: string; action: string }[] | undefined => {
  if ((!mid && !outer) || forecasts.length === 0) return undefined;

  const hasTempSwing = high - low >= MEANINGFUL_DELTA_F;
  const precipTransitions = detectPrecipTransitions(forecasts);

  // If no temperature swing AND no precipitation transitions, no timeline needed
  if (!hasTempSwing && precipTransitions.length === 0) return undefined;

  const primaryLayer = outer ?? mid;
  const primaryName  = primaryLayer!.article.name || primaryLayer!.article.clothingType;
  const outerName    = outer?.article.name || outer?.article.clothingType;

  const steps: { time: string; action: string }[] = [];

  // ── Temperature-based steps (sunset-aware) ──────────────────────────────────
  // Uses actual sunset detection from IsDaylight forecast data to determine when
  // evening cool-down starts, rather than a fixed 17:00 assumption.
  if (hasTempSwing) {
    const sunsetHour = estimateSunsetHour(forecasts);

    let shedStep: { time: string; action: string } | null = null;
    let relayerStep: { time: string; action: string } | null = null;
    let peakReached = false;

    for (const f of forecasts) {
      const h = new Date(f.DateTime).getHours();
      const temp = f.Temperature.Value + feelsOffset;

      if (!peakReached && temp >= TEMP_SHED_THRESHOLD && outer) {
        shedStep = { time: hourLabel(h), action: `Remove ${outerName} — warming up` };
        peakReached = true;
      } else if (peakReached && !relayerStep) {
        // Trigger re-layer when BOTH conditions are met:
        // 1. Temperature drops below threshold
        // 2. We're at or past sunset (cooling will accelerate)
        const pastSunset = h >= sunsetHour - 1; // 1 hour before sunset, cooling begins
        if (temp < TEMP_RELAYER_THRESHOLD && pastSunset) {
          relayerStep = { time: hourLabel(h), action: `Add ${primaryName} back — sun is setting, cooling down` };
        } else if (temp < TEMP_RELAYER_THRESHOLD - 5) {
          // Hard fallback: if it drops significantly regardless of sunset
          relayerStep = { time: hourLabel(h), action: `Add ${primaryName} back — cooling down` };
        }
      }
    }

    // Morning cold check
    const firstTemp = forecasts[0] ? forecasts[0].Temperature.Value + feelsOffset : null;
    if (firstTemp !== null && firstTemp < TEMP_COLD_THRESHOLD) {
      steps.push({ time: hourLabel(new Date(forecasts[0].DateTime).getHours()), action: `Keep your ${primaryName} on` });
    }

    if (shedStep) steps.push(shedStep);
    if (relayerStep) steps.push(relayerStep);
  }

  // ── Precipitation-based steps ──────────────────────────────────────────────
  for (const t of precipTransitions) {
    if (t.starting) {
      const layerName = outerName ?? primaryName;
      steps.push({ time: hourLabel(t.hour), action: `Rain starts — keep ${layerName} on` });
    } else {
      steps.push({ time: hourLabel(t.hour), action: `Rain clears — safe to shed layers` });
    }
  }

  // Cap at 5 steps, sorted by approximate chronological order
  const ORDER = ['Early morning', 'Morning', 'Late morning', 'Early afternoon', 'Afternoon', 'Evening', 'Night'];
  steps.sort((a, b) => ORDER.indexOf(a.time) - ORDER.indexOf(b.time));

  return steps.length > 0 ? steps.slice(0, 5) : undefined;
};

// ─── 6. Natural language recommendation ───────────────────────────────────────
// Sentence varies based on which layers are active and whether a timeline exists.

const buildRecommendation = (
  base:              OutfitSlot | null,
  mid:               OutfitSlot | null,   // weather-needed mid, or null
  outer:             OutfitSlot | null,   // weather-needed outer, or null
  currentTemp:       number,
  hasTimeline:       boolean,
  missingMid:        boolean,
  missingOuter:      boolean,
  raining:           boolean,
  midHardToRemove:   boolean = false,
  outerHardToRemove: boolean = false,
  extraMid:          OutfitSlot | null = null,   // present in outfit but not needed
  extraOuter:        OutfitSlot | null = null,   // present in outfit but not needed
): string => {
  const baseName  = base?.article.name  || base?.article.clothingType  || 'base layer';
  const midName   = mid?.article.name   || mid?.article.clothingType;
  const outerName = outer?.article.name || outer?.article.clothingType;

  // Removability caveat appended when a layer is bulky / hard to shed
  const midCaveat   = midHardToRemove   ? ` Note: your ${midName} is bulky to carry — plan around it.` : '';
  const outerCaveat = outerHardToRemove ? ` Your ${outerName} is heavy to carry if you shed it — commit to wearing it or leave it.` : '';

  // ── Extra layers (in outfit but not strictly needed by weather) ──────────
  // Acknowledge their presence with a light note instead of ignoring them.
  if (!mid && !outer && (extraMid || extraOuter)) {
    const extraMidName   = extraMid?.article.name   || extraMid?.article.clothingType;
    const extraOuterName = extraOuter?.article.name || extraOuter?.article.clothingType;

    if (extraMid && extraOuter) {
      return `You probably won't need the ${extraMidName} or ${extraOuterName} today, but they're easy to shed if you want the extra comfort.`;
    }
    if (extraOuter) {
      return `Your ${baseName} should be enough today — the ${extraOuterName} is there if you run cold or it gets breezy.`;
    }
    // extraMid only
    return `Your ${baseName} is fine on its own for ${currentTemp}°F — the ${extraMidName} is a nice-to-have if you get chilly.`;
  }

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
    if (hasTimeline) {
      return `Start with your ${midName} over the ${baseName}, then add the ${outerName} for cooler moments. You can drop the ${outerName} as the day warms up.${rainSuffix}${outerCaveat}${midCaveat}`;
    }
    return `Layer your ${midName} over the ${baseName} with the ${outerName} on top for full coverage.${rainSuffix}${outerCaveat}${midCaveat}`;
  }

  // Outer only (mid not needed)
  if (outer && !mid) {
    const rainNote = raining ? ` Rain is expected — keep the ${outerName} on.` : '';
    if (hasTimeline) {
      return outerHardToRemove
        ? `The ${outerName} is the right call today, but it's heavy to stow — you may want to commit to it all day.${rainNote}`
        : `The ${outerName} will be welcome this morning — feel free to shed it once temperatures climb.${rainNote}`;
    }
    return `A ${outerName} over your ${baseName} is the right call for today.${rainNote}${outerCaveat}`;
  }

  // Mid only (outer not needed)
  if (mid && !outer) {
    const rainWarning = raining
      ? ` Rain is in the forecast though — consider grabbing a water-resistant layer too.`
      : '';
    if (hasTimeline) {
      return midHardToRemove
        ? `Your ${midName} suits the morning chill, but it's bulky to carry later — plan your day around it.${rainWarning}`
        : `Your ${midName} is a smart pick for the morning chill — easy to remove as the day heats up.${rainWarning}`;
    }
    return `Keep your ${midName} handy — it suits today's temperature without being too heavy.${rainWarning}${midCaveat}`;
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

/**
 * Weather-derived context computed once per weather snapshot.
 * Hoist this outside any per-outfit loop — deriveDayRange, rainForecast, and
 * necessity scoring all depend only on weather + forecasts + settings, not
 * on the specific slots in each outfit candidate.
 */
export interface LayeringContext {
  forecasts:    Forecast[];  // passed through so buildTimeline can scan them per-outfit
  currentTemp:  number;
  windSpeed:    number;
  raining:      boolean;
  rainForecast: boolean;
  high:         number;
  low:          number;
  offset:       number;     // feels-like correction applied to forecast temps
  tempDelta:    number;
  needsMid:     boolean;
  needsOuter:   boolean;
}

/**
 * Computes all weather-dependent values that are constant across outfit candidates.
 * Call once, then pass the result to generateLayeringRecommendation for each outfit.
 *
 * Layer thresholds are derived from user settings so someone who runs warm
 * (lowTempThreshold = 70°F) gets layering advice calibrated to their preference.
 * The 15°F offset for outerThreshold mirrors getWeatherBucket's cool→cold boundary.
 */
export const buildLayeringContext = ({
  weather,
  forecasts,
  settings,
}: {
  weather:   CurrentWeather;
  forecasts: Forecast[];
  settings:  Settings;
}): LayeringContext => {
  const currentTemp    = weather.RealFeelTemperature.Imperial.Value;
  const currentAirTemp = weather.Temperature.Imperial.Value;
  const windSpeed      = weather.Wind.Speed.Imperial.Value;
  const raining        = weather.HasPrecipitation;

  const rainForecast = forecasts.some(f =>
    /rain|shower|storm|drizzle|sleet/i.test(f.IconPhrase),
  );

  const { high, low, offset } = deriveDayRange(forecasts, currentAirTemp, currentTemp);
  const tempDelta = high - low;

  const midThreshold   = settings.lowTempThreshold;       // below "warm" → mid layer
  const outerThreshold = settings.lowTempThreshold - 15;  // below "cool" → outer layer

  return {
    forecasts,
    currentTemp, windSpeed, raining, rainForecast,
    high, low, offset, tempDelta,
    needsMid:   layerNeedsMid(currentTemp, tempDelta, windSpeed, midThreshold),
    needsOuter: layerNeedsOuter(currentTemp, windSpeed, outerThreshold) || raining || rainForecast,
  };
};

/**
 * Generates a layering recommendation for one outfit candidate.
 * Accepts a pre-built LayeringContext so weather-dependent work is not repeated
 * for every outfit in the top-K list.
 */
export const generateLayeringRecommendation = ({
  context,
  slots,
}: {
  context: LayeringContext;
  slots:   OutfitSlot[];
}): LayeringResult => {
  const {
    forecasts,
    currentTemp, windSpeed, raining, rainForecast,
    high, low, offset, tempDelta,
    needsMid, needsOuter,
  } = context;

  const rainContext = raining || rainForecast;

  const { base, mid, outer } = extractLayers(slots);

  // Removability affects recommendation text only — layers are never silently
  // dropped. A heavy leather coat still gets recommended in freezing weather;
  // the text and confidence just acknowledge it's not easily shed mid-day.
  const midRemovability   = mid   ? removabilityOf(mid.article)   : 0;
  const outerRemovability = outer ? removabilityOf(outer.article) : 0;

  // Layers the weather actually calls for — used for timeline and text tone
  const activeMid:   OutfitSlot | null = mid   && needsMid   ? mid   : null;
  const activeOuter: OutfitSlot | null = outer && needsOuter ? outer : null;

  const midHardToRemove   = activeMid   && midRemovability   < 0.45;
  const outerHardToRemove = activeOuter && outerRemovability < 0.35;

  // Layers that conditions call for but the outfit doesn't have (wardrobe gap)
  const missingMid   = needsMid   && !mid;
  const missingOuter = needsOuter && !outer;

  // Layers present in the outfit but not strictly needed by weather
  const extraMid   = mid   && !needsMid;
  const extraOuter = outer && !needsOuter;

  const timeline = buildTimeline(forecasts, activeMid, activeOuter, high, low, offset);

  const removabilityPenalty =
    (midHardToRemove   && tempDelta > 10 ? 0.08 : 0) +
    (outerHardToRemove && tempDelta > 10 ? 0.08 : 0);

  return {
    // Always report the actual layers present in the outfit so the UI stays
    // consistent with the outfit card above. Necessity flags shape the
    // recommendation text and timeline, not the layer visibility.
    layers:         { base, mid, outer },
    recommendation: buildRecommendation(base, activeMid, activeOuter, currentTemp, !!timeline, missingMid, missingOuter, rainContext, !!midHardToRemove, !!outerHardToRemove, extraMid ? mid : null, extraOuter ? outer : null),
    timeline,
    confidence:     Math.max(0, computeConfidence(currentTemp, tempDelta, windSpeed, !!activeMid, !!activeOuter) - removabilityPenalty),
  };
};
