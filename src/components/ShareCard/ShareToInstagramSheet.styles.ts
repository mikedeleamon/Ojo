import { StyleSheet } from 'react-native';
import { fonts, fontSizes } from '../../theme/tokens';
import { CARD_WIDTH, CARD_HEIGHT } from './ShareCardFrame.styles';

/** How far down the full 9:16 card is scaled for the in-sheet preview. */
export const PREVIEW_SCALE = 0.42;
const SCALED_W = CARD_WIDTH * PREVIEW_SCALE;
const SCALED_H = CARD_HEIGHT * PREVIEW_SCALE;

export default StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.72)',
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#0C1422',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 10,
    paddingBottom: 34,
    paddingHorizontal: 22,
    alignItems: 'center',
  },
  grabber: {
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.18)',
    marginBottom: 18,
  },

  // Scaled-down poster preview. The card renders at full 360×640 (so captureRef
  // still snapshots it at full fidelity); the wrapper clips to the scaled box so
  // it doesn't reserve the whole 360×640 of layout.
  previewWrap: {
    width: SCALED_W,
    height: SCALED_H,
    borderRadius: 18,
    overflow: 'hidden',
    marginBottom: 22,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  // The inner box MUST carry the card's real dimensions: a transform pivots
  // about its own layout box, so a stretched-to-parent box (151dp) would scale
  // around the wrong center and slide the card sideways. Pinning the origin to
  // the top-left makes the scaled card land exactly on the wrapper's [0,0].
  previewInner: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    transform: [{ scale: PREVIEW_SCALE }],
    transformOrigin: 'top left',
  },

  actions: {
    width: '100%',
    gap: 10,
  },
  primaryBtn: {
    paddingVertical: 15,
    borderRadius: 16,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  primaryBtnText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: fontSizes.base,
    color: '#0C1422',
  },
  secondaryBtn: {
    paddingVertical: 13,
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  secondaryBtnText: {
    fontFamily: fonts.bodyMedium,
    fontSize: fontSizes.sm,
    color: 'rgba(255,255,255,0.9)',
  },
  closeBtn: {
    marginTop: 2,
    paddingVertical: 10,
    alignItems: 'center',
  },
  closeBtnText: {
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    color: 'rgba(255,255,255,0.55)',
  },
  hint: {
    marginTop: 6,
    fontFamily: fonts.body,
    fontSize: fontSizes.xs,
    color: 'rgba(255,255,255,0.5)',
    textAlign: 'center',
    paddingHorizontal: 24,
  },
});
