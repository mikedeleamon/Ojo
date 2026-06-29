/**
 * geo.ts — small geospatial helpers.
 *
 * Trip Mode needs to know whether the user's live GPS position is close enough
 * to a saved trip's destination to count as "in the city or nearby". A haversine
 * great-circle distance is plenty accurate for that radius check (sub-1% error).
 */

export interface LatLon {
  lat: number;
  lon: number;
}

const EARTH_RADIUS_MI = 3958.8;
const EARTH_RADIUS_KM = 6371.0;

const toRad = (deg: number): number => (deg * Math.PI) / 180;

/** Great-circle distance between two points, in the given Earth radius unit. */
const haversine = (a: LatLon, b: LatLon, radius: number): number => {
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * radius * Math.asin(Math.min(1, Math.sqrt(h)));
};

/** Great-circle distance in statute miles. */
export const haversineMi = (a: LatLon, b: LatLon): number =>
  haversine(a, b, EARTH_RADIUS_MI);

/** Great-circle distance in kilometres. */
export const haversineKm = (a: LatLon, b: LatLon): number =>
  haversine(a, b, EARTH_RADIUS_KM);
