/**
 * Trip Mode's 8am nudges are scheduled ahead and fire without knowing where
 * the phone is. They used to read "Good morning in <city>!" on every trip
 * date, so someone still at home — or who never took the trip — got one each
 * morning. Now the titles name the trip rather than the user's location, and
 * only the first morning goes by date: the rest wait for Trip Mode's GPS check
 * to confirm the device reached the trip city.
 */

const mockStore: Record<string, string> = {};
const mockPending = new Map<string, { title: string; body: string }>();

jest.mock('react-native', () => ({ Platform: { OS: 'ios' } }));
jest.mock('expo-constants', () => ({ __esModule: true, default: { expoConfig: {} } }));
jest.mock('../../api/client', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn(), delete: jest.fn() },
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem:    jest.fn(async (k: string) => mockStore[k] ?? null),
    setItem:    jest.fn(async (k: string, v: string) => { mockStore[k] = v; }),
    removeItem: jest.fn(async (k: string) => { delete mockStore[k]; }),
    clear:      jest.fn(async () => {}),
  },
}));

// Stateful, so tests assert what is actually left pending after cancels and
// re-schedules, the way iOS would hold it.
jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  getPermissionsAsync: jest.fn(async () => ({ status: 'granted' })),
  getAllScheduledNotificationsAsync: jest.fn(async () =>
    [...mockPending.keys()].map(identifier => ({ identifier })),
  ),
  cancelScheduledNotificationAsync: jest.fn(async (id: string) => { mockPending.delete(id); }),
  cancelAllScheduledNotificationsAsync: jest.fn(async () => { mockPending.clear(); }),
  scheduleNotificationAsync: jest.fn(
    async (req: { identifier: string; content: { title: string; body: string } }) => {
      mockPending.set(req.identifier, req.content);
    },
  ),
  SchedulableTriggerInputTypes: { DATE: 'date', WEEKLY: 'weekly' },
  AndroidImportance: { DEFAULT: 3 },
}));

import {
  scheduleTripMorningNotifications,
  setTripNudgePresence,
  tripMorningTitle,
  cancelAllLocalNotifications,
  TRIP_MODE_MORNING_PREF_KEY,
} from '../notifications';

const trip = {
  id: 'p1',
  destination: 'Jersey City',
  startDate: '2026-09-19',
  endDate: '2026-09-21',
};

const otherTrip = {
  id: 'p2',
  destination: 'Ocho Rios',
  startDate: '2026-09-19',
  endDate: '2026-09-20',
};

/** Pending titles, oldest date first. */
const titles = () =>
  [...mockPending.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, content]) => content.title);

/** Let pending promise chains run; fake timers leave plain promises alone. */
const flush = async (turns = 50) => {
  for (let i = 0; i < turns; i++) await Promise.resolve();
};

const ALL_THREE = [
  'Your Jersey City trip starts today 🧳',
  'Day 2 of your Jersey City trip 🧳',
  'Day 3 of your Jersey City trip 🧳',
];

beforeEach(() => {
  mockPending.clear();
  for (const k of Object.keys(mockStore)) delete mockStore[k];
  mockStore[TRIP_MODE_MORNING_PREF_KEY] = 'true';
  jest.useFakeTimers();
  // The evening before the trip, so every morning is still ahead.
  jest.setSystemTime(new Date('2026-09-18T20:00:00'));
});

afterEach(() => jest.useRealTimers());

describe('tripMorningTitle', () => {
  it('names the trip on day one instead of placing the user in the city', () => {
    expect(tripMorningTitle('Jersey City', 1)).toBe('Your Jersey City trip starts today 🧳');
  });

  it('counts the days after that', () => {
    expect(tripMorningTitle('Jersey City', 3)).toBe('Day 3 of your Jersey City trip 🧳');
  });
});

describe('scheduleTripMorningNotifications', () => {
  it('schedules only the first morning until GPS confirms the trip', async () => {
    await scheduleTripMorningNotifications(trip);

    expect(titles()).toEqual(['Your Jersey City trip starts today 🧳']);
  });

  it('schedules every morning of a confirmed trip, none claiming where the user is', async () => {
    await setTripNudgePresence('p1', [trip]);
    await scheduleTripMorningNotifications(trip);

    expect(titles()).toEqual(ALL_THREE);
    for (const t of titles()) expect(t).not.toMatch(/good morning in/i);
  });

  it('keeps real day numbers when earlier days have already passed', async () => {
    await setTripNudgePresence('p1', [trip]);
    // Day two, after its 8am nudge: only day three is still ahead.
    jest.setSystemTime(new Date('2026-09-20T09:00:00'));

    await scheduleTripMorningNotifications(trip);

    expect([...mockPending.keys()]).toEqual(['ojo_tripmode_p1_2026-09-21']);
    expect(titles()).toEqual(['Day 3 of your Jersey City trip 🧳']);
  });

  it('does nothing when the nudge is switched off, confirmed or not', async () => {
    mockStore[TRIP_MODE_MORNING_PREF_KEY] = 'false';
    await setTripNudgePresence('p1', [trip]);
    await scheduleTripMorningNotifications(trip);

    expect(titles()).toEqual([]);
  });
});

describe('setTripNudgePresence', () => {
  it('schedules the remaining mornings once GPS confirms the trip city', async () => {
    await scheduleTripMorningNotifications(trip);
    await setTripNudgePresence('p1', [trip]);

    expect(titles()).toEqual(ALL_THREE);
  });

  it('withdraws the later mornings when GPS puts the user elsewhere', async () => {
    await setTripNudgePresence('p1', [trip]);
    await setTripNudgePresence(null, [trip]);

    // The first morning is still ahead and still true, so it stays.
    expect(titles()).toEqual(['Your Jersey City trip starts today 🧳']);
  });

  it('brings them back when the user turns up after all', async () => {
    await setTripNudgePresence('p1', [trip]);
    await setTripNudgePresence(null, [trip]);
    await setTripNudgePresence('p1', [trip]);

    expect(titles()).toEqual(ALL_THREE);
  });

  it('moves the later mornings to whichever trip GPS confirms', async () => {
    await setTripNudgePresence('p1', [trip, otherTrip]);
    await scheduleTripMorningNotifications(otherTrip);
    await setTripNudgePresence('p2', [trip, otherTrip]);

    expect(titles()).toEqual([
      'Your Jersey City trip starts today 🧳',
      'Your Ocho Rios trip starts today 🧳',
      'Day 2 of your Ocho Rios trip 🧳',
    ]);
  });

  it('is a no-op when the verdict has not changed', async () => {
    await setTripNudgePresence(null, [trip]);

    expect(titles()).toEqual([]);
  });

  it('lets a verdict that lands mid-reschedule win', async () => {
    // App open: the plans reconcile reschedules the trip while Trip Mode's
    // GPS check reports the user isn't there. Hold the reschedule at its
    // first notification — after it has read "confirmed" — so the verdict
    // lands in between. Without serialising the two, the reschedule then
    // re-adds the later mornings the verdict just withdrew.
    await setTripNudgePresence('p1', [trip]);
    const schedule = jest.requireMock('expo-notifications')
      .scheduleNotificationAsync as jest.Mock;
    let release!: () => void;
    const held = new Promise<void>(resolve => { release = resolve; });
    schedule.mockImplementationOnce(
      async (req: { identifier: string; content: { title: string; body: string } }) => {
        await held;
        mockPending.set(req.identifier, req.content);
      },
    );
    const callsBefore = schedule.mock.calls.length;

    const reschedule = scheduleTripMorningNotifications(trip);
    await flush();
    expect(schedule.mock.calls.length).toBe(callsBefore + 1);

    const verdict = setTripNudgePresence(null, [trip]);
    await flush();
    release();
    await Promise.all([reschedule, verdict]);

    expect(titles()).toEqual(['Your Jersey City trip starts today 🧳']);
  });
});

describe('sign-out', () => {
  it('forgets the confirmed trip, so the next account starts unconfirmed', async () => {
    await setTripNudgePresence('p1', [trip]);
    await cancelAllLocalNotifications();

    await scheduleTripMorningNotifications(trip);

    expect(titles()).toEqual(['Your Jersey City trip starts today 🧳']);
  });
});
