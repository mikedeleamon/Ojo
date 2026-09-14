/**
 * Trip-aware weather location.
 *
 * The bug these pin: every server-sent weather push read the user's *home*
 * city, so three days into a trip to Ocho Rios the phone said "Rain is moving
 * into Arlington."
 *
 * Dates alone don't earn the trip city — a saved trip says the user planned to
 * go, not that they went — so the device's own GPS confirmation gates it.
 */

import {
  selectActiveTrip,
  userToday,
  resolveWeatherLocation,
  locationKey,
  confirmsTrip,
  TRIP_PRESENCE_TTL_MS,
} from '../activeTrip';

const trip = (startDate: string, endDate: string, destination = 'Ocho Rios') => ({
  startDate,
  endDate,
  destination,
  clientId: `${destination}-${startDate}`,
  lat: 18.41,
  lon: -77.1,
});

describe('selectActiveTrip', () => {
  it('picks the trip covering today', () => {
    const t = trip('2026-09-08', '2026-09-11');
    expect(selectActiveTrip([t], '2026-09-10')).toBe(t);
  });

  it('includes both endpoints of the range', () => {
    const t = trip('2026-09-08', '2026-09-11');
    expect(selectActiveTrip([t], '2026-09-08')).toBe(t);
    expect(selectActiveTrip([t], '2026-09-11')).toBe(t);
  });

  it('returns null the day before and the day after', () => {
    const t = trip('2026-09-08', '2026-09-11');
    expect(selectActiveTrip([t], '2026-09-07')).toBeNull();
    expect(selectActiveTrip([t], '2026-09-12')).toBeNull();
  });

  it('returns null when there are no trips at all', () => {
    expect(selectActiveTrip([], '2026-09-10')).toBeNull();
  });

  it('ignores trips that do not cover today', () => {
    const past   = trip('2026-01-01', '2026-01-05', 'Kingston');
    const future = trip('2026-12-01', '2026-12-05', 'Lisbon');
    expect(selectActiveTrip([past, future], '2026-09-10')).toBeNull();
  });

  // Matches the tie-break the client falls back to without GPS, so both sides
  // name the same city on a day two saved trips overlap.
  it('prefers the soonest-starting trip when two overlap', () => {
    const later   = trip('2026-09-09', '2026-09-12', 'Lisbon');
    const earlier = trip('2026-09-08', '2026-09-11', 'Ocho Rios');
    expect(selectActiveTrip([later, earlier], '2026-09-10')).toBe(earlier);
  });
});

describe('userToday', () => {
  it('uses the user’s own zone', () => {
    const at = new Date('2026-09-12T02:00:00Z'); // 9pm Sep 11 in Jamaica
    expect(userToday({ settings: { timeZone: 'America/Jamaica' } }, at)).toBe('2026-09-11');
    expect(userToday({ settings: { timeZone: 'Asia/Tokyo' } }, at)).toBe('2026-09-12');
  });

  it('falls back to the UTC date for accounts with no stored zone', () => {
    const at = new Date('2026-09-12T02:00:00Z');
    expect(userToday({}, at)).toBe('2026-09-12');
    expect(userToday({ settings: {} }, at)).toBe('2026-09-12');
  });

  // A zone name reaches the server from the client, so it is untrusted input.
  // Intl throws a RangeError on an unknown name, and inside the cron loop that
  // would abort the pass for every user behind this one.
  it('falls back rather than throwing on a bogus zone', () => {
    const at = new Date('2026-09-12T02:00:00Z');
    expect(userToday({ settings: { timeZone: 'Mars/Olympus_Mons' } }, at)).toBe('2026-09-12');
  });
});

describe('resolveWeatherLocation', () => {
  const user = { settings: { location: 'Arlington, VA', lat: 38.88, lon: -77.1 } };

  it('uses the trip city while a trip is running', () => {
    expect(resolveWeatherLocation(user, trip('2026-09-08', '2026-09-11') as never)).toEqual({
      city: 'Ocho Rios',
      lat: 18.41,
      lon: -77.1,
      tripId: 'Ocho Rios-2026-09-08',
    });
  });

  it('uses the home city when no trip is active', () => {
    expect(resolveWeatherLocation(user, null)).toEqual({
      city: 'Arlington, VA',
      lat: 38.88,
      lon: -77.1,
    });
  });

  it('marks the home city with no trip id, so callers can tell them apart', () => {
    expect(resolveWeatherLocation(user, null)?.tripId).toBeUndefined();
  });

  it('falls back to home when the trip has no usable coordinates', () => {
    const broken = { clientId: 'x', destination: 'Ocho Rios', lat: undefined, lon: -77.1 };
    expect(resolveWeatherLocation(user, broken as never)?.city).toBe('Arlington, VA');
  });

  it('returns null when neither place has coordinates', () => {
    expect(resolveWeatherLocation({ settings: { location: 'Arlington, VA' } }, null)).toBeNull();
    expect(resolveWeatherLocation({}, null)).toBeNull();
  });
});

describe('locationKey', () => {
  it('is stable across re-geocoding jitter', () => {
    expect(locationKey(38.8816, -77.0910)).toBe(locationKey(38.8817, -77.0912));
  });

  it('changes when the city does', () => {
    expect(locationKey(38.88, -77.1)).not.toBe(locationKey(18.41, -77.1));
  });
});

describe('confirmsTrip', () => {
  const now = new Date('2026-09-10T12:00:00Z');
  const ago = (ms: number) => new Date(now.getTime() - ms);

  it('vouches for a fresh confirmation of that trip', () => {
    const presence = { tripId: 'trip-1', confirmedAt: ago(60_000) };
    expect(confirmsTrip(presence, 'trip-1', now)).toBe(true);
  });

  it('does not vouch for a different trip', () => {
    const presence = { tripId: 'trip-1', confirmedAt: ago(60_000) };
    expect(confirmsTrip(presence, 'trip-2', now)).toBe(false);
  });

  // A phone that goes quiet mid-trip — home early, dead battery, airplane mode
  // — posts nothing at all, so the confirmation has to stop counting by itself.
  it('stops vouching once the confirmation is older than the TTL', () => {
    const stale = { tripId: 'trip-1', confirmedAt: ago(TRIP_PRESENCE_TTL_MS + 1_000) };
    expect(confirmsTrip(stale, 'trip-1', now)).toBe(false);

    const justInside = { tripId: 'trip-1', confirmedAt: ago(TRIP_PRESENCE_TTL_MS - 1_000) };
    expect(confirmsTrip(justInside, 'trip-1', now)).toBe(true);
  });

  it('treats a future-dated confirmation as a clock problem, not evidence', () => {
    const future = { tripId: 'trip-1', confirmedAt: new Date(now.getTime() + 60_000) };
    expect(confirmsTrip(future, 'trip-1', now)).toBe(false);
  });

  it('vouches for nothing when there is no confirmation', () => {
    expect(confirmsTrip(undefined, 'trip-1', now)).toBe(false);
    expect(confirmsTrip(null, 'trip-1', now)).toBe(false);
    expect(confirmsTrip({}, 'trip-1', now)).toBe(false);
    expect(confirmsTrip({ tripId: 'trip-1' }, 'trip-1', now)).toBe(false);
  });
});
