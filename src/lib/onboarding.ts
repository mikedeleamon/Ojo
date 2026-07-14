/**
 * Tracks first-run onboarding.
 *
 * Onboarding is gated on an explicit "pending" signal that is set only on a
 * first-time account creation: completing the sign-up form (see SignupPage) or
 * a Google/Apple sign-in that created a brand-new account (see LoginPage). It is
 * intentionally NOT inferred from login state — that way a returning user whose
 * credentials are remembered, or who signs in via the login screen, never
 * re-sees the first-run flow.
 *
 * - `pending`  — global flag set at sign-up, cleared on completion. AuthGate
 *                routes to /(auth)/onboarding while it is set.
 * - `done`     — keyed by userId so multiple accounts on one device don't share
 *                state. Acts as a guard so onboarding is never shown twice.
 */

import { storage } from './storage';
import { getUserId } from './auth';

const PENDING_KEY = 'ojo_onboarding_pending';

const onboardKey = (): string =>
  `ojo_onboarding_done_${getUserId() ?? 'anon'}`;

// ─── In-memory mirror ──────────────────────────────────────────────────────────
// AuthGate consults these on every navigation to decide routing, so hitting
// AsyncStorage each time added a bridge round-trip per route change. The first
// read warms the cache; the mutators below keep it in sync, so subsequent reads
// resolve without touching storage. resetOnboardingCache() clears it on logout
// (the userId — and thus the "done" key — changes with the next account).
let pendingCache: boolean | null = null;
const doneCache = new Map<string, boolean>();

export const isOnboardingComplete = async (): Promise<boolean> => {
  const key = onboardKey();
  const cached = doneCache.get(key);
  if (cached !== undefined) return cached;
  const val = (await storage.getItem(key)) === 'true';
  doneCache.set(key, val);
  return val;
};

export const markOnboardingComplete = async (): Promise<void> => {
  const key = onboardKey();
  await storage.setItem(key, 'true');
  await storage.removeItem(PENDING_KEY);
  doneCache.set(key, true);
  pendingCache = false;
};

/** Set by SignupPage once the sign-up form succeeds, so AuthGate runs onboarding. */
export const markOnboardingPending = async (): Promise<void> => {
  await storage.setItem(PENDING_KEY, 'true');
  pendingCache = true;
};

export const isOnboardingPending = async (): Promise<boolean> => {
  if (pendingCache !== null) return pendingCache;
  pendingCache = (await storage.getItem(PENDING_KEY)) === 'true';
  return pendingCache;
};

/** Drop the in-memory mirror — call on logout so the next account reads fresh. */
export const resetOnboardingCache = (): void => {
  pendingCache = null;
  doneCache.clear();
};
