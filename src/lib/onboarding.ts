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
 * - `pending`  — set at sign-up, cleared on completion. AuthGate routes to
 *                /(auth)/onboarding while it is set.
 * - `done`     — a guard so onboarding is never shown twice.
 *
 * Both are keyed by userId so multiple accounts on one device don't share
 * state. A shared `pending` flag sent the next account signed in on the device
 * through onboarding when the previous one quit it unfinished. The old global
 * `ojo_onboarding_pending` key is simply no longer read.
 */

import { storage } from './storage';
import { getUserId } from './auth';

const pendingKey = (): string =>
  `ojo_onboarding_pending_${getUserId() ?? 'anon'}`;

const onboardKey = (): string =>
  `ojo_onboarding_done_${getUserId() ?? 'anon'}`;

// ─── In-memory mirror ──────────────────────────────────────────────────────────
// AuthGate consults these on every navigation to decide routing, so hitting
// AsyncStorage each time added a bridge round-trip per route change. The first
// read warms the cache; the mutators below keep it in sync, so subsequent reads
// resolve without touching storage. resetOnboardingCache() clears it on logout
// (the userId — and thus both keys — changes with the next account).
const pendingCache = new Map<string, boolean>();
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
  await storage.removeItem(pendingKey());
  doneCache.set(key, true);
  pendingCache.set(pendingKey(), false);
};

/**
 * Set by SignupPage once the sign-up form succeeds, so AuthGate runs onboarding.
 * Both callers run after saveAuth, so the new account's id is already known.
 */
export const markOnboardingPending = async (): Promise<void> => {
  const key = pendingKey();
  await storage.setItem(key, 'true');
  pendingCache.set(key, true);
};

export const isOnboardingPending = async (): Promise<boolean> => {
  const key = pendingKey();
  const cached = pendingCache.get(key);
  if (cached !== undefined) return cached;
  const val = (await storage.getItem(key)) === 'true';
  pendingCache.set(key, val);
  return val;
};

/** Drop the in-memory mirror — call on logout so the next account reads fresh. */
export const resetOnboardingCache = (): void => {
  pendingCache.clear();
  doneCache.clear();
};
