/**
 * geocoding.ts
 * ────────────
 * Client-side geocoding using expo-location's on-device geocoder. Replaces
 * AccuWeather's city-key lookup now that the server takes raw lat/lon.
 *
 * Both helpers swallow errors and return null on failure — callers treat
 * "couldn't resolve" the same way they used to treat "city not found".
 */

import * as Location from 'expo-location';
import type { LocationCoords } from '../types';

// "37.7749,-122.4194" — accepts an optional sign, decimals, and whitespace.
const LATLNG_RE = /^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/;

/** Returns true if `query` already looks like a "lat,lng" pair. */
export function isLatLngString(query: string): boolean {
  return LATLNG_RE.test(query);
}

/** Parses a "lat,lng" string, or returns null if it isn't one. */
export function parseLatLng(query: string): { lat: number; lon: number } | null {
  const m = query.match(LATLNG_RE);
  if (!m) return null;
  const lat = Number(m[1]);
  const lon = Number(m[2]);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;
  return { lat, lon };
}

/**
 * Resolve a free-form query to coordinates + display name.
 * - Pass-through for already-formatted "lat,lng" strings (with optional
 *   reverse-geocode for the display name).
 * - Otherwise forward-geocode via expo-location.
 */
export async function geocodeCity(query: string): Promise<LocationCoords | null> {
  if (!query.trim()) return null;

  const direct = parseLatLng(query);
  if (direct) {
    const name = (await reverseGeocode(direct.lat, direct.lon)) ?? query.trim();
    return { ...direct, name };
  }

  try {
    const results = await Location.geocodeAsync(query.trim());
    const hit = results[0];
    if (!hit) return null;
    return { lat: hit.latitude, lon: hit.longitude, name: query.trim() };
  } catch {
    return null;
  }
}

/** Best-effort reverse geocode → human-readable city/region label, or null. */
export async function reverseGeocode(lat: number, lon: number): Promise<string | null> {
  try {
    const [hit] = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lon });
    if (!hit) return null;
    return hit.city ?? hit.subregion ?? hit.region ?? null;
  } catch {
    return null;
  }
}
