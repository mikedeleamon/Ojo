/**
 * Trip Mode's resolution, now shared by the home screen and the background
 * refresh. Pins the behaviour moved out of hooks/useTripMode: when GPS is
 * asked for at all, and what each outcome tells the presence reports.
 */

const mockGet = jest.fn();
jest.mock('../../api/client', () => ({
  __esModule: true,
  default: { get: (...args: unknown[]) => mockGet(...args) },
}));
jest.mock('../auth', () => ({ authHeaders: () => ({}) }));
const mockReport = jest.fn(async (..._a: unknown[]) => {});
jest.mock('../tripPresence', () => ({ reportTripPresence: (...a: unknown[]) => mockReport(...a) }));
const mockNudge = jest.fn(async (..._a: unknown[]) => {});
jest.mock('../notifications', () => ({ setTripNudgePresence: (...a: unknown[]) => mockNudge(...a) }));

import { applyTripPresence, nextUpcomingTrip, resolveTripMode } from '../tripModeResolve';
import type { Closet, SavedTripFitPlan, Settings } from '../../types';

const NYC = { lat: 40.7128, lon: -74.006 };
const LA = { lat: 34.0522, lon: -118.2437 };
const TODAY = '2026-06-27';

const trip = (over: Partial<SavedTripFitPlan> = {}): SavedTripFitPlan => ({
  id: 'trip1',
  destination: 'New York',
  lat: NYC.lat,
  lon: NYC.lon,
  startDate: '2026-06-25',
  endDate: '2026-06-29',
  occasion: 'everyday',
  closetId: 'c1',
  days: [],
  checkedIds: [],
  createdAt: '2026-06-01T00:00:00Z',
  updatedAt: '2026-06-01T00:00:00Z',
  ...over,
});

const closets = [{ _id: 'c1', name: 'Home', isPreferred: true, articles: [] }] as unknown as Closet[];
const settings = {} as Settings;

beforeEach(() => {
  mockGet.mockReset();
  mockGet.mockResolvedValue({ data: [] });
  mockReport.mockClear();
  mockNudge.mockClear();
});

describe('resolveTripMode', () => {
  it('never asks for GPS when no trip covers today', async () => {
    const getGps = jest.fn(async () => NYC);
    const res = await resolveTripMode({
      plans: [trip({ startDate: '2026-07-10', endDate: '2026-07-12' })],
      closets,
      settings,
      getGps,
      todayISO: TODAY,
    });
    expect(getGps).not.toHaveBeenCalled();
    expect(res.state.active).toBe(false);
    expect(res.presence).toBeNull();
  });

  it('withdraws presence when Trip Mode is off', async () => {
    const res = await resolveTripMode({
      plans: [trip()],
      closets,
      settings: { tripModeEnabled: false } as Settings,
      getGps: async () => NYC,
      todayISO: TODAY,
    });
    expect(res.state.active).toBe(false);
    expect(res.presence).toBeNull();
  });

  it('confirms the trip when GPS puts the phone there', async () => {
    const res = await resolveTripMode({ plans: [trip()], closets, settings, getGps: async () => NYC, todayISO: TODAY });
    expect(res.state).toMatchObject({ active: true, locationConfirmed: true, dayIndex: 3, total: 5 });
    expect(res.presence).toBe('trip1');
  });

  it('shows the trip by date without vouching for it when there is no fix', async () => {
    const res = await resolveTripMode({ plans: [trip()], closets, settings, getGps: async () => null, todayISO: TODAY });
    expect(res.state).toMatchObject({ active: true, locationConfirmed: false });
    expect(res.presence).toBeUndefined();
  });

  it('reports none when GPS puts the phone at no trip city', async () => {
    const res = await resolveTripMode({ plans: [trip()], closets, settings, getGps: async () => LA, todayISO: TODAY });
    expect(res.state.active).toBe(false);
    expect(res.presence).toBeNull();
  });
});

describe('applyTripPresence', () => {
  it('sends a verdict to both consumers and stays quiet without one', () => {
    applyTripPresence(undefined, []);
    expect(mockReport).not.toHaveBeenCalled();
    applyTripPresence('trip1', []);
    expect(mockReport).toHaveBeenCalledWith('trip1');
    expect(mockNudge).toHaveBeenCalledWith('trip1', []);
  });
});

describe('nextUpcomingTrip', () => {
  it('picks the soonest trip that has not started, unless Trip Mode is off', () => {
    const soon = trip({ id: 'soon', startDate: '2099-01-05', endDate: '2099-01-07' });
    const later = trip({ id: 'later', startDate: '2099-03-01', endDate: '2099-03-03' });
    expect(nextUpcomingTrip([later, soon], settings)?.plan.id).toBe('soon');
    expect(nextUpcomingTrip([later, soon], { tripModeEnabled: false })).toBeNull();
  });
});
