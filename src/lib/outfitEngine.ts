import { ClothingArticle, CurrentWeather, Settings } from '../types';

// ─── Role definitions ─────────────────────────────────────────────────────────

export type OutfitRole = 'top' | 'bottom' | 'fullBody' | 'outerwear' | 'footwear' | 'accessory';

const ROLE_MAP: Record<string, OutfitRole> = {
  'Shirt':        'top',     'T-Shirt':   'top',     'Blouse':   'top',
  'Sweater':      'top',     'Hoodie':    'top',
  'Jacket':       'outerwear','Coat':     'outerwear',
  'Pants':        'bottom',  'Jeans':     'bottom',  'Shorts':   'bottom',
  'Skirt':        'bottom',
  'Dress':        'fullBody',
  'Shoes':        'footwear','Sneakers':  'footwear','Boots':    'footwear',
  'Sandals':      'footwear',
  'Hat':          'accessory','Cap':      'accessory','Scarf':   'accessory',
  'Gloves':       'accessory','Belt':     'accessory','Bag':     'accessory',
  'Watch':        'accessory','Jewelry':  'accessory','Socks':   'accessory',
};

const roleOf = (a: ClothingArticle): OutfitRole =>
  ROLE_MAP[a.clothingType] ?? (a.isAccessory ? 'accessory' : 'top');

// ─── Weather scoring ──────────────────────────────────────────────────────────
// Returns a score 0–10 for how appropriate an article is given the weather.
// Higher = more appropriate.

const warmTypes  = new Set(['Coat', 'Jacket', 'Sweater', 'Hoodie', 'Boots', 'Scarf', 'Gloves']);
const lightTypes = new Set(['T-Shirt', 'Shorts', 'Sandals', 'Blouse']);
const rainTypes  = new Set(['Boots', 'Coat', 'Jacket']);
const warmFabrics = new Set(['Wool', 'Fleece', 'Synthetic']);
const lightFabrics = new Set(['Cotton', 'Linen', 'Silk']);

type WeatherBucket = 'hot' | 'warm' | 'cool' | 'cold' | 'freezing';

const bucket = (tempF: number, hi: number, lo: number): WeatherBucket => {
  if (tempF >= hi)         return 'hot';
  if (tempF >= lo)         return 'warm';
  if (tempF >= lo - 15)    return 'cool';
  if (tempF >= 32)         return 'cold';
  return 'freezing';
};

const weatherScore = (a: ClothingArticle, w: CurrentWeather, settings: Settings): number => {
  const tempF   = w.Temperature.Imperial.Value;
  const raining = w.HasPrecipitation;
  const b       = bucket(tempF, settings.hiTempThreshold, settings.lowTempThreshold);
  let score = 5;

  // Warmth appropriateness
  if (b === 'hot' || b === 'warm') {
    if (lightTypes.has(a.clothingType))  score += 2;
    if (warmTypes.has(a.clothingType))   score -= 2;
    if (a.fabricType && lightFabrics.has(a.fabricType)) score += 1;
    if (a.fabricType && warmFabrics.has(a.fabricType))  score -= 1;
  } else if (b === 'cold' || b === 'freezing') {
    if (warmTypes.has(a.clothingType))   score += 2;
    if (lightTypes.has(a.clothingType))  score -= 2;
    if (a.fabricType && warmFabrics.has(a.fabricType))  score += 1;
    if (a.fabricType && lightFabrics.has(a.fabricType)) score -= 1;
  }

  // Rain appropriateness
  if (raining && rainTypes.has(a.clothingType)) score += 2;

  return Math.max(0, Math.min(10, score));
};

// ─── Slot picking ─────────────────────────────────────────────────────────────

const best = (
  candidates: ClothingArticle[],
  w: CurrentWeather,
  settings: Settings,
): ClothingArticle =>
  candidates.reduce((a, b) =>
    weatherScore(b, w, settings) > weatherScore(a, w, settings) ? b : a
  );

// ─── Result types ─────────────────────────────────────────────────────────────

export interface OutfitSlot {
  role:    OutfitRole;
  article: ClothingArticle;
}

export type OutfitStatus =
  | 'ok'
  | 'no_closet'
  | 'no_preferred'
  | 'empty_closet'
  | 'insufficient';

export interface OutfitResult {
  status:   OutfitStatus;
  headline: string;
  slots:    OutfitSlot[];
  notes:    string[];
}

// ─── Main engine function ─────────────────────────────────────────────────────

export const generateOutfit = (
  articles: ClothingArticle[],
  weather:  CurrentWeather,
  settings: Settings,
): OutfitResult => {
  if (articles.length === 0) {
    return { status: 'empty_closet', headline: '', slots: [], notes: [] };
  }

  const byRole = new Map<OutfitRole, ClothingArticle[]>();
  for (const a of articles) {
    const r = roleOf(a);
    if (!byRole.has(r)) byRole.set(r, []);
    byRole.get(r)!.push(a);
  }

  const slots: OutfitSlot[] = [];
  const notes: string[] = [];

  const tempF   = weather.Temperature.Imperial.Value;
  const raining = weather.HasPrecipitation;
  const b       = bucket(tempF, settings.hiTempThreshold, settings.lowTempThreshold);

  // ── Core: full-body OR top + bottom ────────────────────────────────────────
  const fullBodyOptions = byRole.get('fullBody') ?? [];
  const topOptions      = byRole.get('top')      ?? [];
  const bottomOptions   = byRole.get('bottom')   ?? [];

  const useFullBody = fullBodyOptions.length > 0 &&
    (topOptions.length === 0 || bottomOptions.length === 0 ||
      // prefer dress/jumpsuit in hot weather sometimes
      (b === 'hot' && Math.random() > 0.5));

  if (useFullBody) {
    slots.push({ role: 'fullBody', article: best(fullBodyOptions, weather, settings) });
  } else {
    if (topOptions.length > 0) {
      slots.push({ role: 'top', article: best(topOptions, weather, settings) });
    }
    if (bottomOptions.length > 0) {
      slots.push({ role: 'bottom', article: best(bottomOptions, weather, settings) });
    }
  }

  // Check we have enough for a real outfit
  const hasCore = slots.some(s => s.role === 'fullBody' || s.role === 'top') &&
    (slots.some(s => s.role === 'fullBody' || s.role === 'bottom'));

  if (!hasCore) {
    return { status: 'insufficient', headline: '', slots, notes: [] };
  }

  // ── Outerwear: required when cool/cold/freezing ────────────────────────────
  const outerwearOptions = byRole.get('outerwear') ?? [];
  if (b === 'cool' || b === 'cold' || b === 'freezing') {
    if (outerwearOptions.length > 0) {
      slots.push({ role: 'outerwear', article: best(outerwearOptions, weather, settings) });
    } else {
      notes.push(b === 'freezing' || b === 'cold'
        ? 'No coat in your closet — add one for cold days.'
        : 'A light jacket would work well today.');
    }
  } else if (raining && outerwearOptions.length > 0) {
    slots.push({ role: 'outerwear', article: best(outerwearOptions, weather, settings) });
  }

  // ── Footwear ───────────────────────────────────────────────────────────────
  const footwearOptions = byRole.get('footwear') ?? [];
  if (footwearOptions.length > 0) {
    slots.push({ role: 'footwear', article: best(footwearOptions, weather, settings) });
  } else {
    notes.push('No footwear in your closet yet.');
  }

  // ── Accessories: one if available ─────────────────────────────────────────
  const accessoryOptions = byRole.get('accessory') ?? [];
  if (accessoryOptions.length > 0) {
    // Prefer weather-relevant accessories
    const weatherAccessories = accessoryOptions.filter(a =>
      (raining && (a.clothingType === 'Hat' || a.clothingType === 'Cap')) ||
      ((b === 'cold' || b === 'freezing') && (a.clothingType === 'Scarf' || a.clothingType === 'Gloves'))
    );
    const pick = weatherAccessories.length > 0
      ? best(weatherAccessories, weather, settings)
      : best(accessoryOptions, weather, settings);
    slots.push({ role: 'accessory', article: pick });
  }

  // ── Headline ───────────────────────────────────────────────────────────────
  const headline =
    b === 'hot'      ? "It's hot — keep it light." :
    b === 'warm'     ? "Nice out — here's what works." :
    b === 'cool'     ? "A bit cool — layer up." :
    b === 'cold'     ? "Bundle up today." :
    "Dress warm — it's freezing.";

  if (raining) notes.push('Rain expected — waterproof layers recommended.');

  return { status: 'ok', headline, slots, notes };
};

// ─── Headline for weather (used by fallback mode) ─────────────────────────────
export const weatherHeadline = (weather: CurrentWeather, settings: Settings): string => {
  const b = bucket(
    weather.Temperature.Imperial.Value,
    settings.hiTempThreshold,
    settings.lowTempThreshold,
  );
  return b === 'hot' ? "It's hot out there." :
    b === 'warm'     ? "Nice weather today." :
    b === 'cool'     ? "A bit cool — layer up." :
    b === 'cold'     ? "Bundle up." :
    "Dress warm — it's freezing.";
};
