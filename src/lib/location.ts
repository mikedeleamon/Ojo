/**
 * location.ts — React Native implementation using expo-location.
 * Interface is identical to the web version — call sites unchanged.
 */

import * as Location from 'expo-location';
import { coarsen } from './coarseLocation';

export interface Coords {
  lat: number;
  lng: number;
}

/**
 * The device's exact fix, for use on the device only — looking up the town name,
 * Trip Mode's distance check. Before any of it goes to Ojo's server it must be
 * rounded to ~1 km: build the request with formatCoords, or pass each value
 * through coarsen (lib/coarseLocation.ts).
 */
export const getCurrentLocation = async (timeoutMs = 8000): Promise<Coords | null> => {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return null;

    const result = await Promise.race([
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
      new Promise<null>(resolve => setTimeout(() => resolve(null), timeoutMs)),
    ]);

    if (!result) return null;
    const { latitude, longitude } = (result as Location.LocationObject).coords;
    return { lat: latitude, lng: longitude };
  } catch {
    return null;
  }
};

/**
 * A fix as the "lat,lng" location string the weather screens send to the server
 * — rounded to ~1 km, since this is how a device fix leaves the phone.
 */
export const formatCoords = (lat: number, lng: number): string =>
  `${coarsen(lat)},${coarsen(lng)}`;
