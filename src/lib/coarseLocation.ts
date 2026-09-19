/**
 * coarseLocation.ts — how precisely Ojo keeps a device location once it leaves
 * the phone.
 *
 * Two decimal places: about 1.1 km of latitude, and less of longitude away from
 * the equator. Nothing Ojo does needs more. Forecasts come from WeatherKit's
 * current, hourly and daily data sets, which don't vary within a kilometre (the
 * one that does, minute-by-minute precipitation, isn't used), and Trip Mode's
 * smallest radius is 15 miles. Rounding is what lets the App Store privacy label
 * say Coarse Location rather than Precise Location, and it means the point saved
 * on an account no longer sits within ~100 m of where someone lives.
 *
 * The exact fix still has uses on the device itself — looking up the town name,
 * Trip Mode's distance check — so getCurrentLocation returns it unrounded. Round
 * at the boundary instead: anything sent to Ojo's server goes through coarsen()
 * first. The server applies the same rounding on write
 * (server/src/lib/coarseLocation.ts), so an older build that skips it is still
 * stored coarse. Keep COORD_DECIMALS in step with the server copy; the parity
 * test in __tests__/coarseLocation.test.ts fails if they drift.
 */

export const COORD_DECIMALS = 2;

const FACTOR = 10 ** COORD_DECIMALS;

/** Round one coordinate to COORD_DECIMALS places. */
export const coarsen = (value: number): number => Math.round(value * FACTOR) / FACTOR;
