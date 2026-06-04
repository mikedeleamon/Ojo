/**
 * Tracks first-run onboarding.
 *
 * Onboarding is gated on an explicit "pending" signal that is set ONLY when the
 * sign-up information form is completed (see SignupPage). It is intentionally
 * NOT inferred from login state — that way a returning user whose credentials
 * are remembered, or who signs in via the login screen, never re-sees the
 * first-run flow.
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

export const isOnboardingComplete = async (): Promise<boolean> => {
  return (await storage.getItem(onboardKey())) === 'true';
};

export const markOnboardingComplete = async (): Promise<void> => {
  await storage.setItem(onboardKey(), 'true');
  await storage.removeItem(PENDING_KEY);
};

/** Set by SignupPage once the sign-up form succeeds, so AuthGate runs onboarding. */
export const markOnboardingPending = async (): Promise<void> => {
  await storage.setItem(PENDING_KEY, 'true');
};

export const isOnboardingPending = async (): Promise<boolean> => {
  return (await storage.getItem(PENDING_KEY)) === 'true';
};
