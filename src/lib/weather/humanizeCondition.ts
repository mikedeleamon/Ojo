/**
 * humanizeCondition.ts
 * ────────────────────
 * Maps Apple WeatherKit `conditionCode` strings (camelCase, e.g.
 * "MostlyClear", "HeavyRain", "BlowingSnow") into display-ready strings for
 * UI surfaces (HUD, TripFit, shareables).
 *
 * Three forms are exposed:
 *
 *   humanizeCondition       sentence-case  "Mostly clear"
 *   humanizeConditionTitle  Title Case     "Mostly Clear"
 *   humanizeConditionShort  one-word chip  "Clear"
 *
 * Implementation: a small override table covers the multi-word and
 * idiomatic cases; anything not matched falls through to a generic
 * camelCase splitter so brand-new WeatherKit codes (Apple adds them from
 * time to time, e.g. `BlowingDust`) still render passably.
 *
 * Pure, dependency-free, safe to import from anywhere.
 */

// ─── Override tables ──────────────────────────────────────────────────────────
// Keyed by raw WeatherKit conditionCode. Where Apple's official list omits a
// code we keep a sensible string anyway — the cost of a stale entry is zero.

// Long form ("MostlyClear" → "Mostly clear"). Used in headlines and body copy.
const LONG: Record<string, string> = {
    Clear:                  'Clear',
    MostlyClear:            'Mostly clear',
    PartlyCloudy:           'Partly cloudy',
    MostlyCloudy:           'Mostly cloudy',
    Cloudy:                 'Cloudy',

    Foggy:                  'Foggy',
    Haze:                   'Hazy',
    Smoky:                  'Smoky',

    Breezy:                 'Breezy',
    Windy:                  'Windy',

    Drizzle:                'Drizzle',
    Rain:                   'Rain',
    HeavyRain:              'Heavy rain',
    SunShowers:             'Sun showers',
    ScatteredShowers:       'Scattered showers',

    IsolatedThunderstorms:  'Isolated thunderstorms',
    ScatteredThunderstorms: 'Scattered thunderstorms',
    Thunderstorms:          'Thunderstorms',
    StrongStorms:           'Strong storms',

    Frigid:                 'Frigid',
    Hot:                    'Hot',

    Flurries:               'Flurries',
    Snow:                   'Snow',
    HeavySnow:              'Heavy snow',
    SunFlurries:            'Sun flurries',
    Sleet:                  'Sleet',
    WintryMix:              'Wintry mix',
    Blizzard:               'Blizzard',
    BlowingSnow:            'Blowing snow',

    FreezingDrizzle:        'Freezing drizzle',
    FreezingRain:           'Freezing rain',

    Hail:                   'Hail',

    Hurricane:              'Hurricane',
    TropicalStorm:          'Tropical storm',

    // Newer / atmospheric
    BlowingDust:            'Blowing dust',
    Dust:                   'Dusty',
};

// Title case ("MostlyClear" → "Mostly Clear"). Used in HUD headers.
const TITLE: Record<string, string> = {
    Clear:                  'Clear',
    MostlyClear:            'Mostly Clear',
    PartlyCloudy:           'Partly Cloudy',
    MostlyCloudy:           'Mostly Cloudy',
    Cloudy:                 'Cloudy',

    Foggy:                  'Foggy',
    Haze:                   'Hazy',
    Smoky:                  'Smoky',

    Breezy:                 'Breezy',
    Windy:                  'Windy',

    Drizzle:                'Drizzle',
    Rain:                   'Rain',
    HeavyRain:              'Heavy Rain',
    SunShowers:             'Sun Showers',
    ScatteredShowers:       'Scattered Showers',

    IsolatedThunderstorms:  'Isolated Thunderstorms',
    ScatteredThunderstorms: 'Scattered Thunderstorms',
    Thunderstorms:          'Thunderstorms',
    StrongStorms:           'Strong Storms',

    Frigid:                 'Frigid',
    Hot:                    'Hot',

    Flurries:               'Flurries',
    Snow:                   'Snow',
    HeavySnow:              'Heavy Snow',
    SunFlurries:            'Sun Flurries',
    Sleet:                  'Sleet',
    WintryMix:              'Wintry Mix',
    Blizzard:               'Blizzard',
    BlowingSnow:            'Blowing Snow',

    FreezingDrizzle:        'Freezing Drizzle',
    FreezingRain:           'Freezing Rain',

    Hail:                   'Hail',

    Hurricane:              'Hurricane',
    TropicalStorm:          'Tropical Storm',

    BlowingDust:            'Blowing Dust',
    Dust:                   'Dusty',
};

// One-word form for compact UI (chips, badges, footer pills). Codes that
// fundamentally describe the same atmospheric state collapse to one word.
const SHORT: Record<string, string> = {
    Clear:                  'Clear',
    MostlyClear:            'Clear',
    PartlyCloudy:           'Cloudy',
    MostlyCloudy:           'Cloudy',
    Cloudy:                 'Cloudy',

    Foggy:                  'Fog',
    Haze:                   'Hazy',
    Smoky:                  'Smoky',

    Breezy:                 'Breezy',
    Windy:                  'Windy',

    Drizzle:                'Drizzle',
    Rain:                   'Rain',
    HeavyRain:              'Rain',
    SunShowers:             'Rain',
    ScatteredShowers:       'Rain',

    IsolatedThunderstorms:  'Storms',
    ScatteredThunderstorms: 'Storms',
    Thunderstorms:          'Storms',
    StrongStorms:           'Storms',

    Frigid:                 'Frigid',
    Hot:                    'Hot',

    Flurries:               'Snow',
    Snow:                   'Snow',
    HeavySnow:              'Snow',
    SunFlurries:            'Snow',
    Sleet:                  'Sleet',
    WintryMix:              'Wintry',
    Blizzard:               'Blizzard',
    BlowingSnow:            'Snow',

    FreezingDrizzle:        'Ice',
    FreezingRain:           'Ice',

    Hail:                   'Hail',

    Hurricane:              'Hurricane',
    TropicalStorm:          'Storm',

    BlowingDust:            'Dust',
    Dust:                   'Dust',
};

// ─── Generic fallback ────────────────────────────────────────────────────────
// Used for unknown WeatherKit codes Apple may add. Splits the camelCase /
// PascalCase identifier on capital boundaries and lowercases / titlecases
// per the chosen form.

const splitCamel = (code: string): string[] => {
    if (!code) return [];
    // Insert a space before any capital that follows a lowercase letter or
    // another capital followed by lowercase (handles "ABCThing" → "ABC Thing").
    const spaced = code
        .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
        .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2');
    return spaced.split(/\s+/).filter(Boolean);
};

const sentenceCase = (parts: string[]): string => {
    if (parts.length === 0) return '';
    const [head, ...rest] = parts;
    const headOut = head.charAt(0).toUpperCase() + head.slice(1).toLowerCase();
    const restOut = rest.map((w) => w.toLowerCase());
    return [headOut, ...restOut].join(' ');
};

const titleCase = (parts: string[]): string =>
    parts.map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');

// ─── Public API ──────────────────────────────────────────────────────────────

/** Sentence case display string. `"MostlyClear"` → `"Mostly clear"`. */
export const humanizeCondition = (code: string | null | undefined): string => {
    if (!code) return '';
    if (LONG[code]) return LONG[code];
    return sentenceCase(splitCamel(code));
};

/** Title case display string. `"MostlyClear"` → `"Mostly Clear"`. */
export const humanizeConditionTitle = (code: string | null | undefined): string => {
    if (!code) return '';
    if (TITLE[code]) return TITLE[code];
    return titleCase(splitCamel(code));
};

/** One-word chip-friendly form. `"PartlyCloudy"` → `"Cloudy"`. */
export const humanizeConditionShort = (code: string | null | undefined): string => {
    if (!code) return '';
    if (SHORT[code]) return SHORT[code];
    // Fallback: take the last word of the camelCase split, sentence-cased.
    const parts = splitCamel(code);
    if (parts.length === 0) return '';
    const last = parts[parts.length - 1];
    return last.charAt(0).toUpperCase() + last.slice(1).toLowerCase();
};
