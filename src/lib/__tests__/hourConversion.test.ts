/**
 * localHourToUTC / utcHourToLocal.
 *
 * The property that matters is INVERTIBILITY, not just "returns a number".
 * The original implementation added the raw timezone offset, which produced a
 * fractional UTC hour in the sub-hour zones (India +5:30 stored 8am as 2.5).
 * Two things broke on that value, both silently: the server's hourly cron
 * matches `morningBriefHourUTC` against an integer getUTCHours(), so a
 * fractional hour matched nothing and the closet-gap nudge never fired; and
 * the round trip wasn't stable, so re-saving walked the hour forward.
 *
 * Rounding the SUM does not fix it — round(2.5)=3 converts back to
 * round(8.5)=9, which drifts an hour on every save/load cycle. Only quantising
 * the OFFSET makes the pair exact inverses. That is what these tests pin.
 */

// notifications.ts pulls in the Expo/RN notification stack at module load;
// none of it is reachable from the two pure conversion helpers under test.
jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  SchedulableTriggerInputTypes: { DATE: 'date', WEEKLY: 'weekly' },
  AndroidImportance: { DEFAULT: 3 },
}));
jest.mock('expo-constants', () => ({ __esModule: true, default: { expoConfig: {} } }));
jest.mock('react-native', () => ({ Platform: { OS: 'ios' } }));
jest.mock('../../api/client', () => ({ __esModule: true, default: { get: jest.fn(), post: jest.fn() } }));

import { localHourToUTC, utcHourToLocal } from '../notifications';

/** Run `fn` as if the device sat in a zone with this getTimezoneOffset(). */
const inZone = (offsetMinutes: number, fn: () => void) => {
  const spy = jest
    .spyOn(Date.prototype, 'getTimezoneOffset')
    .mockReturnValue(offsetMinutes);
  try {
    fn();
  } finally {
    spy.mockRestore();
  }
};

// getTimezoneOffset() is positive when BEHIND UTC, so UTC+5:30 reports -330.
const ZONES: [string, number][] = [
  ['UTC',                 0],
  ['New York  UTC-5:00',  300],
  ['Tokyo     UTC+9:00', -540],
  ['India     UTC+5:30', -330],
  ['Nepal     UTC+5:45', -345],
  ['Adelaide  UTC+9:30', -570],
  ['Newfoundl UTC-3:30',  210],
  ['Chatham  UTC+12:45', -765],
];

describe('localHourToUTC / utcHourToLocal', () => {
  describe.each(ZONES)('%s', (_name, offset) => {
    it('always yields a whole hour in 0–23', () => {
      inZone(offset, () => {
        for (let h = 0; h < 24; h++) {
          const utc = localHourToUTC(h);
          expect(Number.isInteger(utc)).toBe(true);
          expect(utc).toBeGreaterThanOrEqual(0);
          expect(utc).toBeLessThanOrEqual(23);

          const local = utcHourToLocal(h);
          expect(Number.isInteger(local)).toBe(true);
          expect(local).toBeGreaterThanOrEqual(0);
          expect(local).toBeLessThanOrEqual(23);
        }
      });
    });

    it('round-trips every hour exactly', () => {
      inZone(offset, () => {
        for (let h = 0; h < 24; h++) {
          expect(utcHourToLocal(localHourToUTC(h))).toBe(h);
        }
      });
    });

    it('does not drift across repeated save/load cycles', () => {
      inZone(offset, () => {
        for (let h = 0; h < 24; h++) {
          // Open the screen, save it again, ten times over. The stored hour
          // must not creep — this is the case rounding the sum got wrong.
          let stored = localHourToUTC(h);
          for (let i = 0; i < 10; i++) {
            stored = localHourToUTC(utcHourToLocal(stored));
          }
          expect(stored).toBe(localHourToUTC(h));
        }
      });
    });
  });

  it('maps whole-hour zones exactly, with no rounding applied', () => {
    // Tokyo 9am is UTC midnight — the value the server used to coerce to 12
    // because `Number(v) || 12` treats 0 as missing.
    inZone(-540, () => expect(localHourToUTC(9)).toBe(0));
    inZone(300,  () => expect(localHourToUTC(8)).toBe(13));
  });
});
