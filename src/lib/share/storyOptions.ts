/**
 * storyOptions.ts — the pure half of instagramShare: what a Story is, and the
 * options react-native-share gets for it. Kept free of react-native imports so
 * jest can load it (__tests__/storyOptions.test.ts), like
 * visualLibrary/cachePolicy.
 */

interface ShareStoryCommon {
  /** Optional https URL rendered as a tappable "Link" sticker on the story. */
  attributionURL?: string | null;
  backgroundTopColor?: string;
  backgroundBottomColor?: string;
}

export type ShareStoryInput =
  | (ShareStoryCommon & {
      kind: 'image';
      /** data:image/png;base64,... — the full card, used as the Story background. */
      backgroundImage: string;
    })
  | (ShareStoryCommon & {
      kind: 'video';
      /** file:// URI of a library loop (visualLibrary/cache ensureLocal). */
      backgroundVideo: string;
      /** data:image/png;base64,... — the card as a sticker, transparent outside its corners. */
      stickerImage: string;
    });

/**
 * The options react-native-share's INSTAGRAM_STORIES takes, minus `social`.
 * Null for a video that isn't a file:// URI: the iOS side
 * (InstagramStories.m) reads any other URL as a Photos library id, and with
 * an https URL its promise never settles and Instagram never opens.
 */
export function buildStoryOptions(
  input: ShareStoryInput,
  appId: string,
): Record<string, string> | null {
  const common = {
    appId,
    backgroundTopColor: input.backgroundTopColor ?? '#0F172A',
    backgroundBottomColor: input.backgroundBottomColor ?? '#1E293B',
    ...(input.attributionURL ? { attributionURL: input.attributionURL } : {}),
  };
  if (input.kind === 'image') return { ...common, backgroundImage: input.backgroundImage };
  if (!input.backgroundVideo.startsWith('file://')) return null;
  return { ...common, backgroundVideo: input.backgroundVideo, stickerImage: input.stickerImage };
}
