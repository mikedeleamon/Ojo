/**
 * ojo-ui-style
 *
 * Local Expo module wrapping UIWindow.overrideUserInterfaceStyle so the app's
 * theme toggle drives every native surface (alerts, share sheets, glass
 * materials, status bar) — not just React-rendered components.
 *
 * No-op on non-iOS platforms; safe to call unconditionally.
 */

import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo-modules-core';

export type OverrideScheme = 'auto' | 'light' | 'dark';

interface OjoUIStyleNative {
  setOverrideUserInterfaceStyle(scheme: OverrideScheme): void;
}

const Native =
  Platform.OS === 'ios'
    ? requireOptionalNativeModule<OjoUIStyleNative>('OjoUIStyle')
    : null;

/**
 * Tell iOS to render this window (and every modal/scene window) as if the
 * system appearance were the supplied scheme. Pass 'auto' to follow the OS.
 *
 * Silently no-ops if the native module hasn't been linked yet (e.g. JS-only
 * dev reload before a fresh prebuild).
 */
export const setOverrideUserInterfaceStyle = (scheme: OverrideScheme): void => {
  Native?.setOverrideUserInterfaceStyle(scheme);
};
