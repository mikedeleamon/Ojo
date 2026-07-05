/**
 * instagramShare.ts — share a captured card image to Instagram Stories.
 *
 * NATIVE MODULE SETUP REQUIRED (mirrors src/lib/googleSignIn.ts):
 *   1. npm install react-native-share react-native-view-shot (already run)
 *   2. Set EXPO_PUBLIC_FACEBOOK_APP_ID in .env — Instagram has required a
 *      Facebook App ID for "Share to Story" since Jan 2023; without it
 *      Instagram shows "The app you shared from doesn't currently support
 *      sharing to Stories" instead of the composer.
 *   3. Rebuild the dev client: npx expo prebuild && npx expo run:ios
 *      (registers the LSApplicationQueriesSchemes entry from
 *      plugins/withInstagramShareScheme.js, needed for canOpenURL to see
 *      Instagram as installed).
 *
 * isInstagramShareAvailable() gates the UI so share buttons quietly fall back
 * to the generic share sheet until both the native module and the App ID are
 * in place.
 */

import { Linking, Platform } from 'react-native';

const FACEBOOK_APP_ID = process.env.EXPO_PUBLIC_FACEBOOK_APP_ID;

export interface ShareStoryInput {
  /** data:image/png;base64,... — the full card, used as the Story background. */
  backgroundImage: string;
  /** Optional https URL rendered as a tappable "Link" sticker on the story. */
  attributionURL?: string | null;
  backgroundTopColor?: string;
  backgroundBottomColor?: string;
}

export type ShareStoryOutcome =
  | { ok: true; via: 'instagram-stories' | 'share-sheet' }
  | { ok: false; reason: 'unavailable' | 'not-installed' | 'cancelled' | 'error'; error?: string };

function getShareModule(): any | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require('react-native-share').default;
  } catch {
    return null;
  }
}

/** True once the native module + Facebook App ID are both configured. */
export function isInstagramShareAvailable(): boolean {
  return Platform.OS === 'ios' && !!FACEBOOK_APP_ID && !!getShareModule();
}

async function isInstagramInstalled(): Promise<boolean> {
  try {
    return await Linking.canOpenURL('instagram-stories://share');
  } catch {
    return false;
  }
}

/**
 * Shares a pre-rendered PNG (base64) to Instagram Stories, falling back to
 * the OS share sheet (Save Image / Messages / etc.) when Instagram isn't
 * installed or the App ID isn't configured — the card is always shareable
 * somehow, never a dead end.
 */
export async function shareToInstagramStory(
  input: ShareStoryInput,
): Promise<ShareStoryOutcome> {
  const Share = getShareModule();
  if (!Share) return { ok: false, reason: 'unavailable' };

  if (FACEBOOK_APP_ID && (await isInstagramInstalled())) {
    try {
      await Share.shareSingle({
        social: Share.Social.INSTAGRAM_STORIES,
        appId: FACEBOOK_APP_ID,
        backgroundImage: input.backgroundImage,
        backgroundTopColor: input.backgroundTopColor ?? '#0F172A',
        backgroundBottomColor: input.backgroundBottomColor ?? '#1E293B',
        ...(input.attributionURL ? { attributionURL: input.attributionURL } : {}),
      });
      return { ok: true, via: 'instagram-stories' };
    } catch (err: any) {
      // react-native-share rejects on user-cancel too; treat both the same
      // way the OS share sheet does (no error surfaced to the user).
      if (err?.message === 'User did not share') return { ok: false, reason: 'cancelled' };
      return { ok: false, reason: 'error', error: err?.message };
    }
  }

  return shareViaGenericSheet(input.backgroundImage);
}

/** Universal fallback: OS share sheet with the image, no IG/App ID needed. */
async function shareViaGenericSheet(backgroundImage: string): Promise<ShareStoryOutcome> {
  const Share = getShareModule();
  if (!Share) return { ok: false, reason: 'unavailable' };
  try {
    await Share.open({ url: backgroundImage, type: 'image/png', failOnCancel: false });
    return { ok: true, via: 'share-sheet' };
  } catch (err: any) {
    return { ok: false, reason: 'error', error: err?.message };
  }
}
