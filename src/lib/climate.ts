/**
 * climate.ts — coordinates → coarse climate band.
 *
 * Exists for one reason: the archetype closet (src/lib/archetypes) has to pick a
 * plausible starting wardrobe *before* the first weather fetch, so this must be a
 * pure function with no network dependency. Latitude does most of the work; a
 * small hand-tuned override table fixes the places latitude alone gets badly
 * wrong (deserts sitting at temperate latitudes, maritime Europe sitting at
 * continental ones).
 *
 * This is deliberately coarse. It seeds a starting guess that the user then
 * corrects by adding real clothes — it is not a climate classification.
 */

export type ClimateBand =
  | 'tropical'
  | 'arid'
  | 'temperate'
  | 'continental'
  | 'polar';

export const CLIMATE_BANDS: readonly ClimateBand[] = [
  'tropical', 'arid', 'temperate', 'continental', 'polar',
] as const;

/** Inclusive lat/lon box. `lat`/`lon` are [min, max] in signed degrees. */
interface Box {
  lat: [number, number];
  lon: [number, number];
  band: ClimateBand;
  label: string;
}

/**
 * Checked in order, first match wins. Only regions where the latitude rule is
 * wrong by a whole band are listed — this is a patch table, not a map.
 */
const OVERRIDES: Box[] = [
  // ── Arid: hot/cold deserts and steppe that sit at temperate latitudes ──────
  { lat: [ 12,  33], lon: [ -17,   60], band: 'arid', label: 'Sahara + Arabian' },
  { lat: [ 24,  42], lon: [-125,  -99], band: 'arid', label: 'US Southwest + N Mexico' },
  { lat: [ 25,  42], lon: [  44,   80], band: 'arid', label: 'Iranian plateau + Central Asia' },
  { lat: [-33, -18], lon: [ 113,  147], band: 'arid', label: 'Australian interior' },
  { lat: [-30, -14], lon: [ -76,  -64], band: 'arid', label: 'Atacama + Altiplano' },
  { lat: [-31, -16], lon: [  11,   26], band: 'arid', label: 'Namib + Kalahari' },
  { lat: [ 36,  50], lon: [  80,  110], band: 'arid', label: 'Gobi + Taklamakan' },

  // ── Temperate: maritime coasts that latitude would call continental ────────
  // Deliberately tight. Oslo (59.9N, 10.7E) must stay OUT of this box — it is a
  // continental winter city and the seed test asserts it gets real outerwear.
  { lat: [ 48,  58], lon: [ -11,    8], band: 'temperate', label: 'NW Europe maritime' },
  { lat: [ 42,  52], lon: [-131, -120], band: 'temperate', label: 'Pacific Northwest coast' },
  { lat: [-48, -34], lon: [ 166,  179], band: 'temperate', label: 'New Zealand' },
];

const inBox = (lat: number, lon: number, b: Box): boolean =>
  lat >= b.lat[0] && lat <= b.lat[1] && lon >= b.lon[0] && lon <= b.lon[1];

/**
 * Coarse climate band for a coordinate.
 *
 * Non-finite or out-of-range input falls back to `temperate` rather than
 * throwing — this runs on a cold start where a bad reading must not block the
 * first recommendation, and temperate is the least-wrong default (its seed
 * spans the widest range of weather).
 */
export const climateBandFor = (lat: number, lon: number): ClimateBand => {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return 'temperate';
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return 'temperate';

  for (const box of OVERRIDES) {
    if (inBox(lat, lon, box)) return box.band;
  }

  const absLat = Math.abs(lat);
  if (absLat >= 66.5) return 'polar';
  if (absLat >= 48)   return 'continental';
  if (absLat >= 23.5) return 'temperate';
  return 'tropical';
};

/** Short human label — used in onboarding copy ("typical for a temperate climate"). */
export const climateBandLabel = (band: ClimateBand): string => {
  switch (band) {
    case 'tropical':    return 'tropical';
    case 'arid':        return 'dry';
    case 'temperate':   return 'temperate';
    case 'continental': return 'four-season';
    case 'polar':       return 'cold';
  }
};
