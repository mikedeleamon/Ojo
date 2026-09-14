/**
 * Reporting the device's trip presence to the server.
 *
 * This is called on every Trip Mode resolution — which happens on every app
 * foreground, and whenever plans, closets or settings change — so nearly all of
 * this file is about which of those calls must NOT become a request.
 */

const mockStore: Record<string, string> = {};
const mockPost = jest.fn(async () => ({ data: { success: true } }));

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem:    jest.fn(async (k: string) => mockStore[k] ?? null),
    setItem:    jest.fn(async (k: string, v: string) => { mockStore[k] = v; }),
    removeItem: jest.fn(async (k: string) => { delete mockStore[k]; }),
    clear:      jest.fn(async () => {}),
  },
}));

jest.mock('../../api/client', () => ({
  __esModule: true,
  default: { post: (...args: unknown[]) => mockPost(...(args as [])) },
}));

let mockToken: string | null = 'token';
jest.mock('../auth', () => ({
  getToken: () => mockToken,
  authHeaders: () => ({}),
}));

import { reportTripPresence, clearTripPresenceCache } from '../tripPresence';

const PRESENCE_KEY = 'ojo_trip_presence_sent';

const seedSent = (tripId: string | null, agoMs: number) => {
  mockStore[PRESENCE_KEY] = JSON.stringify({ tripId, at: Date.now() - agoMs });
};

const postedIds = () => mockPost.mock.calls.map((c: unknown[]) => (c[1] as { tripId: string | null }).tripId);

beforeEach(() => {
  for (const k of Object.keys(mockStore)) delete mockStore[k];
  mockPost.mockClear();
  mockPost.mockImplementation(async () => ({ data: { success: true } }));
  mockToken = 'token';
});

describe('reportTripPresence', () => {
  it('posts a confirmation the first time', async () => {
    await reportTripPresence('trip-1');
    expect(postedIds()).toEqual(['trip-1']);
  });

  it('does not post the same confirmation again', async () => {
    await reportTripPresence('trip-1');
    await reportTripPresence('trip-1');
    await reportTripPresence('trip-1');
    expect(postedIds()).toEqual(['trip-1']);
  });

  // The server expires a confirmation it hasn't heard about, so a standing one
  // has to be renewed or a long trip goes quiet mid-way through.
  it('refreshes a standing confirmation once it ages', async () => {
    seedSent('trip-1', 7 * 60 * 60 * 1_000);
    await reportTripPresence('trip-1');
    expect(postedIds()).toEqual(['trip-1']);
  });

  it('posts immediately when the trip changes', async () => {
    await reportTripPresence('trip-1');
    await reportTripPresence('trip-2');
    expect(postedIds()).toEqual(['trip-1', 'trip-2']);
  });

  it('posts a clear once something has been confirmed', async () => {
    await reportTripPresence('trip-1');
    await reportTripPresence(null);
    expect(postedIds()).toEqual(['trip-1', null]);
  });

  it('does not repeat a clear', async () => {
    await reportTripPresence('trip-1');
    await reportTripPresence(null);
    await reportTripPresence(null);
    expect(postedIds()).toEqual(['trip-1', null]);
  });

  // The overwhelmingly common case: someone with no trips resolves Trip Mode on
  // every foreground. Clearing something never set is not worth a request.
  it('never posts for a user who has confirmed nothing', async () => {
    await reportTripPresence(null);
    await reportTripPresence(null);
    expect(mockPost).not.toHaveBeenCalled();
  });

  it('stays quiet when signed out', async () => {
    mockToken = null;
    await reportTripPresence('trip-1');
    expect(mockPost).not.toHaveBeenCalled();
  });

  it('leaves the cache alone when the post fails, so the next call retries', async () => {
    mockPost.mockImplementationOnce(async () => { throw new Error('offline'); });

    await reportTripPresence('trip-1');
    expect(mockStore[PRESENCE_KEY]).toBeUndefined();

    await reportTripPresence('trip-1');
    expect(postedIds()).toEqual(['trip-1', 'trip-1']);
  });
});

describe('clearTripPresenceCache', () => {
  it('makes the next report post again', async () => {
    await reportTripPresence('trip-1');
    await clearTripPresenceCache();
    await reportTripPresence('trip-1');
    expect(postedIds()).toEqual(['trip-1', 'trip-1']);
  });
});
