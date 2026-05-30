/**
 * Tracks whether the current user has completed first-run onboarding.
 *
 * Keyed by userId so multiple accounts on the same device don't share state.
 * Read by AuthGate (to route signups to /(auth)/onboarding) and written by
 * OnboardingPage on completion.
 */

import { storage } from './storage';
import { getUserId } from './auth';

const onboardKey = (): string =>
  `ojo_onboarding_done_${getUserId() ?? 'anon'}`;

export const isOnboardingComplete = async (): Promise<boolean> => {
  return (await storage.getItem(onboardKey())) === 'true';
};

export const markOnboardingComplete = async (): Promise<void> => {
  await storage.setItem(onboardKey(), 'true');
};
