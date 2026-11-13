/**
 * background/locationAccess.ts — the "Always" location permission.
 *
 * Ojo works with "While Using" location, but with it the phone's position is
 * only known while the app is open, so the morning brief, weather alerts and
 * widgets describe wherever Ojo was last opened. "Always" lets iOS wake Ojo
 * when the phone leaves the area it was in (lib/background/geofence.ts), which
 * is what keeps those describing where the user actually is.
 *
 * Asked for from Notification Settings only — through a one-button "Continue"
 * banner, per the pre-permission rule App Review enforced on build 31.
 */

import * as Location from 'expo-location';

/**
 * - `always`  — granted.
 * - `askable` — not granted, and iOS will still show its prompt.
 * - `blocked` — not granted, and only the Settings app can change that (iOS
 *               shows the "Change to Always Allow" prompt once).
 */
export type BackgroundLocationAccess = 'always' | 'askable' | 'blocked';

export const getBackgroundLocationAccess = async (): Promise<BackgroundLocationAccess> => {
  try {
    const bg = await Location.getBackgroundPermissionsAsync();
    if (bg.status === 'granted') return 'always';
    if (!bg.canAskAgain) return 'blocked';
    const fg = await Location.getForegroundPermissionsAsync();
    if (fg.status === 'denied' && !fg.canAskAgain) return 'blocked';
    return 'askable';
  } catch {
    return 'blocked';
  }
};

/**
 * Show iOS's prompts: "While Using" first if that hasn't been granted (iOS
 * won't offer "Always" without it), then the upgrade to "Always".
 */
export const requestBackgroundLocation = async (): Promise<BackgroundLocationAccess> => {
  try {
    const fg = await Location.requestForegroundPermissionsAsync();
    if (fg.status !== 'granted') return fg.canAskAgain ? 'askable' : 'blocked';
    const bg = await Location.requestBackgroundPermissionsAsync();
    if (bg.status === 'granted') return 'always';
    return bg.canAskAgain ? 'askable' : 'blocked';
  } catch {
    return 'blocked';
  }
};
