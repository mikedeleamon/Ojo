/**
 * buildInput tests — the weather block (hero temp / H-L / rain % / sunset) and
 * the "Change fit" variants added by the widget UI redesign, plus the existing
 * worn > trip > generated precedence they have to respect.
 */

import type { CurrentWeather, DailyForecast, SavedTripFitPlan, Settings } from '../../../types';
import type { OutfitResult } from '../../outfit/types';
import { buildWeatherBlock, buildWidgetInput, tomorrowDailyFor, WidgetSyncData } from '../buildInput';

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
  it('includes the city when provided and converts to the imperial unit with H/L, rain % and sunset', () => {
    expect(buildWeatherBlock(weather, settings, daily, 'New York')).toEqual({
      city: 'New York',
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

describe('buildWidgetInput upcoming trip', () => {
  const upcomingPlan = {
    id: 'trip-1',
    destination: 'Lisbon',
    startDate: '2026-08-01',
    endDate: '2026-08-05',
    days: [
      { date: '2026-08-01', minTempF: 61, maxTempF: 78, dayPhrase: 'Clear', hasPrecipitation: false, articleIds: [] },
      { date: '2026-08-02', minTempF: 60, maxTempF: 74, dayPhrase: 'Rain', hasPrecipitation: true, articleIds: [] },
    ],
    checkedIds: [],
  } as unknown as SavedTripFitPlan;

  const upcoming = (over: Record<string, unknown> = {}) => ({
    plan: upcomingPlan,
    daysUntil: 22,
    totalItems: 12,
    packedItems: 4,
    ...over,
  });

  it('surfaces the arrival-day forecast peek (converted to the user unit) and passes drift through', () => {
    const input = buildWidgetInput(
      baseData({ upcoming: upcoming({ driftNote: 'Forecast colder than when you planned — add a warm layer.' }) }),
    );
    expect(input.upcomingTrip).toMatchObject({
      planId: 'trip-1',
      destination: 'Lisbon',
      daysUntil: 22,
      totalItems: 12,
      packedItems: 4,
      weather: { high: 78, low: 61, unit: 'F', condition: 'Clear', weatherKind: 'clear', precip: false },
      driftNote: 'Forecast colder than when you planned — add a warm layer.',
    });
  });

  it('converts the arrival forecast to metric', () => {
    const input = buildWidgetInput(
      baseData({ settings: metricSettings, upcoming: upcoming() }),
    );
    expect(input.upcomingTrip?.weather).toMatchObject({ high: 26, low: 16, unit: 'C' });
  });

  it('omits the weather peek for a pending trip with no saved days', () => {
    const input = buildWidgetInput(
      baseData({ upcoming: upcoming({ plan: { ...upcomingPlan, days: [] }, totalItems: 0 }) }),
    );
    expect(input.upcomingTrip?.weather).toBeUndefined();
    expect(input.upcomingTrip?.driftNote).toBeUndefined();
  });
});

describe('buildWidgetInput tomorrow block', () => {
  const localTomorrow = (): string => {
    const now = new Date();
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  };

  const tomorrowDay: DailyForecast = {
    date: localTomorrow(),
    minTempF: 58.3,
    maxTempF: 74.2,
    dayPhrase: 'Rain',
    hasPrecipitation: true,
    precipProbability: 70,
  };

  it('maps tomorrow forecast + outfit into the snapshot block (imperial)', () => {
    const input = buildWidgetInput(
      baseData({ tomorrow: { day: tomorrowDay, outfit: outfit('Tomorrow fit') } }),
    );
    expect(input.tomorrow).toMatchObject({
      date: tomorrowDay.date,
      high: 74,
      low: 58,
      unit: 'F',
      weatherKind: 'rain',
      rainChance: 70,
      headline: 'Tomorrow fit',
    });
    expect(input.tomorrow?.dayName).toBe(
      new Date(`${tomorrowDay.date}T12:00:00`).toLocaleDateString('en-US', { weekday: 'long' }),
    );
    expect(input.tomorrow?.items).toHaveLength(2);
  });

  it('converts tomorrow H/L to metric', () => {
    const input = buildWidgetInput(
      baseData({ settings: metricSettings, tomorrow: { day: tomorrowDay, outfit: outfit('Fit') } }),
    );
    expect(input.tomorrow).toMatchObject({ high: 23, low: 15, unit: 'C' });
  });

  it('keeps the weather half but omits the outfit half when no outfit was generated', () => {
    const input = buildWidgetInput(baseData({ tomorrow: { day: tomorrowDay, outfit: null } }));
    expect(input.tomorrow?.high).toBe(74);
    expect(input.tomorrow?.headline).toBeUndefined();
    expect(input.tomorrow?.items).toBeUndefined();
    expect(input.tomorrow?.layerNote).toBeUndefined();
  });

  it('omits the block entirely when tomorrow data is absent', () => {
    expect(buildWidgetInput(baseData()).tomorrow).toBeUndefined();
    expect(buildWidgetInput(baseData({ tomorrow: null })).tomorrow).toBeUndefined();
  });

  it('rides along on the empty mode too', () => {
    const input = buildWidgetInput(
      baseData({
        todayOutfits: [],
        outfitStatus: 'empty_closet',
        tomorrow: { day: tomorrowDay, outfit: null },
      }),
    );
    expect(input.mode).toBe('empty');
    expect(input.tomorrow?.date).toBe(tomorrowDay.date);
  });
});

describe('tomorrowDailyFor', () => {
  const localTomorrow = (): string => {
    const now = new Date();
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  };

  it('finds the strict calendar-tomorrow entry', () => {
    const tm = { ...daily[0], date: localTomorrow() };
    expect(tomorrowDailyFor([daily[0], tm])).toBe(tm);
  });

  it('returns undefined instead of falling back to a wrong day', () => {
    expect(tomorrowDailyFor([daily[0]])).toBeUndefined();
    expect(tomorrowDailyFor([])).toBeUndefined();
    expect(tomorrowDailyFor(undefined)).toBeUndefined();
  });
});
