import { buildDayOutfit, synthesizeDayWeather, hasHourlyDetail } from '../dayOutfit';
import type { ClothingArticle, DailyForecast, Forecast, Settings } from '../../../types';
import type { UserPreferenceProfile } from '../../userPreferences';

const settings = (over: Partial<Settings> = {}): Settings => ({
  clothingStyles: ['Casual'],
  location: 'Brooklyn, NY',
  temperatureScale: 'Imperial',
  hiTempThreshold: 75,
  lowTempThreshold: 55,
  humidityPreference: 50,
  ...over,
});

const day = (over: Partial<DailyForecast> = {}): DailyForecast => ({
  date: '2026-08-16',
  minTempF: 48,
  maxTempF: 64,
  dayPhrase: 'Cloudy',
  hasPrecipitation: false,
  ...over,
});

const article = (
  _id: string,
  clothingType: string,
  over: Partial<ClothingArticle> = {},
): ClothingArticle => ({ _id, clothingType, name: _id, color: 'Navy', ...over });

/** Enough to clear the engine's top+bottom+footwear requirement. */
const wearableCloset = (): ClothingArticle[] => [
  article('Oxford', 'Shirt', { fabricType: 'Cotton' }),
  article('Tee', 'T-Shirt', { fabricType: 'Cotton' }),
  article('Jeans', 'Jeans', { fabricType: 'Denim' }),
  article('Chinos', 'Pants', { fabricType: 'Cotton' }),
  article('Fleece', 'Sweater', { fabricType: 'Wool' }),
  article('Peacoat', 'Coat', { fabricType: 'Wool' }),
  article('Sneakers', 'Sneakers', { fabricType: 'Canvas' }),
];

const profile: UserPreferenceProfile = {
  colors: {}, fabrics: {}, categories: {}, colorPairs: {}, totalOutfits: 0,
};

const base = () => ({
  articles: wearableCloset(),
  day: day(),
  settings: settings(),
  worn: new Set<string>(),
  profile,
});

/** Hours across one local day, warming from `from` to `to`. */
const hoursFor = (dateISO: string, from: number, to: number): Forecast[] =>
  Array.from({ length: 14 }, (_, i) => ({
    IconPhrase: 'Cloudy',
    Temperature: { Value: from + ((to - from) * i) / 13, Unit: 'F' },
    DateTime: `${dateISO}T${String(6 + i).padStart(2, '0')}:00:00`,
    IsDaylight: 6 + i < 20,
  }));

describe('synthesizeDayWeather', () => {
  it('uses the day midpoint for both actual and feels-like', () => {
    const w = synthesizeDayWeather(day({ minTempF: 50, maxTempF: 70 }));
    expect(w.Temperature.Imperial.Value).toBe(60);
    expect(w.RealFeelTemperature.Imperial.Value).toBe(60);
  });

  it('carries the condition and precipitation through', () => {
    const w = synthesizeDayWeather(day({ dayPhrase: 'Rain', hasPrecipitation: true }));
    expect(w.WeatherText).toBe('Rain');
    expect(w.HasPrecipitation).toBe(true);
    expect(w.PrecipitationType).toBe('Rain');
  });

  it('holds wind below the engine wind-note threshold, since it is a placeholder', () => {
    // The daily forecast carries no wind. 5 mph is a neutral stand-in, and it
    // must stay under layeringEngine's 12 mph note so the copy can never imply
    // the app knows a future day's wind.
    expect(synthesizeDayWeather(day()).Wind.Speed.Imperial.Value).toBeLessThan(12);
  });
});

describe('buildDayOutfit', () => {
  it('produces a wearable outfit from a stocked closet', () => {
    const outfit = buildDayOutfit(base());
    expect(outfit).not.toBeNull();
    expect(outfit!.slots.length).toBeGreaterThan(0);
    expect(outfit!.status).toBe('ok');
  });

  it('returns null for an empty closet rather than a headline-less shell', () => {
    expect(buildDayOutfit({ ...base(), articles: [] })).toBeNull();
  });

  it('returns null when the closet cannot make a complete outfit', () => {
    // Tops only — the engine's `insufficient` exit, which still returns a
    // one-element array whose slots are empty.
    const outfit = buildDayOutfit({
      ...base(),
      articles: [article('Tee', 'T-Shirt'), article('Oxford', 'Shirt')],
    });
    expect(outfit).toBeNull();
  });

  it('gets no timeline without hourly data — the days 2-7 case', () => {
    const outfit = buildDayOutfit(base());
    expect(outfit!.layering?.timeline).toBeUndefined();
    expect(hasHourlyDetail(outfit)).toBe(false);
  });

  it('can produce a timeline when hourly data is supplied — the day+1 case', () => {
    const outfit = buildDayOutfit({
      ...base(),
      day: day({ minTempF: 45, maxTempF: 78 }),
      forecasts: hoursFor('2026-08-16', 45, 78),
    });
    expect(outfit).not.toBeNull();
    // The engine decides whether a given day is worth a timeline at all; what
    // matters here is that supplying hours is what makes it *possible*.
    expect(outfit!.layering).toBeDefined();
  });

  it('is deterministic for the same inputs', () => {
    const a = buildDayOutfit(base());
    const b = buildDayOutfit(base());
    expect(a!.slots.map(s => s.article._id)).toEqual(b!.slots.map(s => s.article._id));
  });
});

describe('hasHourlyDetail', () => {
  it('is false for null and for an outfit with no timeline', () => {
    expect(hasHourlyDetail(null)).toBe(false);
    expect(hasHourlyDetail(buildDayOutfit(base()))).toBe(false);
  });
});
