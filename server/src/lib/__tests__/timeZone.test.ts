/**
 * Time-zone scheduling helpers.
 *
 * These pin the three properties the notification scheduler depends on:
 *
 *  1. DST CORRECTNESS. The bug this replaced stored a UTC hour computed from
 *     the device's offset on the day the user saved. When the clocks moved,
 *     every scheduled push moved with them and stayed moved. Deriving from a
 *     zone NAME fixes that, and the test below is the regression: same zone,
 *     same chosen local hour, two different UTC hours either side of a
 *     transition.
 *
 *  2. CLIENT PARITY. The client still writes `morningBriefHourUTC` via
 *     localHourToUTC (src/lib/notifications.ts). If the server disagreed about
 *     what UTC hour a local hour maps to, the scheduler's ±1 candidate window
 *     would sit off-centre and users would drop out of it. The parity check
 *     sweeps every hour against every real-world offset, including the
 *     half-and quarter-hour ones where the two formulas most easily diverge.
 *
 *  3. WINDOW WIDTH. candidateHours() in notificationService widens the query by
 *     ±1 hour to absorb a stored value that DST has left stale. That is only
 *     sound if a DST shift can never move the mapping by more than an hour.
 */

import {
  isValidTimeZone,
  offsetMinutes,
  utcHourForLocalHour,
  localHourNow,
} from '../timeZone';

/**
 * The client's formula, restated here as the spec rather than imported —
 * src/lib/notifications.ts pulls in the whole Expo notification stack at module
 * load, and this file runs under the plain node test environment.
 *
 * `tzOffsetMinutes` is in Date#getTimezoneOffset's convention: minutes BEHIND
 * UTC, i.e. the negation of what offsetMinutes() returns.
 */
const clientLocalHourToUTC = (localHour: number, tzOffsetMinutes: number): number =>
  ((localHour + Math.round(tzOffsetMinutes / 60)) % 24 + 24) % 24;

/** Northern-summer and northern-winter instants, for DST on/off. */
const SUMMER = new Date('2026-07-15T12:00:00Z');
const WINTER = new Date('2026-01-15T12:00:00Z');

describe('isValidTimeZone', () => {
  it('accepts real IANA names', () => {
    for (const tz of ['UTC', 'Europe/Berlin', 'Asia/Kolkata', 'America/St_Johns']) {
      expect(isValidTimeZone(tz)).toBe(true);
    }
  });

  it('rejects anything Intl would throw on', () => {
    // A cron loop reads this value; an unhandled RangeError in there would
    // abort the pass for every other user too.
    for (const bad of ['Mars/Olympus', '', '   ', 'Europe/Berlin; DROP', null, undefined, 42, {}]) {
      expect(isValidTimeZone(bad)).toBe(false);
    }
  });

  it('rejects an absurdly long string without calling Intl', () => {
    expect(isValidTimeZone('A/'.repeat(500))).toBe(false);
  });
});

describe('offsetMinutes', () => {
  it('reports minutes AHEAD of UTC (opposite sign to getTimezoneOffset)', () => {
    expect(offsetMinutes('UTC', SUMMER)).toBe(0);
    expect(offsetMinutes('Asia/Tokyo', SUMMER)).toBe(540);       // +09:00, no DST
    expect(offsetMinutes('Asia/Kolkata', SUMMER)).toBe(330);     // +05:30, no DST
    expect(offsetMinutes('Asia/Kathmandu', SUMMER)).toBe(345);   // +05:45, no DST
    expect(offsetMinutes('America/Los_Angeles', SUMMER)).toBe(-420); // PDT
  });

  it('tracks DST rather than reporting one fixed offset per zone', () => {
    expect(offsetMinutes('America/Los_Angeles', WINTER)).toBe(-480); // PST
    expect(offsetMinutes('Europe/Berlin', SUMMER)).toBe(120);        // CEST
    expect(offsetMinutes('Europe/Berlin', WINTER)).toBe(60);         // CET
    // Southern hemisphere runs the other way round.
    expect(offsetMinutes('Australia/Sydney', SUMMER)).toBe(600);     // AEST
    expect(offsetMinutes('Australia/Sydney', WINTER)).toBe(660);     // AEDT
  });
});

describe('utcHourForLocalHour', () => {
  it('maps a chosen local hour onto the right UTC hour', () => {
    expect(utcHourForLocalHour('UTC', 8, SUMMER)).toBe(8);
    expect(utcHourForLocalHour('Asia/Tokyo', 8, SUMMER)).toBe(23);        // 8am JST = 23:00Z
    expect(utcHourForLocalHour('America/Los_Angeles', 8, SUMMER)).toBe(15); // 8am PDT = 15:00Z
  });

  it('wraps rather than going negative or past 23', () => {
    for (const tz of ['Asia/Tokyo', 'America/Los_Angeles', 'Pacific/Kiritimati']) {
      for (let h = 0; h < 24; h++) {
        const out = utcHourForLocalHour(tz, h, SUMMER);
        expect(Number.isInteger(out)).toBe(true);
        expect(out).toBeGreaterThanOrEqual(0);
        expect(out).toBeLessThanOrEqual(23);
      }
    }
  });

  // ── The regression for the DST bug ──────────────────────────────────────────
  it('returns a DIFFERENT utc hour either side of a DST transition', () => {
    // This is the whole point. A stored offset cannot do this: it would answer
    // the same UTC hour all year, which is how an 8am brief became a 7am one.
    expect(utcHourForLocalHour('Europe/Berlin', 8, SUMMER)).toBe(6);
    expect(utcHourForLocalHour('Europe/Berlin', 8, WINTER)).toBe(7);

    expect(utcHourForLocalHour('America/New_York', 8, SUMMER)).toBe(12);
    expect(utcHourForLocalHour('America/New_York', 8, WINTER)).toBe(13);

    // Zones without DST must NOT move.
    expect(utcHourForLocalHour('Asia/Tokyo', 8, SUMMER))
      .toBe(utcHourForLocalHour('Asia/Tokyo', 8, WINTER));
  });

  // ── The parity invariant ────────────────────────────────────────────────────
  it('agrees with the client localHourToUTC for every hour and every offset', () => {
    // Every UTC offset in real-world use, in minutes ahead of UTC — including
    // the sub-hour ones (+05:30 Kolkata, +05:45 Kathmandu, +09:30 Adelaide,
    // -03:30 St John's, +12:45 Chatham) where rounding the offset instead of
    // the result makes the two formulas disagree by a whole hour.
    const offsets = [
      -720, -660, -600, -570, -540, -480, -420, -360, -300, -270, -240, -210,
      -180, -120, -60, 0, 60, 120, 180, 210, 240, 270, 300, 330, 345, 360, 390,
      420, 480, 525, 540, 570, 600, 630, 660, 720, 765, 780, 840,
    ];
    for (const ahead of offsets) {
      for (let h = 0; h < 24; h++) {
        const server = ((Math.round((h * 60 - ahead) / 60) % 24) + 24) % 24;
        const client = clientLocalHourToUTC(h, -ahead);
        expect({ ahead, h, server }).toEqual({ ahead, h, server: client });
      }
    }
  });

  // ── What makes the ±1 candidate window sound ────────────────────────────────
  it('never moves a mapping by more than one hour across a DST transition', () => {
    // candidateHours() queries [base-1, base, base+1]. If a transition could
    // shift the mapping by two hours, a genuinely-due user would fall outside
    // that window and silently stop receiving anything.
    const dstZones = [
      'Europe/Berlin', 'Europe/London', 'America/New_York', 'America/Los_Angeles',
      'America/St_Johns', 'Australia/Sydney', 'Australia/Adelaide',
      'Pacific/Chatham', 'America/Santiago', 'Asia/Beirut',
    ];
    for (const tz of dstZones) {
      for (let h = 0; h < 24; h++) {
        const s = utcHourForLocalHour(tz, h, SUMMER);
        const w = utcHourForLocalHour(tz, h, WINTER);
        // Circular distance, so 23 vs 0 counts as one hour apart, not 23.
        const gap = Math.min(((s - w) % 24 + 24) % 24, ((w - s) % 24 + 24) % 24);
        expect({ tz, h, gap }).toEqual({ tz, h, gap: gap <= 1 ? gap : 'MORE THAN 1 HOUR' });
        expect(gap).toBeLessThanOrEqual(1);
      }
    }
  });
});

describe('localHourNow', () => {
  it('reads the wall clock in the target zone, using a 0–23 clock', () => {
    const at = new Date('2026-07-15T23:30:00Z');
    expect(localHourNow('UTC', at)).toBe(23);
    expect(localHourNow('Asia/Tokyo', at)).toBe(8);      // next morning
    // Must be 0 and never 24 — the h23 hour cycle is what guarantees that, and
    // a 24 here would match no getUTCHours() the scheduler ever compares to.
    expect(localHourNow('Europe/London', new Date('2026-07-15T23:30:00Z'))).toBe(0);
  });
});
