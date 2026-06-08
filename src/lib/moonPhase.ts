// ─── Moon phase ────────────────────────────────────────────────────────────
// Continuous lunar phase derived purely from the date — no API needed.
//
// Returns a fraction in [0, 1):
//   0.00 = new moon, 0.25 = first quarter (waxing, right side lit),
//   0.50 = full moon, 0.75 = last quarter (waning, left side lit).
//
// This is the value ClearNightIconMoon's `moonPhase` prop expects. We compute a
// continuous fraction rather than reading a weather provider's phase *name*
// (new / first-quarter / full / …): the provider only reports ~8 discrete
// buckets, whereas the SVG renders smooth intermediate crescents and gibbous
// shapes, so the continuous astronomical value is the more accurate input.

/** Mean length of one synodic month (new moon → new moon), in days. */
const SYNODIC_MONTH = 29.530588853;

/**
 * A reference new moon: 2000-01-06 18:14 UTC (Julian date 2451550.1).
 * A well-established epoch for simple lunar-phase estimation.
 */
const KNOWN_NEW_MOON_MS = Date.UTC(2000, 0, 6, 18, 14, 0);

const MS_PER_DAY = 86_400_000;

/**
 * Fractional moon phase for the given instant (defaults to now).
 *
 * Uses a constant-rate (mean synodic month) model anchored to a known new moon.
 * Accurate to within a few hours over many decades — far finer than the disc
 * rendering needs, and good enough that quarter/full/new land on the right day.
 */
export function getMoonPhase(date: Date = new Date()): number {
    const days = (date.getTime() - KNOWN_NEW_MOON_MS) / MS_PER_DAY;
    const phase = (days / SYNODIC_MONTH) % 1;
    // Normalise into [0, 1) regardless of dates before the epoch.
    return (phase + 1) % 1;
}
