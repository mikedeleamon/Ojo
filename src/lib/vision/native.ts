/**
 * vision/native.ts — thin, typed access to the OjoVisionBridge native module.
 *
 * Resolves the module by its native registration name via
 * `requireOptionalNativeModule`, so it works without JS package-name
 * resolution for the local `modules/ojo-vision-bridge` module (mirrors
 * `lib/widget/native.ts`).
 *
 * segmentGarment resolves null whenever segmentation isn't available or
 * confident — OS below iOS 17, no bridge linked (Android/Expo Go/web), or no
 * subject found. Callers always treat null as "fall back to the existing
 * crop heuristic," never as an error.
 */

import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo-modules-core';

interface OjoVisionBridgeNative {
  /** Resolves the file:// URI of an RGBA PNG cutout, or null. */
  segmentGarment(uri: string): Promise<string | null>;
}

const Native =
  Platform.OS === 'ios'
    ? requireOptionalNativeModule<OjoVisionBridgeNative>('OjoVisionBridge')
    : null;

/** True only when the native bridge is linked (iOS dev-client / release build). */
export const isVisionBridgeAvailable = (): boolean => Native != null;

/**
 * Segment the primary garment out of `uri`. Resolves null (never throws) on
 * anything short of a confident cutout — pre-iOS-17, no subject found, a
 * native-side failure, or the bridge not being linked at all.
 */
export const segmentGarment = async (uri: string): Promise<string | null> => {
  if (!Native) return null;
  try {
    return await Native.segmentGarment(uri);
  } catch (e) {
    console.warn('[Ojo] segmentGarment failed:', e);
    return null;
  }
};
