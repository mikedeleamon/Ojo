import { StyleSheet } from 'react-native';
import { fonts, fontSizes, radius, spacing } from '../../theme/tokens';

export default StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardShadowWrap: {
    borderRadius: 24,
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
  },
  actions: {
    marginTop: spacing.lg,
    width: '86%',
    gap: 10,
  },
  primaryBtn: {
    paddingVertical: 14,
    borderRadius: radius.md,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  primaryBtnText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: fontSizes.base,
    color: '#0D1B2A',
  },
  closeBtn: {
    marginTop: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  closeBtnText: {
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    color: 'rgba(255,255,255,0.6)',
  },
  hint: {
    marginTop: 10,
    fontFamily: fonts.body,
    fontSize: fontSizes.xs,
    color: 'rgba(255,255,255,0.5)',
    textAlign: 'center',
    paddingHorizontal: 24,
  },
});
