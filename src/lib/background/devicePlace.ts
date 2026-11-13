/**
 * background/devicePlace.ts — the last place this phone was known to be.
 *
 * Written whenever the home screen shows weather for the device's own position
 * and whenever the background refresh gets a location fix. Read by the
 * background refresh when it can't get a fix of its own (no "Always" location
 * permission), so it at least keeps the widget and briefs current for the last
 * known place instead of doing nothing.
 *
 * Also reported to the server (rounded to ~1 km), where the notification passes
 * prefer a fresh report over the default city from sign-up — see
 * server/src/lib/activeTrip.ts · resolveWeatherLocation.
 */

import api from '../../api/client';
import { authHeaders, getToken } from '../auth';
import { coarsen } from '../coarseLocation';
import { haversineKm } from '../geo';
import { storage, storageGetJSON, storageSetJSON } from '../storage';

const PLACE_KEY = 'ojo_device_place';
const REPORTED_KEY = 'ojo_device_place_reported';

export interface DevicePlace {
  /** Rounded to ~1 km — the precision anything that leaves the phone uses. */
  lat: number;
  lon: number;
  /** Reverse-geocoded display name, e.g. "Brooklyn". */
  name?: string;
  /** When the phone was last seen here (ms since epoch). */
  at: number;
}

/**
 * Two points closer than this are the same place. A little over one ~1.1 km
 * grid cell, so rounding jitter at a cell boundary never counts as a move.
 */
export const SAME_PLACE_KM = 1.5;

/**
 * An unchanged place is re-sent this often, comfortably inside the server's
 * 24 h freshness window, so a phone in daily use never lapses back to the
 * default city.
 */
const REPORT_REFRESH_MS = 6 * 60 * 60 * 1_000;

/**
 * True for a "name" that is really just coordinates. The home screen's geocoder
 * falls back to its "lat,lng" query string when reverse geocoding fails (open
 * water, no network), and that string must not reach the server as a city name:
 * notification copy would read "Rain is moving into 47.38".
 */
export const isCoordinateLabel = (name: string): boolean =>
  /^\s*-?\d+(?:\.\d+)?\s*,\s*-?\d+(?:\.\d+)?\s*$/.test(name);

export const readDevicePlace = (): Promise<DevicePlace | null> =>
  storageGetJSON<DevicePlace | null>(storage, PLACE_KEY, null);

/** True when `a` and `b` are within SAME_PLACE_KM of each other. */
export const isSamePlace = (
  a: { lat: number; lon: number },
  b: { lat: number; lon: number },
): boolean => haversineKm(a, b) < SAME_PLACE_KM;

/**
 * Record that the phone is at `place`, and tell the server when that's news
 * (a move, a new name, or the standing report is due for a refresh).
 */
export const rememberDevicePlace = async (place: {
  lat: number;
  lon: number;
  name?: string | null;
}): Promise<DevicePlace> => {
  const name = place.name?.trim();
  const next: DevicePlace = {
    lat: coarsen(place.lat),
    lon: coarsen(place.lon),
    name: name && !isCoordinateLabel(name) ? name : undefined,
    at: Date.now(),
  };
  await storageSetJSON(storage, PLACE_KEY, next);
  await reportDevicePlace(next);
  return next;
};

const reportDevicePlace = async (place: DevicePlace): Promise<void> => {
  if (!getToken()) return;
  const last = await storageGetJSON<DevicePlace | null>(storage, REPORTED_KEY, null);
  const unchanged = !!last && isSamePlace(last, place) && last.name === place.name;
  if (unchanged && Date.now() - last!.at < REPORT_REFRESH_MS) return;
  try {
    await api.post(
      '/api/notifications/device-location',
      { lat: place.lat, lon: place.lon, city: place.name },
      authHeaders(),
    );
    await storageSetJSON(storage, REPORTED_KEY, place);
  } catch {
    // Best-effort: the next sighting retries, and until then the server falls
    // back to the default city once the previous report ages out.
  }
};

/** Forget the place on this device — for sign-out, since the key isn't per account. */
export const clearDevicePlace = async (): Promise<void> => {
  await storage.removeItem(PLACE_KEY).catch(() => {});
  await storage.removeItem(REPORTED_KEY).catch(() => {});
};
