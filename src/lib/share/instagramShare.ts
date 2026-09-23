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
 *
 * Two kinds of Story: an image (the whole card as a PNG background) or a video
 * (a library loop as the background, the card as a transparent sticker on
 * top — see ShareToInstagramSheet and docs/prerendered-visuals-plan.md, Phase 1).
 */

import { Linking, Platform } from 'react-native';
import { buildStoryOptions, type ShareStoryInput } from './storyOptions';

export { buildStoryOptions, type ShareStoryInput };

const FACEBOOK_APP_ID = process.env.EXPO_PUBLIC_FACEBOOK_APP_ID;

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
 * Shares to Instagram Stories. An image Story falls back to the OS share sheet
 * (Save Image / Messages / etc.) when Instagram isn't installed or the App ID
 * isn't configured — the card is always shareable somehow, never a dead end.
 * A video Story has no image of its own to fall back with, so it resolves
 * 'not-installed' / 'unavailable' / 'error' and the caller shares the image instead.
 */
export async function shareToInstagramStory(
  input: ShareStoryInput,
): Promise<ShareStoryOutcome> {
  const Share = getShareModule();
  if (!Share) return { ok: false, reason: 'unavailable' };

  if (FACEBOOK_APP_ID && (await isInstagramInstalled())) {
    const options = buildStoryOptions(input, FACEBOOK_APP_ID);
    if (!options) return { ok: false, reason: 'error', error: 'backgroundVideo must be a file:// URI' };
    try {
      await Share.shareSingle({ social: Share.Social.INSTAGRAM_STORIES, ...options });
      return { ok: true, via: 'instagram-stories' };
    } catch (err: any) {
      // react-native-share rejects on user-cancel too; treat both the same
      // way the OS share sheet does (no error surfaced to the user).
      if (err?.message === 'User did not share') return { ok: false, reason: 'cancelled' };
      return { ok: false, reason: 'error', error: err?.message };
    }
  }

  if (input.kind === 'video') return { ok: false, reason: FACEBOOK_APP_ID ? 'not-installed' : 'unavailable' };
  return shareViaGenericSheet(input.backgroundImage);
}

/**
 * Public "Save or share elsewhere" path — opens the OS share sheet (Save Image,
 * Messages, Mail…) with the PNG, independent of Instagram or the Facebook App
 * ID. Backs the share sheet's secondary button.
 */
export async function shareImageElsewhere(image: string): Promise<ShareStoryOutcome> {
  return shareViaGenericSheet(image);
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
