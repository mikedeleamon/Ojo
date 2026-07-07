/**
 * Thin wrapper around the platform-native "rate this app" prompt.
 * No custom UI — defers entirely to SKStoreReviewController (iOS) /
 * the Play In-App Review API (Android) via expo-store-review.
 */

import * as StoreReview from 'expo-store-review';

// hasAction() (not isAvailableAsync()) is the check Expo's own docs recommend
// before calling requestReview() — isAvailableAsync() alone reports `false`
// for TestFlight builds, which would make this untestable pre-release.
export const canRequestReview = async (): Promise<boolean> => {
  try {
    return await StoreReview.hasAction();
  } catch {
    return false;
  }
};

// Resolves `true` only if the native call was invoked without error — neither
// platform reports back whether the prompt was actually shown or how the user
// responded, by design (that's what prevents apps from gaming the throttle).
export const requestReview = async (): Promise<boolean> => {
  try {
    if (!(await canRequestReview())) return false;
    await StoreReview.requestReview();
    return true;
  } catch {
    return false;
  }
};
