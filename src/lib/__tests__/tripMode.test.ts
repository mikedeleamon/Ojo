import { haversineMi } from '../geo';
import {
  selectActiveTrip,
  todayDayIndex,
  findDaySnapshot,
  computeDrift,
  computeForecastDrift,
} from '../tripMode';
import type {
  SavedTripFitPlan,
  TripFitDaySnapshot,
  CurrentWeather,
} from '../../types';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const NYC = { lat: 40.7128, lon: -74.006 };
const NEWARK = { lat: 40.7357, lon: -74.1724 }; // ~9 mi from NYC
const LA = { lat: 34.0522, lon: -118.2437 }; // ~2445 mi from NYC

const day = (date: string, extra: Partial<TripFitDaySnapshot> = {}): TripFitDaySnapshot => ({
  date,
  minTempF: 55,
  maxTempF: 65,
  dayPhrase: 'Clear',
  hasPrecipitation: false,
  articleIds: ['a1', 'a2'],
  ...extra,
});

const trip = (over: Partial<SavedTripFitPlan> = {}): SavedTripFitPlan => ({
  id: over.id ?? 'trip1',
  destination: 'New York',
  lat: NYC.lat,
  lon: NYC.lon,
  startDate: '2026-06-25',
  endDate: '2026-06-29',
  occasion: 'everyday',
  closetId: 'c1',
  days: [day('2026-06-27')],
  checkedIds: [],
  createdAt: '2026-06-01T00:00:00Z',
  updatedAt: '2026-06-01T00:00:00Z',
  ...over,
});

const weather = (tempF: number, hasPrecipitation = false): CurrentWeather =>
  ({
    WeatherText: 'Clear',
    HasPrecipitation: hasPrecipitation,
    IsDayTime: true,
    Temperature: { Imperial: { Value: tempF, Unit: 'F' }, Metric: { Value: 0, Unit: 'C' } },
    RealFeelTemperature: { Imperial: { Value: tempF, Unit: 'F' }, Metric: { Value: 0, Unit: 'C' } },
    Wind: { Speed: { Imperial: { Value: 5 }, Metric: { Value: 8 } } },
    RelativeHumidity: 50,
    UVIndexText: 'Moderate',
  }) as CurrentWeather;

const TODAY = '2026-06-27';

// ─── haversineMi ───────────────────────────────────────────────────────────────

describe('haversineMi', () => {
  it('is zero for the same point', () => {
    expect(haversineMi(NYC, NYC)).toBeCloseTo(0, 5);
  });

  it('matches a known long-distance pair (NYC↔LA ≈ 2445 mi)', () => {
    expect(haversineMi(NYC, LA)).toBeGreaterThan(2400);
    expect(haversineMi(NYC, LA)).toBeLessThan(2500);
  });

  it('matches a known short-distance pair (NYC↔Newark ≈ 9 mi)', () => {
    const d = haversineMi(NYC, NEWARK);
    expect(d).toBeGreaterThan(7);
    expect(d).toBeLessThan(12);
  });
});

// ─── selectActiveTrip ──────────────────────────────────────────────────────────

describe('selectActiveTrip', () => {
  it('returns null when today is outside every trip window', () => {
    expect(selectActiveTrip([trip()], '2026-07-15', NYC, 30)).toBeNull();
  });

  it('confirms location when GPS is within radius', () => {
    const sel = selectActiveTrip([trip()], TODAY, NEWARK, 30);
    expect(sel).not.toBeNull();
    expect(sel!.locationConfirmed).toBe(true);
    expect(sel!.trip.id).toBe('trip1');
    expect(sel!.distanceMi).toBeLessThan(30);
  });

  it('returns null when GPS confirms the user is out of radius', () => {
    const sel = selectActiveTrip([trip()], TODAY, LA, 30);
    expect(sel).toBeNull();
  });

  it('falls back to a date-only prompt when GPS is unavailable', () => {
    const sel = selectActiveTrip([trip()], TODAY, null, 30);
    expect(sel).not.toBeNull();
    expect(sel!.locationConfirmed).toBe(false);
    expect(sel!.distanceMi).toBeNull();
  });

  it('picks the nearest of several overlapping trips', () => {
    const near = trip({ id: 'near', destination: 'Newark', lat: NEWARK.lat, lon: NEWARK.lon });
    const far = trip({ id: 'far', destination: 'LA', lat: LA.lat, lon: LA.lon });
    const sel = selectActiveTrip([far, near], TODAY, NYC, 50);
    expect(sel!.trip.id).toBe('near');
    expect(sel!.locationConfirmed).toBe(true);
  });
});

// ─── todayDayIndex / findDaySnapshot ────────────────────────────────────────────

describe('todayDayIndex', () => {
  it('computes the 1-based day position and total', () => {
    expect(todayDayIndex(trip(), TODAY)).toEqual({ index: 3, total: 5 });
  });
});

describe('findDaySnapshot', () => {
  it('returns the matching day with an outfit', () => {
    expect(findDaySnapshot(trip(), TODAY)?.date).toBe(TODAY);
  });

  it('returns null when the day has no logged articles', () => {
    const t = trip({ days: [day(TODAY, { articleIds: [] })] });
    expect(findDaySnapshot(t, TODAY)).toBeNull();
  });

  it('returns null when the day is absent (pending trip)', () => {
    expect(findDaySnapshot(trip({ days: [] }), TODAY)).toBeNull();
  });
});

// ─── computeDrift ────────────────────────────────────────────────────────────────

describe('computeDrift', () => {
  it('flags warmer-than-planned', () => {
    expect(computeDrift(day(TODAY), weather(85))).toMatch(/Warmer/);
  });

  it('flags colder-than-planned', () => {
    expect(computeDrift(day(TODAY), weather(40))).toMatch(/Colder/);
  });

  it('flags rain that moved in', () => {
    expect(computeDrift(day(TODAY), weather(60, true))).toMatch(/Rain/);
  });

  it('returns null when live weather roughly matches the plan', () => {
    expect(computeDrift(day(TODAY), weather(60))).toBeNull();
  });
});

// ─── computeForecastDrift ──────────────────────────────────────────────────────

describe('computeForecastDrift', () => {
  const saved = { minTempF: 55, maxTempF: 65, hasPrecipitation: false }; // mid 60

  it('flags a warmer fresh forecast', () => {
    expect(computeForecastDrift(saved, { minTempF: 68, maxTempF: 82, hasPrecipitation: false })).toMatch(/warmer/);
  });

  it('flags a colder fresh forecast', () => {
    expect(computeForecastDrift(saved, { minTempF: 40, maxTempF: 52, hasPrecipitation: false })).toMatch(/colder/);
  });

  it('flags rain that entered the forecast', () => {
    expect(computeForecastDrift(saved, { minTempF: 56, maxTempF: 64, hasPrecipitation: true })).toMatch(/Rain now/);
  });

  it('flags rain that cleared from the forecast', () => {
    const wet = { minTempF: 55, maxTempF: 65, hasPrecipitation: true };
    expect(computeForecastDrift(wet, { minTempF: 56, maxTempF: 64, hasPrecipitation: false })).toMatch(/cleared/);
  });

  it('returns null when the fresh forecast still roughly agrees', () => {
    expect(computeForecastDrift(saved, { minTempF: 57, maxTempF: 66, hasPrecipitation: false })).toBeNull();
  });
});
