/**
 * background/geofence.ts — notices when the phone leaves the area it was in.
 *
 * One circular region, centred on the last known position. Leaving it makes iOS
 * launch Ojo in the background even if it wasn't running (region monitoring
 * survives the app being closed), and the handler in lib/background/tasks.ts
 * refreshes everything for the new place, then moves the region there.
 *
 * Region monitoring is the low-power option: it runs on cell and Wi-Fi changes,
 * not GPS, and needs no `location` background mode — only "Always" permission.
 * Continuous background location would cost battery for no gain here; nothing
 * Ojo shows changes within a few kilometres.
 */

import * as Location from 'expo-location';
import { storage, storageGetJSON, storageSetJSON } from '../storage';
import { getBackgroundLocationAccess } from './locationAccess';
import { isSamePlace } from './devicePlace';

export const CITY_GEOFENCE_TASK = 'ojo-city-geofence';

/**
 * Leaving this radius counts as moving somewhere new. ~5 miles: wide enough
 * that a commute across one city doesn't wake the app all day, small enough
 * that the next town over gets its own forecast.
 */
export const CITY_GEOFENCE_RADIUS_M = 8_000;

const REGION_ID = 'ojo-current-area';
const CENTER_KEY = 'ojo_geofence_center';

/**
 * Centre the region on `point` (exact device coordinates are fine here — they
 * never leave the phone). A no-op when "Always" isn't granted, and when the
 * region is already running around the same place.
 */
export const watchArea = async (point: { lat: number; lon: number }): Promise<void> => {
  try {
    if ((await getBackgroundLocationAccess()) !== 'always') return;
    const center = await storageGetJSON<{ lat: number; lon: number } | null>(
      storage,
      CENTER_KEY,
      null,
    );
    const running = await Location.hasStartedGeofencingAsync(CITY_GEOFENCE_TASK);
    if (running && center && isSamePlace(center, point)) return;

    await Location.startGeofencingAsync(CITY_GEOFENCE_TASK, [
      {
        identifier: REGION_ID,
        latitude: point.lat,
        longitude: point.lon,
        radius: CITY_GEOFENCE_RADIUS_M,
        notifyOnEnter: false,
        notifyOnExit: true,
      },
    ]);
    await storageSetJSON(storage, CENTER_KEY, { lat: point.lat, lon: point.lon });
  } catch {
    // Best-effort: without the region, the scheduled background refresh still
    // runs; it just can't react to a move as it happens.
  }
};

export const stopWatchingArea = async (): Promise<void> => {
  try {
    if (await Location.hasStartedGeofencingAsync(CITY_GEOFENCE_TASK)) {
      await Location.stopGeofencingAsync(CITY_GEOFENCE_TASK);
    }
  } catch {
    /* ignore */
  }
  await storage.removeItem(CENTER_KEY).catch(() => {});
};
