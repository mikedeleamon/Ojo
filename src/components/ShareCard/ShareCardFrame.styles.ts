import { StyleSheet } from 'react-native';
import { fonts, fontSizes } from '../../theme/tokens';

/**
 * Fixed logical size for every share card. 9:16 matches Instagram Stories
 * exactly, so react-native-view-shot's captured PNG (rendered at the
 * device's pixel ratio, e.g. 3x → 1080x1920) needs no cropping on Instagram's
 * side. Keep every template inside this frame rather than sizing to content.
 */
export const CARD_WIDTH = 360;
export const CARD_HEIGHT = (CARD_WIDTH * 16) / 9;

/**
 * Width of a Story sticker (the card laid over a video loop instead of being
 * the whole story). Narrower than the poster so the loop shows around it;
 * height follows the content.
 */
export const STICKER_WIDTH = 300;
const STICKER_PAD = 22;
const POSTER_PAD = 24;

/** Width the card's content gets inside the frame, e.g. for sizing photo tiles. */
export const contentWidth = (variant: ShareCardVariant): number =>
  variant === 'sticker' ? STICKER_WIDTH - STICKER_PAD * 2 : CARD_WIDTH - POSTER_PAD * 2;

/** 'poster': the whole 9:16 story. 'sticker': a rounded card over a video loop. */
export type ShareCardVariant = 'poster' | 'sticker';

/** The brand mark stickers carry, as the raster the app ships (app/_layout uses it too). */
export const STICKER_LOGO = require('../../../assets/images/logos/ojoLogo.png');

// Instagram's own UI (profile chip up top, reply bar + sticker tray at the
// bottom) covers roughly the outer quarter of a story on each side. Padding
// content out of these bands keeps it from being obscured.
const UNSAFE_BAND = 84;

export default StyleSheet.create({
  frame: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    overflow: 'hidden',
    backgroundColor: '#0F172A',
  },
  gradient: {
    ...StyleSheet.absoluteFillObject,
  },
  safeArea: {
    flex: 1,
    paddingTop: UNSAFE_BAND,
    paddingBottom: UNSAFE_BAND,
    paddingHorizontal: POSTER_PAD,
    justifyContent: 'space-between',
  },
  content: {
    flex: 1,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  // Mostly opaque, so the text reads over any loop without native blur (blur
  // captured over transparent pixels comes out as a flat tint). Transparent
  // outside the rounded corners — Instagram keeps that.
  sticker: {
    width: STICKER_WIDTH,
    padding: STICKER_PAD,
    borderRadius: 28,
    overflow: 'hidden',
    backgroundColor: 'rgba(15,23,42,0.86)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  stickerFooter: {
    marginTop: 18,
  },
  stickerLogo: {
    width: 28,
    height: 28,
  },
  footerText: {
    fontFamily: fonts.bodyMedium,
    fontSize: fontSizes.sm,
    color: 'rgba(255,255,255,0.85)',
    letterSpacing: 0.2,
  },
});
