/**
 * THE RELEASE BLOCKER (docs/zero-catalog-first-value.md §4.1 / §7).
 *
 * Generic advice that can't produce an outfit is worse than no feature at all:
 * the user lands on the exact empty state this work exists to remove, having
 * been told they'd get something. `insufficient` fires *after*
 * isWeatherAppropriate and gender filtering, so "selected something" is not the
 * same as "can dress this day" — which is why this is exhaustive over
 * band × bucket × wardrobe-gender rather than a spot check.
 */
import { generateOutfits } from '../../outfitEngine';
import type { CurrentWeather, Settings } from '../../../types';
import type { WeatherBucket } from '../../outfit/types';
import { CLIMATE_BANDS, climateBandFor, type ClimateBand } from '../../climate';
import { typicalWardrobe, invariantFailures, WEATHER_BUCKETS } from '../typicalWardrobe';
import { archetypeToArticle, buildGenericOutfit } from '../genericOutfit';
import type { GarmentArchetype } from '../types';
import { ARCHETYPE_CATALOG } from '../catalog';

const HI = 85;
const LO = 50;

/** Feels-like temperature that lands squarely inside each bucket at HI/LO. */
const BUCKET_TEMP: Record<WeatherBucket, number> = {
  hot: 95, warm: 70, cool: 42, cold: 33, freezing: 20,
};

const settingsFor = (gender: string): Settings => ({
  clothingStyles: ['Casual'],
  location: 'Test City',
  temperatureScale: 'Imperial',
  hiTempThreshold: HI,
  lowTempThreshold: LO,
  humidityPreference: 50,
  gender,
});

const weatherFor = (bucket: WeatherBucket, over: Partial<CurrentWeather> = {}): CurrentWeather => {
  const t = BUCKET_TEMP[bucket];
  return {
    WeatherText: 'MostlyClear',
    HasPrecipitation: false,
    IsDayTime: true,
    Temperature:         { Imperial: { Value: t, Unit: 'F' }, Metric: { Value: 0, Unit: 'C' } },
    RealFeelTemperature: { Imperial: { Value: t, Unit: 'F' }, Metric: { Value: 0, Unit: 'C' } },
    Wind: { Speed: { Imperial: { Value: 5 }, Metric: { Value: 8 } } },
    RelativeHumidity: 45,
    UVIndexText: 'Moderate',
    ...over,
  };
};

const WARDROBE_GENDERS = ['All', "Men's", "Women's"];

describe('invariant — every band × bucket produces a wearable answer', () => {
  for (const band of CLIMATE_BANDS) {
    for (const gender of WARDROBE_GENDERS) {
      it(`${band} / ${gender} covers top+bottom+footwear in every bucket`, () => {
        expect(invariantFailures(typicalWardrobe(band, { gender }))).toEqual([]);
      });

      for (const bucket of WEATHER_BUCKETS) {
        it(`${band} / ${gender} / ${bucket} → status ok`, () => {
          const articles = typicalWardrobe(band, { gender }).map(archetypeToArticle);
          const { status, results } = generateOutfits(
            articles,
            weatherFor(bucket),
            settingsFor(gender),
          );
          expect(status).toBe('ok');
          expect(results[0].slots.length).toBeGreaterThan(0);
        });
      }
    }
  }

  it('holds in the rain too — wet weather must not filter the seed empty', () => {
    for (const band of CLIMATE_BANDS) {
      for (const bucket of WEATHER_BUCKETS) {
        const articles = typicalWardrobe(band).map(archetypeToArticle);
        const { status } = generateOutfits(
          articles,
          weatherFor(bucket, {
            HasPrecipitation: true,
            WeatherText: 'Rain',
            Precip1hr: { Imperial: { Value: 0.4 } },
          }),
          settingsFor('All'),
        );
        expect(`${band}/${bucket}:${status}`).toBe(`${band}/${bucket}:ok`);
      }
    }
  });
});

describe('the selection is climate-appropriate, not just non-empty', () => {
  const idsFor = (band: ClimateBand) => typicalWardrobe(band).map(a => a.id);

  it('Phoenix does not get a parka', () => {
    const band = climateBandFor(33.45, -112.07);
    expect(band).toBe('arid');
    const ids = idsFor(band);
    expect(ids).not.toContain('outer_coat_parka');
    expect(ids).not.toContain('outer_coat_wool');
    expect(ids).not.toContain('acc_gloves');
    // …and it does get the things a desert wardrobe actually holds.
    expect(ids).toContain('shoe_sandals');
    expect(ids).toContain('acc_sun_hat');
  });

  it('Oslo does', () => {
    const band = climateBandFor(59.91, 10.75);
    expect(band).toBe('continental');
    const ids = idsFor(band);
    expect(ids).toContain('outer_coat_parka');
    expect(ids).toContain('acc_gloves');
    expect(ids).toContain('acc_beanie');
  });

  it('Singapore gets no winter coat at all', () => {
    const band = climateBandFor(1.35, 103.82);
    expect(band).toBe('tropical');
    const ids = idsFor(band);
    expect(ids.filter(id => id.startsWith('outer_coat_'))).toEqual([]);
  });

  it("a Men's wardrobe is never seeded a skirt or dress", () => {
    for (const band of CLIMATE_BANDS) {
      const ids = typicalWardrobe(band, { gender: "Men's" }).map(a => a.id);
      expect(ids).not.toContain('bot_skirt');
      expect(ids.filter(id => id.startsWith('full_dress_'))).toEqual([]);
    }
  });
});

describe('back-fill', () => {
  /** A catalog that prevalence alone would leave unable to dress a cold day. */
  const strandedCatalog: GarmentArchetype[] = [
    {
      id: 'x_tee', displayName: 'Tee', clothingType: 'T-Shirt', fabricHint: 'Cotton',
      isAccessory: false, commonality: 1, glyph: 'tee',
      prevalence: { tropical: 1, arid: 1, temperate: 1, continental: 1, polar: 1 },
    },
    {
      id: 'x_shorts', displayName: 'Shorts', clothingType: 'Shorts', fabricHint: 'Cotton',
      isAccessory: false, commonality: 0.9, glyph: 'shorts',
      prevalence: { tropical: 1, arid: 1, temperate: 1, continental: 1, polar: 1 },
    },
    {
      id: 'x_sandals', displayName: 'Sandals', clothingType: 'Sandals', fabricHint: 'Synthetic',
      isAccessory: false, commonality: 0.9, glyph: 'sandal',
      prevalence: { tropical: 1, arid: 1, temperate: 1, continental: 1, polar: 1 },
    },
    // Below the threshold — only reachable via back-fill.
    {
      id: 'x_jeans', displayName: 'Jeans', clothingType: 'Jeans', fabricHint: 'Denim',
      isAccessory: false, commonality: 0.5, glyph: 'jeans',
      prevalence: { tropical: 0.2, arid: 0.2, temperate: 0.2, continental: 0.2, polar: 0.2 },
    },
    {
      id: 'x_sneakers', displayName: 'Sneakers', clothingType: 'Sneakers', fabricHint: 'Synthetic',
      isAccessory: false, commonality: 0.5, glyph: 'sneaker',
      prevalence: { tropical: 0.2, arid: 0.2, temperate: 0.2, continental: 0.2, polar: 0.2 },
    },
  ];

  it('pulls in a sub-threshold garment when a bucket would otherwise be stranded', () => {
    const ids = typicalWardrobe('tropical', { catalog: strandedCatalog }).map(a => a.id);
    // Shorts and sandals are hard-excluded below freezing; without back-fill this
    // selection lands on `insufficient` the first cold morning.
    expect(ids).toContain('x_jeans');
    expect(ids).toContain('x_sneakers');
  });

  it('back-filled sets satisfy the invariant and generate an outfit', () => {
    const archetypes = typicalWardrobe('tropical', { catalog: strandedCatalog });
    expect(invariantFailures(archetypes)).toEqual([]);
    const articles = archetypes.map(archetypeToArticle);
    for (const bucket of WEATHER_BUCKETS) {
      const { status } = generateOutfits(articles, weatherFor(bucket), settingsFor('All'));
      expect(`${bucket}:${status}`).toBe(`${bucket}:ok`);
    }
  });

  it('adds nothing when the threshold selection already covers every bucket', () => {
    const wide = strandedCatalog.map(a =>
      a.id === 'x_jeans' || a.id === 'x_sneakers'
        ? { ...a, prevalence: { tropical: 1, arid: 1, temperate: 1, continental: 1, polar: 1 } }
        : a,
    );
    expect(typicalWardrobe('tropical', { catalog: wide }).length).toBe(wide.length);
  });
});


describe('buildGenericOutfit — the entry point the app calls', () => {
  it('answers for every bucket, from coordinates', () => {
    // Oslo. The band is inferred, not passed, so this also pins the wiring
    // between climate.ts and the wardrobe selection.
    for (const bucket of WEATHER_BUCKETS) {
      const out = buildGenericOutfit({
        weather: weatherFor(bucket),
        settings: settingsFor('All'),
        coords: { lat: 59.91, lon: 10.75 },
      });
      expect(`${bucket}:${out ? 'ok' : 'null'}`).toBe(`${bucket}:ok`);
      expect(out!.headline.length).toBeGreaterThan(0);
      expect(out!.band).toBe('continental');
    }
  });

  it('falls back to temperate rather than failing when coordinates are unknown', () => {
    const out = buildGenericOutfit({
      weather: weatherFor('cool'),
      settings: settingsFor('All'),
      coords: null,
    });
    expect(out).not.toBeNull();
    expect(out!.band).toBe('temperate');
  });

  it('never names a garment outside the wardrobe preference', () => {
    const out = buildGenericOutfit({
      weather: weatherFor('warm'),
      settings: settingsFor("Men's"),
      coords: { lat: 40.71, lon: -74.01 },
    });
    expect(out).not.toBeNull();
    const prose = `${out!.headline} ${out!.recommendation}`;
    expect(prose.toLowerCase()).not.toContain('skirt');
    expect(prose.toLowerCase()).not.toContain('dress');
  });
});

/** Hourly forecast rows as [local hour, °F, IconPhrase] on a fixed day. */
const hourlyForecast = (rows: [number, number, string][]) =>
  rows.map(([h, t, phrase]) => ({
    IconPhrase: phrase,
    Temperature: { Value: t, Unit: 'F' },
    DateTime: new Date(2026, 9, 12, h).toISOString(),
    IsDaylight: h < 19,
  }));

describe('buildGenericOutfit — copy never claims ownership', () => {
  // "jacket" is deliberately absent: "a jacket would make a real difference" is
  // generic advice, not a stand-in garment.
  const GARMENT_WORDS = /t-?shirt|tee\b|hoodie|sweater|coat|jeans|cotton|wool|fleece|denim|\byour\b|closet/i;

  it('talks about layers, not garments, in every bucket × rain state', () => {
    for (const bucket of WEATHER_BUCKETS) {
      for (const wet of [false, true]) {
        const out = buildGenericOutfit({
          weather: weatherFor(bucket, { HasPrecipitation: wet }),
          settings: settingsFor('All'),
          coords: { lat: 40.71, lon: -74.01 },
        });
        expect(out).not.toBeNull();
        const prose = [out!.recommendation, ...(out!.timeline ?? []).map(t => t.action)].join(' ');
        expect(`${bucket}/${wet}: ${prose.match(GARMENT_WORDS)?.[0] ?? ''}`).toBe(`${bucket}/${wet}: `);
      }
    }
  });

  it('timeline steps stay garment-free on a variable, rainy day', () => {
    // 41°F morning → 66°F afternoon → 45°F evening, with rain mid-morning and
    // clearing after noon: exercises the morning-keep, shed, re-layer and both
    // precipitation steps.
    const forecasts = hourlyForecast([
      [7, 41, 'Clear'], [9, 44, 'Rain'], [11, 52, 'Rain'], [13, 62, 'Clear'], [15, 70, 'Clear'],
      [17, 60, 'Clear'], [19, 52, 'Clear'], [21, 45, 'Clear'],
    ]);

    const out = buildGenericOutfit({
      weather: weatherFor('cool', { HasPrecipitation: true }),
      settings: settingsFor('All'),
      forecasts,
      coords: { lat: 40.71, lon: -74.01 },
    });
    expect(out).not.toBeNull();
    expect(out!.timeline?.length).toBeGreaterThan(1);

    const actions = out!.timeline!.map(t => t.action);
    const prose = [out!.recommendation, ...actions].join(' ');
    expect(prose.match(GARMENT_WORDS)?.[0]).toBeUndefined();
    // The steps that matter on this day all fired.
    expect(actions.some(a => /^Rain starts/.test(a))).toBe(true);
    expect(actions.some(a => /^Rain clears/.test(a))).toBe(true);
    expect(actions.some(a => /^Remove the outer layer/.test(a))).toBe(true);
    // Rain decides when the layer comes off — the summary must not tell the
    // user both to shed it as it warms and to keep it on for the rain.
    expect(out!.recommendation).not.toMatch(/feel free to shed/i);
    expect(out!.recommendation).toMatch(/until that clears/i);
  });

  it('does not hold the layer for rain that only arrives in the evening', () => {
    // Dry now, warm afternoon, rain after sunset. "Keep it on until the rain
    // clears" would contradict the timeline's afternoon shed step.
    const forecasts = hourlyForecast([
      [7, 44, 'Clear'], [10, 52, 'Clear'], [13, 64, 'Clear'], [15, 70, 'Clear'],
      [17, 62, 'Clear'], [19, 52, 'Rain'], [21, 48, 'Rain'],
    ]);
    const out = buildGenericOutfit({
      weather: weatherFor('cool', { RealFeelTemperature: { Imperial: { Value: 46, Unit: 'F' }, Metric: { Value: 0, Unit: 'C' } } }),
      settings: settingsFor('All'),
      forecasts,
      coords: { lat: 40.71, lon: -74.01 },
    });
    expect(out).not.toBeNull();
    expect(out!.recommendation).not.toMatch(/until that clears/i);
    expect(out!.recommendation).toMatch(/feel free to shed it once temperatures climb/i);
    expect(out!.recommendation).toMatch(/have it back on when that arrives/i);
  });

  it('notes never name a stand-in, mention a closet, or grade the outfit', () => {
    const names = ARCHETYPE_CATALOG.map(a => a.displayName);
    const places = [
      { lat: 40.71, lon: -74.01 },  // temperate
      { lat: 59.91, lon: 10.75 },   // continental — wool and dry-clean territory
      { lat: 1.35,  lon: 103.82 },  // tropical — linen, rain-fragile fabrics
    ];
    const conditions: Partial<CurrentWeather>[] = [
      {},
      { HasPrecipitation: true },
      { PollenCategory: 'High' },
    ];
    const allergic = { ...settingsFor('All'), sensitivities: { allergies: true } } as Settings;

    for (const coords of places) {
      for (const bucket of ['warm', 'cool', 'freezing'] as WeatherBucket[]) {
        for (const over of conditions) {
          const out = buildGenericOutfit({ weather: weatherFor(bucket, over), settings: allergic, coords });
          expect(out).not.toBeNull();
          for (const note of out!.notes) {
            const leaked = names.find(n => note.includes(n)) ?? note.match(/\bcloset\b|\/100\b/)?.[0];
            expect(`${note} → ${leaked ?? ''}`).toBe(`${note} → `);
          }
        }
      }
    }
  });

  it('keeps pollen advice for allergy sufferers, without the garment', () => {
    const out = buildGenericOutfit({
      weather: weatherFor('warm', { PollenCategory: 'High' }),
      settings: { ...settingsFor('All'), sensitivities: { allergies: true } } as Settings,
      coords: { lat: 40.71, lon: -74.01 },
    });
    expect(out!.notes).toContain('High pollen today — shower and change clothes after spending time outdoors.');
  });
});
