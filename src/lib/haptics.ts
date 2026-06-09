/**
 * haptics.ts
 * ----------
 * Thin, fire-and-forget wrappers around expo-haptics so the app speaks one
 * consistent tactile vocabulary. Every call is best-effort — failures (e.g.
 * unsupported hardware, web) are swallowed so callers never need try/catch.
 *
 * Vocabulary:
 *   selection → light tick for reversible picks (chips, toggles, auto-save taps)
 *   impact    → a physical "thunk" for direct actions (shutter capture)
 *   success   → a completed, consequential action (outfit logged, settings saved)
 *   warning   → a destructive confirmation is being requested
 *   error     → an action failed
 */

import * as Haptics from 'expo-haptics';

export const hapticSelection = (): void => {
  Haptics.selectionAsync().catch(() => {});
};

export const hapticImpact = (
  style: Haptics.ImpactFeedbackStyle = Haptics.ImpactFeedbackStyle.Medium,
): void => {
  Haptics.impactAsync(style).catch(() => {});
};

export const hapticSuccess = (): void => {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
};

export const hapticWarning = (): void => {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
};

export const hapticError = (): void => {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
};
