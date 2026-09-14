/**
 * Orphaned-trip-notification sweep.
 *
 * The bug this closes: every other cancel path needs a live plan id in hand, so
 * a plan that vanished without passing through one — stranded on a signed-out
 * account, or lost with its local storage bucket — left its notifications
 * scheduled forever. They kept firing next to the replacement trip's, one
 * identical 8am nudge per stranded copy.
 */

const mockPending: { identifier: string }[] = [];
const mockCancelled: string[] = [];
const mockStore: Record<string, string> = {};

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

jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  getAllScheduledNotificationsAsync: jest.fn(async () => mockPending),
  cancelScheduledNotificationAsync: jest.fn(async (id: string) => {
    mockCancelled.push(id);
  }),
  cancelAllScheduledNotificationsAsync: jest.fn(async () => {}),
  SchedulableTriggerInputTypes: { DATE: 'date', WEEKLY: 'weekly' },
  AndroidImportance: { DEFAULT: 3 },
}));

import {
  cancelOrphanedTripNotifications,
  cancelAllLocalNotifications,
  awaitNotificationWipe,
} from '../notifications';

const notifMock = jest.requireMock('expo-notifications') as {
  cancelAllScheduledNotificationsAsync: jest.Mock;
};

const TRIP_REGISTRY_KEY = 'ojo_trip_reminder_plan_ids';

const pending = (...identifiers: string[]) => {
  mockPending.length = 0;
  mockPending.push(...identifiers.map(identifier => ({ identifier })));
};

beforeEach(() => {
  mockPending.length = 0;
  mockCancelled.length = 0;
  for (const k of Object.keys(mockStore)) delete mockStore[k];
});

describe('cancelOrphanedTripNotifications', () => {
  it('cancels Trip Mode nudges whose plan no longer exists', async () => {
    pending(
      'ojo_tripmode_gone_2026-09-09',
      'ojo_tripmode_gone_2026-09-10',
      'ojo_tripmode_live_2026-09-10',
    );

    await cancelOrphanedTripNotifications(['live']);

    expect(mockCancelled.sort()).toEqual([
      'ojo_tripmode_gone_2026-09-09',
      'ojo_tripmode_gone_2026-09-10',
    ]);
  });

  it('cancels the packing reminders of a vanished plan too', async () => {
    pending('ojo_trip_gone_wk', 'ojo_trip_gone_2d', 'ojo_trip_live_wk');

    await cancelOrphanedTripNotifications(['live']);

    expect(mockCancelled.sort()).toEqual(['ojo_trip_gone_2d', 'ojo_trip_gone_wk']);
  });

  it('leaves notifications that are not trip notifications alone', async () => {
    pending(
      'ojo_morningbrief_2026-09-10',
      'ojo_weekly_recap',
      'ojo_samedaynudge_2026-09-10_15_0',
    );

    await cancelOrphanedTripNotifications([]);

    expect(mockCancelled).toEqual([]);
  });

  // `ojo_tripmode_` starts with `ojo_trip`, so a prefix test that stopped a
  // character early would read the plan id of `ojo_tripmode_abc_2026-09-10` as
  // "mode_abc" — never matching a live id, and quietly cancelling every live
  // trip's nudges on the first launch after this shipped.
  it('does not confuse the Trip Mode prefix with the reminder prefix', async () => {
    pending('ojo_tripmode_abc_2026-09-10', 'ojo_trip_abc_wk');

    await cancelOrphanedTripNotifications(['abc']);

    expect(mockCancelled).toEqual([]);
  });

  it('round-trips a plan id containing underscores', async () => {
    pending('ojo_tripmode_a_b_c_2026-09-10', 'ojo_trip_a_b_c_2d');

    await cancelOrphanedTripNotifications(['a_b_c']);

    expect(mockCancelled).toEqual([]);
  });

  it('cancels everything when no plans are left', async () => {
    pending('ojo_tripmode_x_2026-09-10', 'ojo_trip_y_wk');

    await cancelOrphanedTripNotifications([]);

    expect(mockCancelled.sort()).toEqual(['ojo_trip_y_wk', 'ojo_tripmode_x_2026-09-10']);
  });

  it('drops dead ids from the packing-reminder registry', async () => {
    mockStore[TRIP_REGISTRY_KEY] = JSON.stringify(['live', 'gone']);

    await cancelOrphanedTripNotifications(['live']);

    expect(JSON.parse(mockStore[TRIP_REGISTRY_KEY])).toEqual(['live']);
  });

  it('leaves the registry untouched when every id is still live', async () => {
    mockStore[TRIP_REGISTRY_KEY] = JSON.stringify(['live', 'alsolive']);

    await cancelOrphanedTripNotifications(['live', 'alsolive']);

    expect(JSON.parse(mockStore[TRIP_REGISTRY_KEY])).toEqual(['live', 'alsolive']);
  });
});

describe('cancelAllLocalNotifications', () => {
  it('clears the packing-reminder registry along with the schedule', async () => {
    mockStore[TRIP_REGISTRY_KEY] = JSON.stringify(['whoever']);

    await cancelAllLocalNotifications();

    expect(notifMock.cancelAllScheduledNotificationsAsync).toHaveBeenCalled();
    expect(mockStore[TRIP_REGISTRY_KEY]).toBeUndefined();
  });

  // Sign-out can't await the wipe — `logout` is synchronous — so the next
  // account's reconcilers wait on this instead. Without it a fast account
  // switch schedules a set the in-flight wipe then deletes.
  it('holds the wipe barrier open until the wipe finishes', async () => {
    let release = () => {};
    notifMock.cancelAllScheduledNotificationsAsync.mockImplementationOnce(
      () => new Promise<void>((resolve) => { release = resolve; }),
    );

    const wipe = cancelAllLocalNotifications();
    let barrierPassed = false;
    const barrier = awaitNotificationWipe().then(() => { barrierPassed = true; });

    await Promise.resolve();
    expect(barrierPassed).toBe(false);

    release();
    await wipe;
    await barrier;
    expect(barrierPassed).toBe(true);
  });

  it('leaves the barrier resolved when no wipe is running', async () => {
    await expect(awaitNotificationWipe()).resolves.toBeUndefined();
  });
});
