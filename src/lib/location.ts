/**
 * location.ts — platform-agnostic geolocation.
 *
 * Web:  uses navigator.geolocation
 * RN:   replace this file with the Expo version below —
 *       MainPage and any other caller stays identical.
 *
 * ─── React Native replacement ────────────────────────────────────────────────
 *
 *   import * as Location from 'expo-location';
 *
 *   export const getCurrentLocation = async (
 *     timeoutMs = 8000
 *   ): Promise<{ lat: number; lng: number } | null> => {
 *     const { status } = await Location.requestForegroundPermissionsAsync();
 *     if (status !== 'granted') return null;
 *
 *     const result = await Promise.race([
 *       Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
 *       new Promise<null>(resolve => setTimeout(() => resolve(null), timeoutMs)),
 *     ]);
 *
 *     if (!result) return null;
 *     const { latitude, longitude } = (result as Location.LocationObject).coords;
 *     return { lat: latitude, lng: longitude };
 *   };
 *
 *   export const formatCoords = (lat: number, lng: number): string =>
 *     `${lat},${lng}`;
 */

/** Resolved location as lat/lng numbers. */
export interface Coords {
  lat: number;
  lng: number;
}

/**
 * Attempts to get the device's current GPS coordinates.
 *
 * @param timeoutMs  Milliseconds before giving up. Defaults to 8000.
 * @returns          Coords if available, null if denied or timed out.
 */
export const getCurrentLocation = (timeoutMs = 8000): Promise<Coords | null> => {
  return new Promise(resolve => {
    if (!('geolocation' in navigator)) {
      resolve(null);
      return;
    }

    const timer = setTimeout(() => resolve(null), timeoutMs);

    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        clearTimeout(timer);
        resolve({ lat: coords.latitude, lng: coords.longitude });
      },
      () => {
        clearTimeout(timer);
        resolve(null);
      },
      { timeout: timeoutMs, maximumAge: 60_000 },
    );
  });
};

/** Formats coords as the "lat,lng" string the AccuWeather API expects. */
export const formatCoords = (lat: number, lng: number): string =>
  `${lat},${lng}`;
