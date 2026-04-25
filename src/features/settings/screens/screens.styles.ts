/**
 * screens.styles.ts — cross-platform style definitions for all detail screens
 * (ProfileScreen, PasswordScreen, PreferencesScreen, SimpleScreens)
 *
 * RN migration steps:
 *   1. import { styles } from './screens.styles';
 *   2. Replace className={styles.x} → style={styles.x}
 *   3. Add StyleSheet.create() wrapper around the export
 *   4. Delete screens.module.css
 *
 * Web-only features dropped automatically by RN:
 *   - cursor, transition, :hover, :focus, :active, :disabled pseudo-selectors
 *   - ::placeholder → use placeholderTextColor prop on <TextInput> instead
 *   - backdrop-filter → use <BlurView> from @react-native-community/blur
 *   - CSS animations (@keyframes) → use Animated API or Reanimated
 *   - box-shadow → use shadow* style props (shadowColor, shadowOffset, etc.)
 *   - text-overflow / white-space → use numberOfLines prop on <Text>
 *   - position: fixed / position: sticky → not available in RN
 *   - overflow: hidden on modals → works differently, use Modal component instead
 */

import { StyleSheet } from 'react-native';
import { colors, spacing, radius, fonts, fontSizes, fontWeights } from '../../../theme/tokens';

// ─── Forms ────────────────────────────────────────────────────────────────────

const form = {
  formGroup: {
    flexDirection: 'column' as const,
    gap:           8,
  },

  label: {
    fontSize:      fontSizes.xs,       // ~11px
    fontWeight:    fontWeights.medium,
    letterSpacing: 0.1 * fontSizes.xs,
    textTransform: 'uppercase' as const,
    color:         colors.textMuted,
  },

  input: {
    width:             '100%' as const,
    paddingVertical:   12,
    paddingHorizontal: spacing.md,
    backgroundColor:   colors.glassBg,
    borderWidth:       1,
    borderColor:       colors.glassBorder,
    borderRadius:      radius.sm,
    color:             colors.textPrimary,
    fontFamily:        fonts.body,
    fontSize:          fontSizes.base,  // 15px
    fontWeight:        fontWeights.light,
    // Web-only: outline, transition, ::placeholder, :focus
    // RN: use placeholderTextColor={colors.textMuted} on <TextInput>
  },

  saveBtn: {
    width:             '100%' as const,
    paddingVertical:   14,
    paddingHorizontal: spacing.md,
    backgroundColor:   colors.saveBtnBg,
    borderRadius:      radius.sm,
    alignItems:        'center' as const,
    // Web-only: cursor, transition, :hover, :active, :disabled
    // RN: disabled prop on Pressable handles this automatically
  },

  saveBtnText: {
    fontFamily: fonts.body,
    fontSize:   fontSizes.base,
    fontWeight: fontWeights.semibold,
    color:      colors.saveBtnText,
  },

  saveBtnDisabled: {
    opacity: 0.5,
  },
};

// ─── Status messages ──────────────────────────────────────────────────────────

const status = {
  // Base container — combine with success/error for coloured variants
  statusMsgBase: {
    paddingVertical:   10,
    paddingHorizontal: spacing.md,
    borderRadius:      radius.sm,
    fontSize:          14,
  },

  // Keep statusMsg as alias for backward compat
  statusMsg: {
    paddingVertical:   10,
    paddingHorizontal: spacing.md,
    borderRadius:      radius.sm,
    fontSize:          14,
  },

  success: {
    backgroundColor: colors.successBg,
    borderWidth:     1,
    borderColor:     colors.successBorder,
    // Note: color belongs on <Text> inside, not the <View> — use colors.successText
  },

  error: {
    backgroundColor: colors.errorBg,
    borderWidth:     1,
    borderColor:     colors.errorBorder,
    // Note: color belongs on <Text> inside, not the <View> — use colors.errorText
  },
};

// ─── Section headers ──────────────────────────────────────────────────────────

const sections = {
  section: {
    flexDirection: 'column' as const,
    gap:           spacing.sm,
  },

  sectionLabel: {
    fontSize:          fontSizes.xs,
    fontWeight:        fontWeights.medium,
    letterSpacing:     0.1 * fontSizes.xs,
    textTransform:     'uppercase' as const,
    color:             colors.textMuted,
    paddingBottom:     2,
    borderBottomWidth: 1,
    borderBottomColor: colors.glassBorder,
  },

  hint: {
    fontSize:   13,                    // 0.82rem
    color:      colors.textMuted,
    lineHeight: 13 * 1.6,
  },
};

// ─── Chip picker ──────────────────────────────────────────────────────────────

const chips = {
  chipGrid: {
    flexDirection: 'row'   as const,
    flexWrap:      'wrap'  as const,
    gap:           spacing.xs,
  },

  chip: {
    paddingVertical:   7,
    paddingHorizontal: 16,
    backgroundColor:   colors.glassBg,
    borderWidth:       1,
    borderColor:       colors.glassBorder,
    borderRadius:      radius.pill,
    // Web-only: cursor, transition
  },

  chipText: {
    fontFamily: fonts.body,
    fontSize:   fontSizes.sm,          // 13px
    color:      colors.textSecondary,
  },

  chipActive: {
    backgroundColor: colors.saveBtnBg,
    borderWidth:     0,
  },

  chipTextActive: {
    color:      colors.saveBtnText,
    fontWeight: fontWeights.semibold,
  },
};

// ─── Segmented control ────────────────────────────────────────────────────────

const segmented = {
  segmented: {
    flexDirection:   'row'   as const,
    gap:             4,
    backgroundColor: colors.glassBg,
    borderWidth:     1,
    borderColor:     colors.glassBorder,
    borderRadius:    radius.sm,
    padding:         4,
  },

  seg: {
    flex:              1,
    paddingVertical:   8,
    paddingHorizontal: 24,
    borderRadius:      6,
    alignItems:        'center' as const,
    // Web-only: cursor, transition
  },

  segText: {
    fontFamily: fonts.body,
    fontSize:   fontSizes.base,
    fontWeight: fontWeights.medium,
    color:      colors.textSecondary,
  },

  segActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
  },

  segTextActive: {
    color: colors.textPrimary,
  },
};

// ─── Sliders ──────────────────────────────────────────────────────────────────
// RN migration: use @react-native-community/slider or expo-slider

const sliders = {
  sliderRow: {
    flexDirection: 'column' as const,
    gap:           6,
  },

  sliderMeta: {
    flexDirection:  'row'           as const,
    justifyContent: 'space-between' as const,
    alignItems:     'center'        as const,
  },

  sliderLabel: {
    fontSize: fontSizes.sm,
    color:    colors.textSecondary,
  },

  sliderValue: {
    fontSize:   fontSizes.base,
    fontWeight: fontWeights.medium,
    color:      colors.textPrimary,
  },
};

// ─── Info cards ───────────────────────────────────────────────────────────────

const infoCards = {
  infoCard: {
    backgroundColor: colors.glassBg,
    borderWidth:     1,
    borderColor:     colors.glassBorder,
    borderRadius:    radius.sm,
    padding:         16,
    flexDirection:   'column' as const,
    gap:             6,
  },

  infoTitle: {
    fontSize:   fontSizes.base - 1,   // ~14px / 0.9rem
    fontWeight: fontWeights.semibold,
    color:      colors.textPrimary,
  },

  infoBody: {
    fontSize:   fontSizes.sm,
    color:      colors.textSecondary,
    lineHeight: fontSizes.sm * 1.65,
  },
};

// ─── History ──────────────────────────────────────────────────────────────────

const history = {
  historyList: {
    flexDirection: 'column' as const,
    gap:           spacing.sm,
  },

  historyCard: {
    position:        'relative'  as const,
    flexDirection:   'column'    as const,
    gap:             6,
    padding:         spacing.md,
    backgroundColor: colors.glassBg,
    borderWidth:     1,
    borderColor:     colors.glassBorder,
    borderRadius:    radius.md,
    // Web-only: transition, animation (fadeUp), :hover
  },

  historyMeta: {
    flexDirection: 'row'     as const,
    alignItems:    'center'  as const,
    gap:           spacing.sm,
    flexWrap:      'wrap'    as const,
  },

  historyDate: {
    fontSize:      13,
    fontWeight:    fontWeights.semibold,
    color:         colors.textPrimary,
    letterSpacing: 0.01 * 13,
  },

  historyCloset: {
    fontSize:          12,
    color:             colors.textMuted,
    backgroundColor:   colors.glassBg,
    borderWidth:       1,
    borderColor:       colors.glassBorder,
    borderRadius:      radius.pill,
    paddingVertical:   2,
    paddingHorizontal: 8,
  },

  historySummary: {
    fontSize:    14,
    color:       colors.textSecondary,
    lineHeight:  14 * 1.55,
    fontWeight:  fontWeights.light,
    paddingRight: 28,
  },

  historyDeleteBtn: {
    position:        'absolute' as const,
    top:             spacing.md,
    right:           spacing.md,
    width:           24,
    height:          24,
    alignItems:      'center' as const,
    justifyContent:  'center' as const,
    backgroundColor: 'transparent',
    borderRadius:    12,
  },

  clearAllBtn: {
    alignSelf:         'flex-end' as const,
    paddingVertical:   6,
    paddingHorizontal: 14,
    backgroundColor:   'transparent',
    borderWidth:       1,
    borderColor:       colors.dangerBorder,
    borderRadius:      radius.pill,
  },

  clearAllBtnText: {
    color:      colors.dangerText,
    fontFamily: fonts.body,
    fontSize:   12,
  },

  confirmRow: {
    flexDirection: 'row'     as const,
    alignItems:    'center'  as const,
    gap:           8,
    flexWrap:      'wrap'    as const,
  },

  confirmText: {
    fontSize: 12,
    color:    colors.textSecondary,
    flex:     1,
  },

  confirmYes: {
    paddingVertical:   5,
    paddingHorizontal: 12,
    backgroundColor:   colors.dangerBg,
    borderWidth:       1,
    borderColor:       colors.dangerBorder,
    borderRadius:      radius.pill,
  },

  confirmYesText: {
    color:      colors.dangerTextHi,
    fontFamily: fonts.body,
    fontSize:   12,
  },

  confirmNo: {
    paddingVertical:   5,
    paddingHorizontal: 12,
    backgroundColor:   'transparent',
    borderWidth:       1,
    borderColor:       colors.glassBorder,
    borderRadius:      radius.pill,
  },

  confirmNoText: {
    color:      colors.textSecondary,
    fontFamily: fonts.body,
    fontSize:   12,
  },
};

// ─── Danger zone ──────────────────────────────────────────────────────────────

const danger = {
  dangerCard: {
    backgroundColor: colors.dangerBg,
    borderWidth:     1,
    borderColor:     'rgba(239, 68, 68, 0.18)',
    borderRadius:    radius.sm,
    padding:         20,
    flexDirection:   'column' as const,
    gap:             10,
  },

  dangerTitle: {
    fontSize:      12,
    fontWeight:    fontWeights.semibold,
    letterSpacing: 0.08 * 12,
    textTransform: 'uppercase' as const,
    color:         'rgba(252, 165, 165, 0.75)',
  },

  dangerBody: {
    fontSize:   fontSizes.sm,
    color:      colors.textSecondary,
    lineHeight: fontSizes.sm * 1.6,
  },

  dangerBtn: {
    alignSelf:         'flex-start' as const,
    paddingVertical:   8,
    paddingHorizontal: 16,
    backgroundColor:   'rgba(239, 68, 68, 0.10)',
    borderWidth:       1,
    borderColor:       'rgba(239, 68, 68, 0.28)',
    borderRadius:      radius.sm,
  },

  dangerBtnText: {
    fontFamily: fonts.body,
    fontSize:   fontSizes.sm,
    fontWeight: fontWeights.medium,
    color:      colors.dangerText,
  },

  dangerConfirmRow: {
    flexDirection: 'row'    as const,
    alignItems:    'center' as const,
    gap:           8,
    flexWrap:      'wrap'   as const,
  },

  dangerConfirmLabel: {
    fontSize: 13,
    color:    colors.textSecondary,
    flex:     1,
    minWidth: 100,
  },

  dangerBtnConfirm: {
    paddingVertical:   7,
    paddingHorizontal: 14,
    backgroundColor:   'rgba(239, 68, 68, 0.15)',
    borderWidth:       1,
    borderColor:       'rgba(239, 68, 68, 0.35)',
    borderRadius:      radius.sm,
  },

  dangerBtnConfirmText: {
    fontFamily: fonts.body,
    fontSize:   13,
    fontWeight: fontWeights.medium,
    color:      colors.dangerTextHi,
  },

  dangerBtnCancel: {
    paddingVertical:   7,
    paddingHorizontal: 14,
    backgroundColor:   'transparent',
    borderWidth:       1,
    borderColor:       colors.glassBorder,
    borderRadius:      radius.sm,
  },

  dangerBtnCancelText: {
    fontFamily: fonts.body,
    fontSize:   13,
    color:      colors.textSecondary,
  },
};

// ─── Delete confirmation modal ────────────────────────────────────────────────
// RN migration:
//   modalOverlay  → wrap with <Modal transparent animationType="fade">
//   modalBackdrop → <Pressable style={[styles.modalBackdrop, StyleSheet.absoluteFillObject]}>
//   modalCard     → unchanged — position relative + zIndex works identically in RN

const modal = {
  // Outer container: fills the screen, flex-centers the card
  // Wrap with <Modal transparent animationType="fade"> in RN
  modalOverlay: {
    position:       'absolute' as const,
    top:            0,
    left:           0,
    right:          0,
    bottom:         0,
    zIndex:         200,
    alignItems:     'center'  as const,
    justifyContent: 'center'  as const,
    padding:        24,
  },

  // Backdrop: fills the overlay behind the card
  // RN: use StyleSheet.absoluteFillObject + backgroundColor
  modalBackdrop: {
    position:        'absolute' as const,
    top:             0,
    left:            0,
    right:           0,
    bottom:          0,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    // Web-only: backdrop-filter set in CSS module
  },

  // Card: sits above the backdrop via position relative + zIndex
  // RN: position relative + zIndex works identically
  modalCard: {
    position:        'relative' as const,
    zIndex:          1,
    width:           '100%'   as const,
    maxWidth:        360,
    backgroundColor: colors.glassBgStrong,
    borderWidth:     1,
    borderColor:     colors.glassBorder,
    borderRadius:    radius.lg,
    paddingTop:      28,
    paddingBottom:   22,
    paddingHorizontal: 24,
    flexDirection:   'column' as const,
    gap:             12,
    // Web-only: animation (modalIn)
  },

  modalIcon: {
    width:           44,
    height:          44,
    borderRadius:    22,
    backgroundColor: 'rgba(239, 68, 68, 0.10)',
    borderWidth:     1,
    borderColor:     'rgba(239, 68, 68, 0.20)',
    alignItems:      'center' as const,
    justifyContent:  'center' as const,
    flexShrink:      0,
  },

  modalTitle: {
    fontSize:   17,                    // 1.05rem
    fontWeight: fontWeights.semibold,
    color:      colors.textPrimary,
  },

  modalBody: {
    fontSize:   14,
    color:      colors.textSecondary,
    lineHeight: 14 * 1.6,
  },

  modalActions: {
    flexDirection: 'row' as const,
    gap:           10,
    marginTop:     4,
  },

  modalCancel: {
    flex:              1,
    paddingVertical:   12,
    paddingHorizontal: spacing.md,
    backgroundColor:   colors.glassBg,
    borderWidth:       1,
    borderColor:       colors.glassBorder,
    borderRadius:      radius.sm,
    alignItems:        'center' as const,
  },

  modalCancelText: {
    fontFamily: fonts.body,
    fontSize:   fontSizes.base - 1,
    fontWeight: fontWeights.medium,
    color:      colors.textSecondary,
  },

  modalConfirm: {
    flex:              1,
    paddingVertical:   12,
    paddingHorizontal: spacing.md,
    backgroundColor:   'rgba(239, 68, 68, 0.15)',
    borderWidth:       1,
    borderColor:       'rgba(239, 68, 68, 0.35)',
    borderRadius:      radius.sm,
    alignItems:        'center' as const,
  },

  modalConfirmText: {
    fontFamily: fonts.body,
    fontSize:   fontSizes.base - 1,
    fontWeight: fontWeights.semibold,
    color:      colors.dangerTextHi,
  },
};

// ─── Merged export ────────────────────────────────────────────────────────────

export const styles = StyleSheet.create({
  ...form,
  ...status,
  ...sections,
  ...chips,
  ...segmented,
  ...sliders,
  ...infoCards,
  ...history,
  ...danger,
  ...modal,
});
