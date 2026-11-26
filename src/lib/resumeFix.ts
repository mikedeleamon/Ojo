/**
 * resumeFix.ts — when Home reads GPS again after the app comes back.
 *
 * Home read the device's position on a cold start, on switching to My
 * Location, and on pull-to-refresh, and never on coming back to the app. iOS
 * keeps Ojo suspended in memory for days, so opening it after a trip showed
 * the weather for wherever it was last cold-started, and reported that place
 * to the server as where the phone was.
 */

/**
 * A fix younger than this still says where the phone is. Coming back sooner
 * (a banner, Control Center, a quick app switch) reads nothing, so the
 * location indicator doesn't flash on every return.
 */
export const RESUME_REFIX_AFTER_MS = 5 * 60_000;

/** Whether coming back to the app should read GPS again. */
export const shouldRefixOnResume = (lastFixAt: number | null, now: number): boolean =>
  lastFixAt === null || now - lastFixAt >= RESUME_REFIX_AFTER_MS;

/**
 * Home's location string after a fix attempt on resume.
 *
 * - A fix: its coordinates.
 * - No fix because location access was turned off meanwhile: the default
 *   city, as a cold start would show.
 * - No fix but access is still on (slow or indoor GPS): keep the last fix.
 *   It's older, but more likely right than the default city.
 */
export const locationAfterResumeFix = (input: {
  fix: string | null;
  permitted: boolean;
  current: string;
  fallback: string;
}): string => {
  if (input.fix) return input.fix;
  if (!input.permitted) return input.fallback;
  return input.current || input.fallback;
};
