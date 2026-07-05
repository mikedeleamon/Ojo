import { StyleSheet } from 'react-native';
import { fonts, fontSizes } from '../../theme/tokens';

/** Styles shared across the individual card templates (not the frame itself). */
export default StyleSheet.create({
  eyebrow: {
    fontFamily: fonts.bodySemiBold,
    fontSize: fontSizes.xs,
    letterSpacing: 2,
    color: 'rgba(255,255,255,0.6)',
    textTransform: 'uppercase',
  },
  headline: {
    fontFamily: fonts.display,
    fontSize: fontSizes.xxl,
    color: '#FFFFFF',
    marginTop: 4,
  },
  subline: {
    fontFamily: fonts.body,
    fontSize: fontSizes.base,
    color: 'rgba(255,255,255,0.75)',
    marginTop: 2,
  },
  weatherChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    marginTop: 14,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
  },
  weatherChipText: {
    fontFamily: fonts.bodyMedium,
    fontSize: fontSizes.sm,
    color: '#FFFFFF',
  },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 20,
  },
  photoTile: {
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
  },
  photoImage: {
    width: '100%',
    height: '100%',
  },
  scorePill: {
    alignSelf: 'flex-start',
    marginTop: 18,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1.5,
  },
  scorePillText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: fontSizes.sm,
  },
});
