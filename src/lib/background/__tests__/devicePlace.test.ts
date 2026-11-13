/**
 * The device's last known place: what the background refresh falls back to
 * without a fix of its own, and what the server's weather alerts describe
 * instead of the default city from sign-up.
 *
 * Mostly about two promises: coordinates leave the phone rounded to ~1 km, and
 * a phone that stays put doesn't post its location on every Home load.
 */

const mockStore: Record<string, string> = {};
const mockPost = jest.fn(async (..._args: unknown[]) => ({ data: { success: true } }));

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem:    jest.fn(async (k: string) => mockStore[k] ?? null),
    setItem:    jest.fn(async (k: string, v: string) => { mockStore[k] = v; }),
    removeItem: jest.fn(async (k: string) => { delete mockStore[k]; }),
    clear:      jest.fn(async () => {}),
  },
}));

jest.mock('../../../api/client', () => ({
  __esModule: true,
  default: { post: (...args: unknown[]) => mockPost(...args) },
}));

let mockToken: string | null = 'token';
jest.mock('../../auth', () => ({
  getToken: () => mockToken,
  authHeaders: () => ({}),
}));

import {
  clearDevicePlace,
  isCoordinateLabel,
  isSamePlace,
  readDevicePlace,
  rememberDevicePlace,
} from '../devicePlace';

const REPORTED_KEY = 'ojo_device_place_reported';
const BROOKLYN = { lat: 40.678178, lon: -73.944158, name: 'Brooklyn' };
const posted = () => mockPost.mock.calls.map((c) => c[1]);

beforeEach(() => {
  for (const k of Object.keys(mockStore)) delete mockStore[k];
  mockPost.mockClear();
  mockPost.mockImplementation(async () => ({ data: { success: true } }));
  mockToken = 'token';
});

describe('rememberDevicePlace', () => {
  it('rounds to ~1 km before storing or sending', async () => {
    await rememberDevicePlace(BROOKLYN);
    expect(await readDevicePlace()).toMatchObject({ lat: 40.68, lon: -73.94, name: 'Brooklyn' });
    expect(posted()).toEqual([{ lat: 40.68, lon: -73.94, city: 'Brooklyn' }]);
  });

  it('does not post again while the phone stays put', async () => {
    await rememberDevicePlace(BROOKLYN);
    await rememberDevicePlace({ ...BROOKLYN, lat: BROOKLYN.lat + 0.004 }); // ~400 m
    expect(posted()).toHaveLength(1);
  });

  it('posts a move to a new place', async () => {
    await rememberDevicePlace(BROOKLYN);
    await rememberDevicePlace({ lat: 40.7357, lon: -74.1724, name: 'Newark' });
    expect(posted().map((p) => (p as { city: string }).city)).toEqual(['Brooklyn', 'Newark']);
  });

  it('refreshes an unchanged report before the server stops trusting it', async () => {
    await rememberDevicePlace(BROOKLYN);
    const sent = JSON.parse(mockStore[REPORTED_KEY]);
    mockStore[REPORTED_KEY] = JSON.stringify({ ...sent, at: Date.now() - 7 * 3_600_000 });
    await rememberDevicePlace(BROOKLYN);
    expect(posted()).toHaveLength(2);
  });

  it('retries next time when the post fails', async () => {
    mockPost.mockImplementationOnce(async () => { throw new Error('offline'); });
    await rememberDevicePlace(BROOKLYN);
    await rememberDevicePlace(BROOKLYN);
    expect(posted()).toHaveLength(2);
  });

  it('never sends coordinates as a city name', async () => {
    // What the home screen's geocoder returns when reverse geocoding fails.
    await rememberDevicePlace({ lat: 47.3812, lon: -8.5391, name: '47.38,-8.54' });
    expect((await readDevicePlace())?.name).toBeUndefined();
    expect(posted()).toEqual([{ lat: 47.38, lon: -8.54, city: undefined }]);
  });

  it('still remembers the place when signed out, without posting', async () => {
    mockToken = null;
    await rememberDevicePlace(BROOKLYN);
    expect(await readDevicePlace()).not.toBeNull();
    expect(posted()).toHaveLength(0);
  });
});

describe('isCoordinateLabel', () => {
  it('spots a bare coordinate pair and leaves real names alone', () => {
    expect(isCoordinateLabel('47.38,-8.54')).toBe(true);
    expect(isCoordinateLabel(' -33.9 , 151.2 ')).toBe(true);
    expect(isCoordinateLabel('Brooklyn')).toBe(false);
    expect(isCoordinateLabel('Route 66, 2')).toBe(false);
  });
});

describe('isSamePlace', () => {
  it('treats grid-rounding jitter as the same place and a town over as different', () => {
    expect(isSamePlace({ lat: 40.68, lon: -73.94 }, { lat: 40.69, lon: -73.94 })).toBe(true);
    expect(isSamePlace({ lat: 40.68, lon: -73.94 }, { lat: 40.74, lon: -74.17 })).toBe(false);
  });
});

describe('clearDevicePlace', () => {
  it('forgets the place and the report, so the next account starts clean', async () => {
    await rememberDevicePlace(BROOKLYN);
    await clearDevicePlace();
    expect(await readDevicePlace()).toBeNull();
    expect(mockStore[REPORTED_KEY]).toBeUndefined();
  });
});
