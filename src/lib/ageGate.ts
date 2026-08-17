/**
 * ageGate.ts
 * ----------
 * Tracks whether the signed-in account still owes us a date of birth.
 *
 * Accounts reach this state two ways, and neither is the sign-up form:
 *   - an Apple/Google sign-up, since neither provider returns a date of birth
 *   - an account created before the age gate existed
 *
 * The server is the authority. This flag only decides routing, and it is set
 * from three places so a stale value can't strand anyone:
 *   1. the `needsAgeVerification` field on every auth response (login, OAuth,
 *      reset-password)
 *   2. the same field on GET /api/user/me
 *   3. the api client's 403 `AGE_VERIFICATION_REQUIRED` interceptor — the
 *      backstop that catches a cold start with a remembered token, where no
 *      auth response happened at all
 *
 * Mirrors onboarding.ts: an in-memory cache in front of storage, since AuthGate
 * consults it on every navigation.
 */

import { storage } from './storage';

const NEEDS_KEY = 'ojo_age_verification_needed';

let needsCache: boolean | null = null;

/**
 * Record what the server said. Called from auth responses and the interceptor.
 *
 * No-ops when the value is unchanged: while the gate is up, any screen still
 * holding a mounted data fetch keeps drawing 403s, and each one would otherwise
 * be a redundant write.
 */
export const setAgeVerificationNeeded = async (needed: boolean): Promise<void> => {
  if (needsCache === needed) return;
  needsCache = needed;
  if (needed) await storage.setItem(NEEDS_KEY, 'true');
  else        await storage.removeItem(NEEDS_KEY);
};

export const isAgeVerificationNeeded = async (): Promise<boolean> => {
  if (needsCache !== null) return needsCache;
  needsCache = (await storage.getItem(NEEDS_KEY)) === 'true';
  return needsCache;
};

/** Synchronous read of the mirror. Null when it hasn't been warmed yet. */
export const peekAgeVerificationNeeded = (): boolean | null => needsCache;

/** Drop the in-memory mirror — call on logout so the next account reads fresh. */
export const resetAgeGateCache = (): void => {
  needsCache = null;
};
