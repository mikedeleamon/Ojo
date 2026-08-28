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
