/**
 * Home reads GPS again when the app comes back.
 *
 * The bug this closes: Home only read GPS on a cold start, so an app iOS had
 * kept suspended through a trip showed (and reported to the server) the city
 * it was last cold-started in.
 */

import {
  RESUME_REFIX_AFTER_MS,
  locationAfterResumeFix,
  shouldRefixOnResume,
} from '../resumeFix';

describe('shouldRefixOnResume', () => {
  const now = 1_800_000_000_000;

  it('reads GPS when there has never been a fix', () => {
    expect(shouldRefixOnResume(null, now)).toBe(true);
  });

  it('reads GPS once the last fix is old enough', () => {
    expect(shouldRefixOnResume(now - RESUME_REFIX_AFTER_MS, now)).toBe(true);
    // Days suspended, as through a trip.
    expect(shouldRefixOnResume(now - 3 * 86_400_000, now)).toBe(true);
  });

  it('skips a quick return (a banner, Control Center, an app switch)', () => {
    expect(shouldRefixOnResume(now - 30_000, now)).toBe(false);
    expect(shouldRefixOnResume(now - RESUME_REFIX_AFTER_MS + 1, now)).toBe(false);
  });
});

describe('locationAfterResumeFix', () => {
  const ARLINGTON_FIX = '32.74,-97.11';
  const FLEMINGTON_FIX = '40.51,-74.86';

  it('a new fix replaces the old one', () => {
    expect(
      locationAfterResumeFix({
        fix: FLEMINGTON_FIX,
        permitted: true,
        current: ARLINGTON_FIX,
        fallback: 'Arlington',
      }),
    ).toBe(FLEMINGTON_FIX);
  });

  it('a slow fix keeps the last one rather than jumping to the default city', () => {
    expect(
      locationAfterResumeFix({
        fix: null,
        permitted: true,
        current: FLEMINGTON_FIX,
        fallback: 'Arlington',
      }),
    ).toBe(FLEMINGTON_FIX);
  });

  it('access turned off meanwhile falls back to the default city', () => {
    expect(
      locationAfterResumeFix({
        fix: null,
        permitted: false,
        current: FLEMINGTON_FIX,
        fallback: 'Arlington',
      }),
    ).toBe('Arlington');
  });

  it('no fix and none before uses the default city', () => {
    expect(
      locationAfterResumeFix({ fix: null, permitted: true, current: '', fallback: 'Arlington' }),
    ).toBe('Arlington');
  });
});
