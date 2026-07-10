/**
 * buildInput tests — the weather block (hero temp / H-L / rain % / sunset) and
 * the "Change fit" variants added by the widget UI redesign, plus the existing
 * worn > trip > generated precedence they have to respect.
 */

import type { CurrentWeather, DailyForecast, Settings } from '../../../types';
import type { OutfitResult } from '../../outfit/types';
import { buildWeatherBlock, buildWidgetInput, WidgetSyncData } from '../buildInput';

const weather: CurrentWeather = {
  WeatherText: 'PartlyCloudy',
  HasPrecipitation: false,
  IsDayTime: true,
  Temperature: {
    Imperial: { Value: 72.4, Unit: 'F' },
    Metric: { Value: 22.4, Unit: 'C' },
  },
  RealFeelTemperature: {
    Imperial: { Value: 75.6, Unit: 'F' },
    Metric: { Value: 24.2, Unit: 'C' },
  },
  Wind: { Speed: { Imperial: { Value: 5 }, Metric: { Value: 8 } } },
  RelativeHumidity: 40,
  UVIndexText: 'Very High',
};

/** Today's daily entry — date matches the local calendar day like the API's does. */
const localToday = (): string => {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const daily: DailyForecast[] = [
  {
    date: localToday(),
    minTempF: 61.2,
    maxTempF: 78.4,
    dayPhrase: 'PartlyCloudy',
    hasPrecipitation: false,
    precipProbability: 35,
    sunset: new Date(new Date().setHours(20, 14, 0, 0)).toISOString(),
  },
];

const settings = { temperatureScale: 'Imperial' } as Settings;
const metricSettings = { temperatureScale: 'Metric' } as Settings;

const outfit = (headline: string): OutfitResult =>
  ({
    status: 'ok',
    headline,
    slots: [
      { role: 'top', article: { _id: `${headline}-top`, imageUrl: `https://img/${headline}-top.jpg` } },
      { role: 'bottom', article: { _id: `${headline}-bottom`, imageUrl: `https://img/${headline}-bottom.jpg` } },
    ],
    notes: [],
    score: 80,
    scoreBreakdown: { fabric: 0, color: 0, style: 0, simplicity: 0, preference: 0 },
  }) as unknown as OutfitResult;

const noTrip: WidgetSyncData['trip'] = {
  active: false,
  plan: null,
  outfit: null,
  dayIndex: 0,
  total: 0,
  driftNote: null,
  locationConfirmed: false,
};

const baseData = (over: Partial<WidgetSyncData> = {}): WidgetSyncData => ({
  todayOutfits: [outfit('Fit A'), outfit('Fit B'), outfit('Fit C'), outfit('Fit D')],
  wornOutfit: null,
  outfitStatus: 'ok',
  closetCount: 1,
  weather,
  settings,
  daily,
  trip: noTrip,
  upcoming: null,
  ...over,
});

describe('buildWeatherBlock', () => {
  it('converts everything to the imperial unit with H/L, rain % and sunset from today', () => {
    expect(buildWeatherBlock(weather, settings, daily)).toEqual({
      temp: 72,
      feelsLike: 76,
      high: 78,
      low: 61,
      unit: 'F',
      condition: 'Partly Cloudy',
      rainChance: 35,
      uvText: 'Very High',
      sunset: '8:14 PM',
    });
  });

  it('uses metric values and converts the daily °F H/L when the user is metric', () => {
    const block = buildWeatherBlock(weather, metricSettings, daily)!;
    expect(block.unit).toBe('C');
    expect(block.temp).toBe(22);
    expect(block.feelsLike).toBe(24);
    expect(block.high).toBe(26); // 78.4°F
    expect(block.low).toBe(16); // 61.2°F
  });

  it('degrades to undefined H/L, rain % and sunset without a daily forecast', () => {
    const block = buildWeatherBlock(weather, settings, undefined)!;
    expect(block.temp).toBe(72);
    expect(block.high).toBeUndefined();
    expect(block.low).toBeUndefined();
    expect(block.rainChance).toBeUndefined();
    expect(block.sunset).toBeUndefined();
  });

  it('returns undefined without weather', () => {
    expect(buildWeatherBlock(null, settings, daily)).toBeUndefined();
  });
});

describe('buildWidgetInput variants', () => {
  it('caps generated outfits at 3 variants, primary first and mirrored at top level', () => {
    const input = buildWidgetInput(baseData());
    expect(input.mode).toBe('today');
    expect(input.variants).toHaveLength(3);
    expect(input.variants!.map((v) => v.headline)).toEqual(['Fit A', 'Fit B', 'Fit C']);
    expect(input.headline).toBe('Fit A');
    expect(input.items).toEqual(input.variants![0].items);
    expect(input.weather?.temp).toBe(72);
  });

  it('a worn outfit is a single variant that beats the generated list', () => {
    const input = buildWidgetInput(baseData({ wornOutfit: outfit('Worn') }));
    expect(input.headline).toBe('Worn');
    expect(input.variants).toHaveLength(1);
    expect(input.variants![0].headline).toBe('Worn');
  });

  it('trip mode is a single variant carrying the weather block', () => {
    const input = buildWidgetInput(
      baseData({
        trip: {
          active: true,
          plan: { id: 'p1', destination: 'Lisbon' } as never,
          outfit: outfit('Trip fit'),
          dayIndex: 2,
          total: 5,
          driftNote: null,
          locationConfirmed: true,
        },
      }),
    );
    expect(input.mode).toBe('trip');
    expect(input.variants).toHaveLength(1);
    expect(input.weather?.high).toBe(78);
    expect(input.deepLink).toBe('ojo://trip/p1');
  });

  it('empty mode has no variants but keeps the weather readout', () => {
    const input = buildWidgetInput(baseData({ todayOutfits: [], outfitStatus: 'insufficient' }));
    expect(input.mode).toBe('empty');
    expect(input.variants).toBeUndefined();
    expect(input.weather?.temp).toBe(72);
    expect(input.emptyReason).toBe('insufficient');
  });
});
