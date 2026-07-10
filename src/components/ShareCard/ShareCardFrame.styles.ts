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
    paddingHorizontal: 24,
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
  footerText: {
    fontFamily: fonts.bodyMedium,
    fontSize: fontSizes.sm,
    color: 'rgba(255,255,255,0.85)',
    letterSpacing: 0.2,
  },
});
