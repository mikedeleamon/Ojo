/**
 * Guards the one thing that makes the split age gate safe: the client copy in
 * `src/lib/age.ts` and the authoritative server copy in `server/src/lib/age.ts`
 * must agree on every input.
 *
 * They are deliberately separate files — the client bundle can't import from
 * the server tree at runtime, and there is no shared package in this repo — so
 * nothing but this test stops them drifting. If it fails, the app is showing a
 * user one verdict while the API enforces another.
 */

import * as client from '../age';
import * as server from '../../../server/src/lib/age';

/** Fixed clock so the suite doesn't change meaning as time passes. */
const NOW = new Date(Date.UTC(2026, 7, 16));

/**
 * Every case the two implementations must agree on. Covers the boundary, the
 * calendar traps, and the non-string inputs only the server can actually
 * receive (a request body is whatever the caller sent).
 */
const CASES: unknown[] = [
  // Valid
  '01/15/2000', '2000-01-15', '1/5/2000', '02/29/2000',
  // Exact boundary
  '08/16/2013', '08/17/2013', '08/15/2013',
  // Underage
  '01/01/2020', '12/31/2025',
  // Calendar traps
  '02/29/2001', '02/30/2000', '04/31/2001', '13/01/2000', '00/10/2000',
  // Malformed
  'garbage', '01/15/00', '01-15-2000', '', '   ',
  // Out of range
  '01/01/2030', '01/01/1800',
  // Non-strings — reachable on the server via req.body
  undefined, null, 12345, {}, [], true,
];

describe('age rules are identical on client and server', () => {
  it.each(CASES.map(c => [JSON.stringify(c) ?? String(c), c] as const))(
    'agrees on %s',
    (_label, input) => {
      const c = client.validateBirthday(input as never, NOW);
      const s = server.validateBirthday(input, NOW);

      expect(s.ok).toBe(c.ok);
      if (c.ok && s.ok) {
        expect(s.age).toBe(c.age);
        expect(s.dob.getTime()).toBe(c.dob.getTime());
      } else if (!c.ok && !s.ok) {
        expect(s.reason).toBe(c.reason);
      }
    },
  );

  it('shares the same minimum age', () => {
    expect(server.MIN_AGE_YEARS).toBe(client.MIN_AGE_YEARS);
  });

  it('agrees on parseBirthday for every case', () => {
    for (const input of CASES) {
      const c = client.parseBirthday(input as never);
      const s = server.parseBirthday(input);
      expect(s?.getTime() ?? null).toBe(c?.getTime() ?? null);
    }
  });

  it('agrees on ageInYears across a range of dates', () => {
    for (let year = 1920; year <= 2026; year += 7) {
      for (const [m, d] of [[0, 1], [1, 29], [7, 16], [11, 31]] as const) {
        const dob = new Date(Date.UTC(year, m, d));
        expect(server.ageInYears(dob, NOW)).toBe(client.ageInYears(dob, NOW));
      }
    }
  });

  it("server's isAgeVerified matches the client's meetsMinimumAge", () => {
    for (const input of CASES) {
      expect(server.isAgeVerified(input, NOW)).toBe(
        client.meetsMinimumAge(input as never, NOW),
      );
    }
  });
});
