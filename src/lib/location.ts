/**
 * location.ts — React Native implementation using expo-location.
 * Interface is identical to the web version — call sites unchanged.
 */

import * as Location from 'expo-location';

export interface Coords {
  lat: number;
  lng: number;
}

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

export const formatCoords = (lat: number, lng: number): string => `${lat},${lng}`;
