import { StyleSheet } from 'react-native';
import {
  ColorTokens,
  spacing,
  radius,
  fonts,
  fontSizes,
  fontWeights,
  shadows,
} from '../../theme/tokens';

export const makeStyles = (colors: ColorTokens) => StyleSheet.create({
  root:   { flex: 1, backgroundColor: colors.bgDefault },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: spacing.md },

  card: {
    backgroundColor: colors.glassBg,
    borderWidth:     1,
    borderColor:     colors.glassBorder,
    borderRadius:    radius.lg,
    paddingTop:      spacing.xl,
    paddingBottom:   spacing.lg,
    paddingHorizontal: spacing.lg,
    ...shadows.glass,
  },

  stepShell: {
    alignItems: 'center',
    gap:        spacing.md,
  },

  heading: {
    fontFamily:    fonts.display,
    fontSize:      34,
    color:         colors.textPrimary,
    letterSpacing: -0.02 * 34,
    textAlign:     'center',
    lineHeight:    34 * 1.1,
  },
  sub: {
    fontFamily: fonts.body,
    fontSize:   fontSizes.base,
    color:      colors.textSecondary,
    textAlign:  'center',
    lineHeight: fontSizes.base * 1.65,
  },
  illustrationRow: {
    flexDirection: 'row',
    gap:           spacing.md,
    marginVertical: spacing.sm,
  },
  iconPill: {
    width:           56,
    height:          56,
    borderRadius:    28,
    backgroundColor: colors.glassBg,
    borderWidth:     1,
    borderColor:     colors.glassBorder,
    alignItems:      'center',
    justifyContent:  'center',
  },

  stepHeading: {
    fontFamily:    fonts.display,
    fontSize:      27,
    color:         colors.textPrimary,
    letterSpacing: -0.02 * 27,
    textAlign:     'center',
  },
  stepDesc: {
    fontFamily: fonts.body,
    fontSize:   fontSizes.sm,
    color:      colors.textSecondary,
    textAlign:  'center',
    lineHeight: fontSizes.sm * 1.6,
  },

  primaryBtn: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             8,
    paddingVertical: 13,
    paddingHorizontal: 28,
    backgroundColor: colors.saveBtnBg,
    borderRadius:    radius.pill,
  },
  primaryBtnDisabled: {
    opacity: 0.45,
  },
  primaryBtnText: {
    fontFamily:  fonts.body,
    fontSize:    fontSizes.base,
    fontWeight:  fontWeights.semibold,
    color:       colors.saveBtnText,
  },
  ghostBtn: {
    paddingVertical:   12,
    paddingHorizontal: 20,
    backgroundColor:   'transparent',
    borderWidth:       1,
    borderColor:       colors.glassBorder,
    borderRadius:      radius.pill,
  },
  ghostBtnText: {
    fontFamily: fonts.body,
    fontSize:   fontSizes.sm,
    color:      colors.textSecondary,
  },
  navRow: {
    flexDirection: 'row',
    gap:           spacing.sm,
    alignItems:    'center',
    justifyContent:'center',
    width:         '100%',
    marginTop:     spacing.xs,
  },
  skipLink: {
    fontFamily:         fonts.body,
    fontSize:           12,
    color:              colors.textMuted,
    textDecorationLine: 'underline',
  },

  inputRow: { width: '100%' },
  textInput: {
    width:             '100%',
    paddingVertical:   14,
    paddingHorizontal: spacing.md,
    backgroundColor:   colors.glassBg,
    borderWidth:       1,
    borderColor:       'rgba(255,255,255,0.28)',
    borderRadius:      radius.sm,
    color:             colors.textPrimary,
    fontFamily:        fonts.body,
    fontSize:          fontSizes.base,
    textAlign:         'center',
  },
  successBadge: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             8,
    paddingVertical: 10,
    paddingHorizontal: 18,
    backgroundColor: 'rgba(52,211,153,0.10)',
    borderWidth:     1,
    borderColor:     'rgba(52,211,153,0.30)',
    borderRadius:    radius.pill,
  },
  successText: {
    fontFamily: fonts.body,
    fontSize:   fontSizes.sm,
    color:      'rgba(52,211,153,0.9)',
  },
  errText: {
    fontFamily: fonts.body,
    fontSize:   12,
    color:      'rgba(252,165,165,0.9)',
    textAlign:  'center',
  },

  prefSection: {
    width: '100%',
    gap:   spacing.sm,
  },
  prefLabel: {
    fontFamily:      fonts.body,
    fontSize:        fontSizes.xs,
    fontWeight:      fontWeights.semibold,
    letterSpacing:   0.1 * fontSizes.xs,
    textTransform:   'uppercase',
    color:           colors.textMuted,
  },
  chipGrid: {
    flexDirection: 'row',
    flexWrap:      'wrap',
    gap:           8,
  },
  chip: {
    paddingVertical:   7,
    paddingHorizontal: 16,
    backgroundColor:   colors.glassBg,
    borderWidth:       1,
    borderColor:       colors.glassBorder,
    borderRadius:      radius.pill,
  },
  chipActive: {
    backgroundColor: colors.saveBtnBg,
    borderWidth:     0,
  },
  chipText: {
    fontFamily: fonts.body,
    fontSize:   fontSizes.sm,
    color:      colors.textSecondary,
  },
  chipTextActive: {
    color:      colors.saveBtnText,
    fontWeight: fontWeights.semibold,
  },
  segmented: {
    flexDirection: 'row',
    borderWidth:   1,
    borderColor:   colors.glassBorder,
    borderRadius:  radius.sm,
    overflow:      'hidden',
  },
  seg: {
    flex:            1,
    paddingVertical: 10,
    alignItems:      'center',
    justifyContent:  'center',
  },
  segDivider: {
    borderRightWidth: 1,
    borderRightColor: colors.glassBorder,
  },
  segActive: {
    backgroundColor: 'rgba(255,255,255,0.9)',
  },
  segText: {
    fontFamily: fonts.body,
    fontSize:   fontSizes.sm,
    color:      colors.textSecondary,
  },
  segTextActive: {
    color:      colors.saveBtnText,
    fontWeight: fontWeights.semibold,
  },

  logo: {
    height: 36,
    width:  160,
  },
});
