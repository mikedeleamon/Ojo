/**
 * coarseLocation.ts — the precision at which Ojo stores a location: two decimal
 * places, about 1.1 km.
 *
 * Mirrors src/lib/coarseLocation.ts, which rounds before a device fix ever
 * leaves the phone; see that file for why ~1 km is enough for everything Ojo
 * does. This copy is the backstop: PUT /api/user/settings rounds on write, so a
 * build that predates the client-side rounding is still stored coarse, and the
 * privacy label's "Coarse Location" holds for every account.
 *
 * WeatherKit requests need nothing extra here — lib/weatherKit.ts already snaps
 * coordinates to its cache grid (2 decimals by default) before calling Apple.
 */

export const COORD_DECIMALS = 2;

const FACTOR = 10 ** COORD_DECIMALS;

/** Round one coordinate to COORD_DECIMALS places. */
export const coarsen = (value: number): number => Math.round(value * FACTOR) / FACTOR;

/** Round only a finite number; anything else passes through untouched. */
const coarsenIfNumber = (value: unknown): unknown =>
  typeof value === 'number' && Number.isFinite(value) ? coarsen(value) : value;

/** Round a `{ lat, lon }`-shaped object's coordinates, leaving any other keys alone. */
const coarsenPoint = (point: unknown): unknown => {
  if (!point || typeof point !== 'object' || Array.isArray(point)) return point;
  const out: Record<string, unknown> = { ...(point as Record<string, unknown>) };
  // Only keys that are present: writing `lat: undefined` would reach Mongo as
  // null rather than as an absent field.
  if ('lat' in out) out.lat = coarsenIfNumber(out.lat);
  if ('lon' in out) out.lon = coarsenIfNumber(out.lon);
  return out;
};

/**
 * The value to store for one editable settings field: the location fields
 * rounded, everything else returned as-is.
 */
export const coarsenSettingsField = (field: string, value: unknown): unknown => {
  if (field === 'lat' || field === 'lon') return coarsenIfNumber(value);
  if (field === 'savedLocations' && Array.isArray(value)) return value.map(coarsenPoint);
  return value;
};
