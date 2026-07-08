import { buildWearContext, ENGINE_VERSION, getWeatherBucket } from '../outfitEngine';
import type { CurrentWeather, Settings, OutfitHistoryEntry } from '../../types';

// Minimal weather fixture — only fields the context derivation reads.
const makeWeather = (over: Partial<CurrentWeather> = {}): CurrentWeather => ({
  WeatherText: 'MostlyClear',
  HasPrecipitation: false,
  IsDayTime: true,
  Temperature:         { Imperial: { Value: 60, Unit: 'F' }, Metric: { Value: 15.5, Unit: 'C' } },
  RealFeelTemperature: { Imperial: { Value: 58, Unit: 'F' }, Metric: { Value: 14.4, Unit: 'C' } },
  Wind: { Speed: { Imperial: { Value: 8 }, Metric: { Value: 13 } } },
  RelativeHumidity: 55,
  UVIndexText: 'Moderate',
  ...over,
} as CurrentWeather);

const makeSettings = (over: Partial<Settings> = {}): Settings => ({
  hiTempThreshold: 75,
  lowTempThreshold: 55,
  occasion: 'work',
  clothingStyles: ['Casual', 'Urban'],
  ...over,
} as Settings);

describe('buildWearContext', () => {
  it('captures the weather snapshot with the same bucket the engine uses', () => {
    const ctx = buildWearContext(makeWeather(), makeSettings());
    expect(ctx.feelsLikeF).toBe(58);
    // No forecasts → no morning blend → bucket derives from raw feels-like.
    expect(ctx.bucket).toBe(getWeatherBucket(58, 75, 55));
    expect(ctx.precipIntensity).toBe('none');
    expect(ctx.humidity).toBe(55);
    expect(ctx.windMph).toBe(8);
    expect(ctx.isSnowing).toBe(false);
  });

  it('stamps a valid local hour', () => {
    const ctx = buildWearContext(makeWeather(), makeSettings());
    expect(ctx.hourOfDay).toBeGreaterThanOrEqual(0);
    expect(ctx.hourOfDay).toBeLessThanOrEqual(23);
    expect(Number.isInteger(ctx.hourOfDay)).toBe(true);
  });

  it('passes through occasion and styles', () => {
    const ctx = buildWearContext(makeWeather(), makeSettings());
    expect(ctx.occasion).toBe('work');
    expect(ctx.styles).toEqual(['Casual', 'Urban']);
  });

  it('falls back to legacy single clothingStyle when styles list is empty', () => {
    const ctx = buildWearContext(
      makeWeather(),
      makeSettings({ clothingStyles: [], clothingStyle: 'Formal' } as Partial<Settings>),
    );
    expect(ctx.styles).toEqual(['Formal']);
  });

  it('detects snow and precipitation intensity', () => {
    const ctx = buildWearContext(
      makeWeather({
        WeatherText: 'HeavySnow',
        HasPrecipitation: true,
        Precip1hr: { Imperial: { Value: 0.35 } },
      }),
      makeSettings(),
    );
    expect(ctx.isSnowing).toBe(true);
    expect(ctx.precipIntensity).toBe('heavy');
  });
});

describe('OutfitHistoryEntry instrumentation shape', () => {
  it('old entries without instrumentation fields still round-trip', () => {
    const legacy: OutfitHistoryEntry = {
      id: '123-abc',
      wornAt: new Date().toISOString(),
      closetId: 'c1',
      closetName: 'Main',
      articleIds: ['a1', 'a2'],
      articleSummary: 'Shirt, Jeans',
    };
    const parsed: OutfitHistoryEntry = JSON.parse(JSON.stringify(legacy));
    expect(parsed.context).toBeUndefined();
    expect(parsed.engine).toBeUndefined();
    expect(parsed.negatives).toBeUndefined();
    expect(parsed.articleIds).toEqual(['a1', 'a2']);
  });

  it('instrumented entries round-trip with context, engine, and negatives intact', () => {
    const entry: OutfitHistoryEntry = {
      id: '456-def',
      wornAt: new Date().toISOString(),
      closetId: 'c1',
      closetName: 'Main',
      articleIds: ['a1', 'a2', 'a3'],
      articleSummary: 'Shirt, Jeans, Boots',
      context: buildWearContext(makeWeather(), makeSettings()),
      engine: {
        score: 87,
        breakdown: { fabric: 90, color: 80, style: 85, simplicity: 70, preference: 60 },
        rank: 1,
        engineVersion: ENGINE_VERSION,
      },
      negatives: [
        { articleIds: ['a4', 'a5'], score: 82, source: 'shown_not_worn' },
      ],
    };
    const parsed: OutfitHistoryEntry = JSON.parse(JSON.stringify(entry));
    expect(parsed.context?.bucket).toBe(entry.context?.bucket);
    expect(parsed.engine?.rank).toBe(1);
    expect(parsed.engine?.engineVersion).toBe(ENGINE_VERSION);
    expect(parsed.negatives).toHaveLength(1);
    expect(parsed.negatives?.[0].source).toBe('shown_not_worn');
  });
});
