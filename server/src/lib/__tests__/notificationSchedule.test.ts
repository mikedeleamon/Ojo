/**
 * Who fires on a given cron tick.
 *
 * The two properties under test are the ones the DST fix rests on:
 *
 *  1. `scheduledUtcHour` answers from the ZONE when the account has one, and
 *     only falls back to the stored (DST-perishable) UTC hour when it doesn't.
 *
 *  2. `candidateHours` is a superset of whatever `scheduledUtcHour` will accept.
 *     The cron narrows the Mongo query to ±1 hour for cost, then filters
 *     exactly. If the window could ever miss a genuinely-due user, that user
 *     silently stops receiving notifications — the exact failure mode this
 *     whole change exists to remove. The sweep at the bottom is the guarantee.
 */

import {
  candidateHours,
  healedHour,
  scheduledUtcHour,
  type ScheduledUser,
} from '../notificationSchedule';

const SUMMER = new Date('2026-07-15T12:00:00Z');
const WINTER = new Date('2026-01-15T12:00:00Z');

const user = (u: {
  tz?: string | null;
  local?: number | null;
  utc?: number | null;
}): ScheduledUser => ({
  settings: u.tz === undefined ? {} : { timeZone: u.tz },
  notificationSettings: {
    morningBriefHourUTC:   u.utc   ?? null,
    morningBriefHourLocal: u.local ?? null,
  },
});

describe('scheduledUtcHour', () => {
  it('derives from the zone when both halves are present', () => {
    // 8am Berlin is 06:00Z in summer and 07:00Z in winter. A stored offset
    // cannot express both; this is the bug the change fixes.
    const berlin = user({ tz: 'Europe/Berlin', local: 8, utc: 6 });
    expect(scheduledUtcHour(berlin, 0, SUMMER)).toBe(6);
    expect(scheduledUtcHour(berlin, 0, WINTER)).toBe(7);
  });

  it('ignores a stale stored utc hour once a zone is known', () => {
    // Saved in summer (6), read in winter. The zone wins.
    expect(scheduledUtcHour(user({ tz: 'Europe/Berlin', local: 8, utc: 6 }), 0, WINTER)).toBe(7);
  });

  it('applies the afternoon offset on the LOCAL clock, not the UTC one', () => {
    // 8am + 6h = 2pm Berlin = 12:00Z in summer. Offsetting the UTC hour instead
    // would be right here by luck but wrong the moment DST differs at the two
    // hours, so it is pinned explicitly.
    expect(scheduledUtcHour(user({ tz: 'Europe/Berlin', local: 8, utc: 6 }), 6, SUMMER)).toBe(12);
    expect(scheduledUtcHour(user({ tz: 'Asia/Tokyo', local: 8, utc: 23 }), 6, SUMMER)).toBe(5);
  });

  it('wraps the local hour past midnight rather than overflowing', () => {
    // 21:00 + 6h = 03:00 the next day, still a valid 0–23 hour.
    expect(scheduledUtcHour(user({ tz: 'UTC', local: 21, utc: 21 }), 6, SUMMER)).toBe(3);
  });

  it('falls back to the stored utc hour when the zone is missing', () => {
    expect(scheduledUtcHour(user({ tz: null, local: 8, utc: 6 }), 0, WINTER)).toBe(6);
    expect(scheduledUtcHour(user({ local: 8, utc: 6 }), 0, WINTER)).toBe(6);
  });

  it('falls back when the local hour is missing, even with a zone', () => {
    // Registering a push token seeds the zone but never the local hour, so this
    // combination is the common state for an account that has not re-saved.
    expect(scheduledUtcHour(user({ tz: 'Europe/Berlin', utc: 6 }), 0, WINTER)).toBe(6);
  });

  it('falls back rather than throwing on a junk zone', () => {
    // Client-supplied; an unhandled RangeError here would abort the pass for
    // every other user in the same tick.
    expect(scheduledUtcHour(user({ tz: 'Mars/Olympus', local: 8, utc: 6 }), 0, SUMMER)).toBe(6);
  });

  it('returns null when there is nothing usable to schedule from', () => {
    expect(scheduledUtcHour(user({}), 0, SUMMER)).toBeNull();
    expect(scheduledUtcHour({ notificationSettings: null }, 0, SUMMER)).toBeNull();
    // A fractional legacy value matches no integer getUTCHours(), so it must be
    // rejected rather than silently scheduled onto a slot that never fires.
    expect(scheduledUtcHour(user({ utc: 2.5 }), 0, SUMMER)).toBeNull();
  });
});

describe('healedHour', () => {
  it('reports the corrected hour when the stored one has drifted', () => {
    expect(healedHour(user({ tz: 'Europe/Berlin', local: 8, utc: 6 }), WINTER)).toBe(7);
  });

  it('reports null when the stored hour is already right', () => {
    expect(healedHour(user({ tz: 'Europe/Berlin', local: 8, utc: 6 }), SUMMER)).toBeNull();
    expect(healedHour(user({ tz: null, local: 8, utc: 6 }), WINTER)).toBeNull();
  });
});

describe('candidateHours', () => {
  it('is a ±1 window around the offset base, wrapped into 0–23', () => {
    expect(candidateHours(12, 0).sort((a, b) => a - b)).toEqual([11, 12, 13]);
    expect(candidateHours(12, 6).sort((a, b) => a - b)).toEqual([5, 6, 7]);
    expect(candidateHours(0, 0).sort((a, b) => a - b)).toEqual([0, 1, 23]);
    expect(candidateHours(2, 6).sort((a, b) => a - b)).toEqual([19, 20, 21]);
  });

  it('only ever yields whole hours in range', () => {
    for (let h = 0; h < 24; h++) {
      for (const off of [0, 6]) {
        for (const c of candidateHours(h, off)) {
          expect(Number.isInteger(c)).toBe(true);
          expect(c).toBeGreaterThanOrEqual(0);
          expect(c).toBeLessThanOrEqual(23);
        }
      }
    }
  });

  // ── The property that makes the narrowed query safe ─────────────────────────
  it('never excludes a user that scheduledUtcHour would accept', () => {
    // Simulates the real pipeline: the client stored a UTC hour computed at some
    // earlier date (SUMMER), the cron runs later (WINTER) and queries the ±1
    // window, then filters exactly. Every user due at the tick must survive both
    // steps — in both DST directions, in zones on either side of the meridian
    // and on sub-hour offsets.
    const zones = [
      'Europe/Berlin', 'Europe/London', 'America/New_York', 'America/Los_Angeles',
      'America/St_Johns', 'Australia/Sydney', 'Australia/Adelaide', 'Asia/Tokyo',
      'Asia/Kolkata', 'Asia/Kathmandu', 'Pacific/Chatham', 'America/Santiago',
    ];
    for (const [savedAt, runAt] of [[SUMMER, WINTER], [WINTER, SUMMER]] as const) {
      for (const tz of zones) {
        for (let local = 0; local < 24; local++) {
          // What the client would have written on `savedAt`.
          const stored = scheduledUtcHour({
            settings: { timeZone: tz },
            notificationSettings: { morningBriefHourLocal: local, morningBriefHourUTC: null },
          }, 0, savedAt)!;

          const u = user({ tz, local, utc: stored });

          for (const offsetH of [0, 6]) {
            const due = scheduledUtcHour(u, offsetH, runAt)!;
            // At the tick this user is due, is their stored hour in the window?
            const window = candidateHours(due, offsetH);
            expect({ tz, local, offsetH, savedAt: savedAt.toISOString(), inWindow: window.includes(stored) })
              .toEqual({ tz, local, offsetH, savedAt: savedAt.toISOString(), inWindow: true });
          }
        }
      }
    }
  });
});
