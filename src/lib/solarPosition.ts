// ─── Solar position ────────────────────────────────────────────────────────
// Sun elevation above the horizon, derived purely from date + coordinates — no
// API call, same as getMoonPhase (see lib/moonPhase).
//
// Why elevation rather than the `IsDayTime` boolean WeatherKit gives us: the
// boolean collapses the whole sky to two states, so a 6am sunrise and a 1pm
// midday render identically. Elevation is continuous, which is what lets the
// background gradient move through dawn → golden hour → dusk → night instead of
// snapping between two palettes.
//
// Implements the standard NOAA solar-position equations. Accurate to well under
// a degree, which is far finer than a background gradient can express.

const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;

/** Julian day number for an instant. */
const julianDay = (date: Date) => date.getTime() / 86_400_000 + 2_440_587.5;

export interface SolarPosition {
    /** Degrees above the horizon. Negative = below. */
    elevationDeg: number;
    /**
     * True when the sun is climbing — i.e. before local solar noon. Elevation
     * alone can't distinguish dawn from dusk: −4° happens twice a day, once on
     * the way up and once on the way down, and the sky genuinely does not look
     * the same at those two moments (see lib/weather/skyGradient).
     *
     * Derived from the hour angle, which is already computed for the elevation
     * — negative before solar noon, positive after — so this is exact rather
     * than sampled, and costs nothing. It also stays correct across solar
     * midnight: just after it the hour angle wraps to ≈ −180°, and the sun is
     * indeed climbing toward sunrise from there.
     */
    isRising: boolean;
}

/**
 * Sun elevation and travel direction at `date` for the given location.
 *
 * Elevation reference points:
 *   > +6°  full daylight
 *     0°   geometric sunrise / sunset
 *   −6°    end of civil twilight ("blue hour" begins)
 *  −12°    end of nautical twilight
 *  −18°    astronomical night
 *
 * @param lat Latitude in decimal degrees (negative = south).
 * @param lon Longitude in decimal degrees (negative = west).
 */
export function solarPosition(
    lat: number,
    lon: number,
    date: Date = new Date(),
): SolarPosition {
    const t = (julianDay(date) - 2_451_545.0) / 36_525; // Julian centuries since J2000.0

    // Geometric mean longitude and anomaly of the sun (degrees).
    const l0 = (280.46646 + t * (36_000.76983 + t * 0.0003032)) % 360;
    const m = 357.52911 + t * (35_999.05029 - 0.0001537 * t);

    // Orbital eccentricity and the equation of centre.
    const e = 0.016708634 - t * (0.000042037 + 0.0000001267 * t);
    const c =
        Math.sin(rad(m)) * (1.914602 - t * (0.004817 + 0.000014 * t)) +
        Math.sin(rad(2 * m)) * (0.019993 - 0.000101 * t) +
        Math.sin(rad(3 * m)) * 0.000289;

    // Apparent longitude, corrected for nutation.
    const omega = 125.04 - 1934.136 * t;
    const lambda = l0 + c - 0.00569 - 0.00478 * Math.sin(rad(omega));

    // Obliquity of the ecliptic.
    const seconds = 21.448 - t * (46.815 + t * (0.00059 - t * 0.001813));
    const eps = 23 + (26 + seconds / 60) / 60 + 0.00256 * Math.cos(rad(omega));

    // Solar declination.
    const decl = deg(Math.asin(Math.sin(rad(eps)) * Math.sin(rad(lambda))));

    // Equation of time (minutes) — the offset between clock noon and solar noon.
    const y = Math.tan(rad(eps / 2)) ** 2;
    const eqTime =
        4 *
        deg(
            y * Math.sin(2 * rad(l0)) -
            2 * e * Math.sin(rad(m)) +
            4 * e * y * Math.sin(rad(m)) * Math.cos(2 * rad(l0)) -
            0.5 * y * y * Math.sin(4 * rad(l0)) -
            1.25 * e * e * Math.sin(2 * rad(m)),
        );

    // Hour angle: how far the sun is from the local meridian.
    const utcMinutes =
        date.getUTCHours() * 60 + date.getUTCMinutes() + date.getUTCSeconds() / 60;
    const trueSolarTime = (utcMinutes + eqTime + 4 * lon + 1440) % 1440;
    const hourAngle = trueSolarTime / 4 - 180;

    const cosZenith =
        Math.sin(rad(lat)) * Math.sin(rad(decl)) +
        Math.cos(rad(lat)) * Math.cos(rad(decl)) * Math.cos(rad(hourAngle));

    // Guard against floating-point drift pushing the argument outside acos' domain.
    const clamped = cosZenith < -1 ? -1 : cosZenith > 1 ? 1 : cosZenith;
    return {
        elevationDeg: 90 - deg(Math.acos(clamped)),
        isRising: hourAngle < 0,
    };
}

/**
 * Elevation only, for callers that don't care which side of noon they're on.
 * Kept as the original signature so existing call sites are untouched.
 */
export function solarElevation(lat: number, lon: number, date: Date = new Date()): number {
    return solarPosition(lat, lon, date).elevationDeg;
}
