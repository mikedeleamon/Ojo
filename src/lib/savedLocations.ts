/**
 * savedLocations.ts
 * ─────────────────
 * Pure helpers for the user's list of saved weather cities. The list itself
 * lives on `Settings.savedLocations` and persists through SettingsContext
 * (local cache + server sync), so these functions just produce new arrays —
 * call sites pass the result to `saveSettings`.
 *
 * The GPS "My Location" entry is NOT stored here; it is represented by the
 * reserved id `CURRENT_LOCATION_ID` and resolved live from the device.
 */

import type { LocationCoords, SavedLocation } from '../types';

/** Reserved id for the live GPS "My Location" entry. */
export const CURRENT_LOCATION_ID = 'current';

/** Unique id for a saved location (mirrors tripStorage.newPlanId). */
export const newLocationId = (): string =>
  `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

/**
 * Append a geocoded city to the list. De-dupes on rounded coordinates so the
 * same place isn't added twice; returns the existing array unchanged in that
 * case. `query` is the raw text the user typed (kept for re-geocoding).
 */
export const addLocation = (
  list: SavedLocation[],
  coords: LocationCoords,
  query: string,
): SavedLocation[] => {
  const dup = list.some(
    (l) => l.lat.toFixed(3) === coords.lat.toFixed(3) &&
           l.lon.toFixed(3) === coords.lon.toFixed(3),
  );
  if (dup) return list;

  const now = new Date().toISOString();
  const loc: SavedLocation = {
    id:        newLocationId(),
    name:      coords.name || query.trim(),
    query:     query.trim(),
    lat:       coords.lat,
    lon:       coords.lon,
    createdAt: now,
    updatedAt: now,
  };
  return [...list, loc];
};

/** Remove a saved location by id. */
export const removeLocation = (
  list: SavedLocation[],
  id: string,
): SavedLocation[] => list.filter((l) => l.id !== id);
