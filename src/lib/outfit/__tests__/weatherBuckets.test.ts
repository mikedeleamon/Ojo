import {
  getWeatherBucket,
  isWeatherAppropriate,
  classifyPrecipitation,
  precipMultiplier,
} from '../weatherBuckets';
import type { ClothingArticle, CurrentWeather } from '../../../types';

const article = (partial: Partial<ClothingArticle>): ClothingArticle => ({
  _id: 'x',
  clothingType: 'T-Shirt',
  ...partial,
});

const weather = (partial: Partial<CurrentWeather>): CurrentWeather =>
  ({
    WeatherText: '',
    HasPrecipitation: false,
    IsDayTime: true,
    Temperature: { Imperial: { Value: 70, Unit: 'F' }, Metric: { Value: 21, Unit: 'C' } },
    RealFeelTemperature: { Imperial: { Value: 70, Unit: 'F' }, Metric: { Value: 21, Unit: 'C' } },
    Wind: { Speed: { Imperial: { Value: 0 }, Metric: { Value: 0 } } },
    RelativeHumidity: 50,
    UVIndexText: 'Low',
    ...partial,
  }) as CurrentWeather;

describe('getWeatherBucket', () => {
  it('respects user thresholds', () => {
    expect(getWeatherBucket(80, 75, 55)).toBe('hot');
    expect(getWeatherBucket(60, 75, 55)).toBe('warm');
    expect(getWeatherBucket(45, 75, 55)).toBe('cool');
    expect(getWeatherBucket(35, 75, 55)).toBe('cold');
    expect(getWeatherBucket(20, 75, 55)).toBe('freezing');
  });
});

describe('isWeatherAppropriate', () => {
  it('rejects coats in hot weather', () => {
    expect(isWeatherAppropriate(article({ clothingType: 'Coat' }), 'hot')).toBe(false);
  });
  it('rejects shorts in cold weather', () => {
    expect(isWeatherAppropriate(article({ clothingType: 'Shorts' }), 'cold')).toBe(false);
  });
  it('rejects skirts in freezing weather', () => {
    expect(isWeatherAppropriate(article({ clothingType: 'Skirt' }), 'freezing')).toBe(false);
  });
  it('allows shirts in any bucket', () => {
    for (const b of ['hot', 'warm', 'cool', 'cold', 'freezing'] as const) {
      expect(isWeatherAppropriate(article({ clothingType: 'Shirt' }), b)).toBe(true);
    }
  });
});

describe('classifyPrecipitation', () => {
  it('returns none when no precipitation', () => {
    expect(classifyPrecipitation(weather({ HasPrecipitation: false }))).toBe('none');
  });
  it('uses Precip1hr when present', () => {
    expect(classifyPrecipitation(weather({
      HasPrecipitation: true,
      Precip1hr: { Imperial: { Value: 0.35 } },
    }))).toBe('heavy');
    expect(classifyPrecipitation(weather({
      HasPrecipitation: true,
      Precip1hr: { Imperial: { Value: 0.15 } },
    }))).toBe('moderate');
    expect(classifyPrecipitation(weather({
      HasPrecipitation: true,
      Precip1hr: { Imperial: { Value: 0.05 } },
    }))).toBe('light');
  });
  it('falls back to WeatherText keywords', () => {
    // WeatherKit conditionCodes — substring matchers should still trigger.
    expect(classifyPrecipitation(weather({
      HasPrecipitation: true,
      WeatherText: 'HeavyRain',
    }))).toBe('heavy');
    expect(classifyPrecipitation(weather({
      HasPrecipitation: true,
      WeatherText: 'Thunderstorms',
    }))).toBe('moderate');
  });
});

describe('precipMultiplier', () => {
  it('maps intensities monotonically', () => {
    expect(precipMultiplier('none')).toBeLessThan(precipMultiplier('light'));
    expect(precipMultiplier('light')).toBeLessThan(precipMultiplier('moderate'));
    expect(precipMultiplier('moderate')).toBeLessThan(precipMultiplier('heavy'));
    expect(precipMultiplier('heavy')).toBe(1.0);
  });
});
