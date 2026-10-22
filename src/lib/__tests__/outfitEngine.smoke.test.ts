import { generateOutfits, getWeatherBucket } from '../outfitEngine';
import type { OutfitResult, OutfitRole } from '../outfitEngine';
import type { ClothingArticle, CurrentWeather, Forecast, Settings } from '../../types';

describe('outfitEngine — smoke', () => {
  const HI = 75;
  const LO = 55;

  it('buckets hot at or above the high threshold', () => {
    expect(getWeatherBucket(80, HI, LO)).toBe('hot');
    expect(getWeatherBucket(HI, HI, LO)).toBe('hot');
  });

  it('buckets warm between low and high thresholds', () => {
    expect(getWeatherBucket(70, HI, LO)).toBe('warm');
    expect(getWeatherBucket(LO, HI, LO)).toBe('warm');
  });

  it('buckets cool within 15F below the low threshold', () => {
    expect(getWeatherBucket(LO - 1, HI, LO)).toBe('cool');
    expect(getWeatherBucket(LO - 15, HI, LO)).toBe('cool');
  });

  it('buckets cold above freezing but below the cool window', () => {
    expect(getWeatherBucket(35, HI, LO)).toBe('cold');
    expect(getWeatherBucket(32, HI, LO)).toBe('cold');
  });

  it('buckets freezing below 32F', () => {
    expect(getWeatherBucket(31, HI, LO)).toBe('freezing');
    expect(getWeatherBucket(0, HI, LO)).toBe('freezing');
  });
});

// ─── Engine fixtures ─────────────────────────────────────────────────────────

/** Cold-below 50°F, as in the audit's on-device check: the cool band is 35–50°F. */
const SETTINGS: Settings = {
  clothingStyles: ['Casual'],
  location: 'Test City',
  temperatureScale: 'Imperial',
  hiTempThreshold: 75,
  lowTempThreshold: 50,
  humidityPreference: 50,
};

const weather = (
  feelsLikeF: number,
  { wind = 3, rain = false, precip1hr, text = rain ? 'Drizzle' : 'Cloudy' }:
    { wind?: number; rain?: boolean; precip1hr?: number; text?: string } = {},
): CurrentWeather => ({
  WeatherText: text,
  HasPrecipitation: rain,
  PrecipitationType: rain ? 'Rain' : null,
  ...(precip1hr !== undefined ? { Precip1hr: { Imperial: { Value: precip1hr } } } : {}),
  IsDayTime: true,
  Temperature:         { Imperial: { Value: feelsLikeF, Unit: 'F' }, Metric: { Value: 0, Unit: 'C' } },
  RealFeelTemperature: { Imperial: { Value: feelsLikeF, Unit: 'F' }, Metric: { Value: 0, Unit: 'C' } },
  Wind: { Speed: { Imperial: { Value: wind }, Metric: { Value: 0 } } },
  RelativeHumidity: 60,
  UVIndexText: 'Low',
});

const article = (_id: string, clothingType: string, fabricType: string): ClothingArticle =>
  ({ _id, clothingType, name: _id, color: 'Navy', fabricType });

/** The audit's reproduction closet: everything a cool day could need, jacket included. */
const closet = (): ClothingArticle[] => [
  article('Tee', 'T-Shirt', 'Cotton'),
  article('Oxford', 'Shirt', 'Cotton'),
  article('Jeans', 'Jeans', 'Denim'),
  article('Chinos', 'Pants', 'Cotton'),
  article('Hoodie', 'Hoodie', 'Cotton'),
  article('Jacket', 'Jacket', 'Synthetic'),
  article('Sneakers', 'Sneakers', 'Cotton'),
];

const without = (...types: string[]) => closet().filter(a => !types.includes(a.clothingType));

const hasRole = (r: OutfitResult, role: OutfitRole) => r.slots.some(s => s.role === role);

/** Hourly forecast from 7 AM, cooling linearly from `from` to `to`. */
const coolingHours = (from: number, to: number): Forecast[] =>
  Array.from({ length: 12 }, (_, i) => ({
    IconPhrase: 'Cloudy',
    Temperature: { Value: from + ((to - from) * i) / 11, Unit: 'F' },
    DateTime: `2026-10-22T${String(7 + i).padStart(2, '0')}:00:00`,
    IsDaylight: 7 + i < 18,
  }));

const JACKET_NOTE = 'A light jacket would work well today.';

// ─── P0-3 ────────────────────────────────────────────────────────────────────

describe('outfitEngine — one layering boundary for the card and the layering text', () => {
  it('42°F, calm and dry, with a jacket in the closet: no contradiction (audit repro)', () => {
    const { results } = generateOutfits(closet(), weather(42), SETTINGS);
    expect(results[0].headline).toBe('A bit cool — layer up.');
    expect(results.some(r => !hasRole(r, 'outerwear'))).toBe(true);
    for (const r of results) {
      expect(hasRole(r, 'outerwear')).toBe(r.layering!.needsOuter);
      // "Layer up" comes with a layer.
      expect(hasRole(r, 'midLayer')).toBe(true);
      expect(r.layering!.recommendation).not.toMatch(/likely won't need/);
    }
  });

  it('across the cool band, calm or windy, the card has a jacket exactly when the text calls for one', () => {
    for (const f of [36, 40, 45, 49]) {
      for (const wind of [3, 15]) {
        const { results } = generateOutfits(closet(), weather(f, { wind }), SETTINGS);
        expect(results.length).toBeGreaterThan(0);
        for (const r of results) {
          const label = `${f}°F/${wind}mph`;
          expect(`${label}: outer=${hasRole(r, 'outerwear')}`).toBe(`${label}: outer=${r.layering!.needsOuter}`);
          expect(r.layering!.missingOuter).toBe(false);
          expect(r.layering!.recommendation).not.toMatch(/likely won't need/);
        }
      }
    }
  });

  it('below the cool band, every outfit has outerwear', () => {
    for (const f of [20, 30, 34]) {
      const { results } = generateOutfits(closet(), weather(f), SETTINGS);
      for (const r of results) {
        expect(hasRole(r, 'outerwear')).toBe(true);
        expect(r.layering!.needsOuter).toBe(true);
      }
    }
  });

  it('judges layers at the morning-blended temperature the headline uses', () => {
    jest.useFakeTimers({ now: new Date(2026, 9, 22, 7, 0) });
    try {
      // 37°F now with a 26°F low: the 7 AM blend lands below 35°F, so the
      // bucket is cold even though the current reading alone isn't.
      const { results } = generateOutfits(closet(), weather(37), SETTINGS, new Set(), 3, undefined, coolingHours(37, 26));
      expect(results[0].headline).toBe('Bundle up today.');
      for (const r of results) {
        expect(hasRole(r, 'outerwear')).toBe(true);
        expect(r.layering!.needsOuter).toBe(true);
      }
    } finally {
      jest.useRealTimers();
    }
  });

  it('light rain keeps the jacket you own on the card instead of asking for one', () => {
    const { results } = generateOutfits(closet(), weather(60, { rain: true }), SETTINGS);
    for (const r of results) {
      expect(hasRole(r, 'outerwear')).toBe(true);
      expect(r.layering!.missingOuter).toBe(false);
    }
  });

  it('the light-jacket note is about the closet, not the chosen outfit', () => {
    // 42°F with 15 mph wind: the wind chill puts an outer layer in play.
    for (const r of generateOutfits(closet(), weather(42, { wind: 15 }), SETTINGS).results) {
      expect(r.notes).not.toContain(JACKET_NOTE);
    }
    const [top] = generateOutfits(without('Jacket'), weather(42, { wind: 15 }), SETTINGS).results;
    expect(top.notes).toContain(JACKET_NOTE);
  });
});

// ─── P1-7 ────────────────────────────────────────────────────────────────────

describe('outfitEngine — wardrobe gaps come from the closet, not from note copy', () => {
  it('a rainy day with a jacket in the closet logs no rain-layer gap', () => {
    for (const precip1hr of [0.05, 0.2, 0.5]) {
      const [top] = generateOutfits(closet(), weather(60, { rain: true, precip1hr }), SETTINGS).results;
      expect(top.gaps).not.toContain('missing_rain_layer');
    }
  });

  it('moderate or heavy rain with no outerwear logs one; light rain does not', () => {
    expect(generateOutfits(without('Jacket'), weather(60, { rain: true, precip1hr: 0.5 }), SETTINGS).results[0].gaps)
      .toContain('missing_rain_layer');
    expect(generateOutfits(without('Jacket'), weather(60, { rain: true, precip1hr: 0.05 }), SETTINGS).results[0].gaps)
      .not.toContain('missing_rain_layer');
  });

  it('a cold day with no outerwear logs a missing coat', () => {
    const [top] = generateOutfits(without('Jacket'), weather(30), SETTINGS).results;
    expect(top.gaps).toContain('missing_coat');
    expect(generateOutfits(closet(), weather(30), SETTINGS).results[0].gaps).not.toContain('missing_coat');
  });

  it('a cool day with no mid layer logs one, which the old matcher never could', () => {
    expect(generateOutfits(without('Hoodie'), weather(42), SETTINGS).results[0].gaps).toContain('missing_mid_layer');
    expect(generateOutfits(closet(), weather(42), SETTINGS).results[0].gaps).not.toContain('missing_mid_layer');
  });

  it('a closet with no shoes logs missing footwear', () => {
    expect(generateOutfits(without('Sneakers'), weather(65), SETTINGS).results[0].gaps).toEqual(['missing_footwear']);
  });

  it('a well-stocked closet on a mild day logs nothing', () => {
    expect(generateOutfits(closet(), weather(65), SETTINGS).results[0].gaps).toEqual([]);
  });

  it('gaps are closet-level: every outfit in a generation carries the same ones', () => {
    const { results } = generateOutfits(without('Jacket', 'Hoodie'), weather(30), SETTINGS);
    for (const r of results) expect(r.gaps).toEqual(results[0].gaps);
  });
});

// ─── P2-13 ───────────────────────────────────────────────────────────────────

describe('outfitEngine — every selected style gets a pick', () => {
  const bigCloset = (): ClothingArticle[] => {
    const types: [string, string][] = [
      ['T-Shirt', 'Cotton'], ['Shirt', 'Cotton'], ['Jeans', 'Denim'], ['Pants', 'Wool'],
      ['Hoodie', 'Fleece'], ['Sweater', 'Wool'], ['Jacket', 'Synthetic'], ['Coat', 'Wool'],
      ['Sneakers', 'Cotton'], ['Boots', 'Leather'], ['Shoes', 'Leather'],
    ];
    return types.flatMap(([type, fabric]) =>
      ['Navy', 'Black', 'Grey', 'White'].map((color, i) =>
        ({ _id: `${type}-${i}`, clothingType: type, name: `${type} ${i}`, color, fabricType: fabric })));
  };

  it('four styles with topK 5 → one labelled pick per style plus a wild card', () => {
    const styles = ['Casual', 'Streetwear', 'Minimalist', 'Outdoor'];
    const { results } = generateOutfits(
      bigCloset(), weather(42, { wind: 14 }), { ...SETTINGS, clothingStyles: styles }, new Set(), 5,
    );
    const labels = results.map(r => r.moodLabel);
    for (const style of styles) expect(labels).toContain(`${style} pick`);
    expect(labels).toContain('Wild card');
  });
});
