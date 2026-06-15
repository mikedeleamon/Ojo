import { StyleSheet } from 'react-native';
import {
  ColorTokens,
  fonts,
  fontSizes,
  fontWeights,
  spacing,
  radius,
} from '../../theme/tokens';

export const makeStyles = (colors: ColorTokens) =>
  StyleSheet.create({
    // ── Layout ────────────────────────────────────────────────────────────────
    root: {
      flex: 1,
      backgroundColor: colors.bgDefault,
    },
    scroll: {
      flex: 1,
    },
    scrollContent: {
      padding: spacing.md,
      gap: spacing.md,
      paddingBottom: spacing.xl,
    },

    // ── Screen header ─────────────────────────────────────────────────────────
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingTop: spacing.sm,
      paddingBottom: spacing.xs,
    },
    headerTitle: {
      fontFamily: fonts.display,
      fontSize: fontSizes.xxl,
      color: colors.textPrimary,
    },
    rangeChip: {
      paddingVertical: 4,
      paddingHorizontal: spacing.sm,
      backgroundColor: colors.glassBg,
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: colors.glassBorder,
    },
    rangeChipText: {
      fontFamily: fonts.body,
      fontSize: fontSizes.xs,
      color: colors.textMuted,
      fontWeight: fontWeights.medium,
    },

    // ── Section label ─────────────────────────────────────────────────────────
    sectionLabel: {
      fontFamily: fonts.body,
      fontSize: fontSizes.xs,
      fontWeight: fontWeights.semibold,
      color: colors.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
      marginBottom: 2,
    },

    // ── Health card ───────────────────────────────────────────────────────────
    healthCard: {
      borderRadius: radius.lg,
      padding: spacing.md,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
    },
    ringWrap: {
      alignItems: 'center',
      justifyContent: 'center',
      width: 140,
      height: 140,
    },
    ringCenter: {
      position: 'absolute',
      alignItems: 'center',
      justifyContent: 'center',
    },
    ringPct: {
      fontFamily: fonts.display,
      fontSize: fontSizes.xl,
      color: colors.textPrimary,
    },
    ringLabel: {
      fontFamily: fonts.body,
      fontSize: fontSizes.xs,
      color: colors.textMuted,
      marginTop: -2,
    },
    healthStats: {
      flex: 1,
      gap: spacing.sm,
    },
    statRow: {
      gap: 3,
    },
    statValue: {
      fontFamily: fonts.display,
      fontSize: fontSizes.lg,
      color: colors.textPrimary,
      lineHeight: 22,
    },
    statLabel: {
      fontFamily: fonts.body,
      fontSize: fontSizes.xs,
      color: colors.textMuted,
    },
    statDivider: {
      height: 1,
      backgroundColor: colors.glassBorder,
    },

    // ── Style DNA card ────────────────────────────────────────────────────────
    dnaCard: {
      borderRadius: radius.lg,
      padding: spacing.md,
      gap: spacing.md,
    },
    dnaHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    dnaTitle: {
      fontFamily: fonts.display,
      fontSize: fontSizes.lg,
      color: colors.textPrimary,
    },
    dnaBadge: {
      paddingVertical: 3,
      paddingHorizontal: 8,
      borderRadius: radius.pill,
      backgroundColor: colors.successBg,
      borderWidth: 1,
      borderColor: colors.successBorder,
    },
    dnaBadgeLearning: {
      backgroundColor: colors.glassBg,
      borderColor: colors.glassBorder,
    },
    dnaBadgeText: {
      fontFamily: fonts.body,
      fontSize: fontSizes.xs,
      color: colors.successText,
      fontWeight: fontWeights.medium,
    },
    dnaBadgeTextLearning: {
      color: colors.textMuted,
    },
    colorRow: {
      flexDirection: 'row',
      gap: spacing.md,
    },
    colorItem: {
      alignItems: 'center',
      gap: 5,
    },
    colorSwatch: {
      width: 40,
      height: 40,
      borderRadius: 20,
      borderWidth: 1.5,
      borderColor: colors.glassBorder,
      overflow: 'hidden',
    },
    colorName: {
      fontFamily: fonts.body,
      fontSize: fontSizes.xs,
      color: colors.textSecondary,
    },
    colorPct: {
      fontFamily: fonts.body,
      fontSize: fontSizes.xs,
      color: colors.textMuted,
    },
    tagRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.xs,
    },
    tag: {
      paddingVertical: 4,
      paddingHorizontal: 10,
      borderRadius: radius.pill,
      backgroundColor: colors.glassBg,
      borderWidth: 1,
      borderColor: colors.glassBorder,
    },
    tagText: {
      fontFamily: fonts.body,
      fontSize: fontSizes.sm,
      color: colors.textSecondary,
    },
    chordSection: {
      gap: spacing.sm,
      alignItems: 'stretch',
    },

    // ── Color Palette card ────────────────────────────────────────────────────
    paletteCard: {
      borderRadius: radius.lg,
      padding: spacing.md,
      gap: spacing.sm,
    },

    // ── Top Performers horizontal list ────────────────────────────────────────
    topWornCard: {
      borderRadius: radius.lg,
      padding: spacing.md,
      gap: spacing.sm,
    },
    topWornList: {
      gap: spacing.sm,
    },
    topWornTile: {
      width: 90,
      gap: 5,
      alignItems: 'center',
    },
    topWornImgWrap: {
      width: 80,
      height: 80,
      borderRadius: radius.sm,
      backgroundColor: colors.glassBg,
      borderWidth: 1,
      borderColor: colors.glassBorder,
      overflow: 'hidden',
      alignItems: 'center',
      justifyContent: 'center',
    },
    topWornImg: {
      width: 80,
      height: 80,
    },
    topWornBadge: {
      position: 'absolute',
      bottom: 4,
      right: 4,
      paddingVertical: 2,
      paddingHorizontal: 5,
      borderRadius: radius.pill,
      backgroundColor: colors.saveBtnBg,
    },
    topWornBadgeText: {
      fontFamily: fonts.body,
      fontSize: 10,
      fontWeight: fontWeights.semibold,
      color: colors.saveBtnText,
    },
    topWornName: {
      fontFamily: fonts.body,
      fontSize: fontSizes.xs,
      color: colors.textSecondary,
      textAlign: 'center',
    },

    // ── CPW card ──────────────────────────────────────────────────────────────
    cpwCard: {
      borderRadius: radius.lg,
      padding: spacing.md,
      gap: spacing.sm,
    },
    cpwRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    cpwThumb: {
      width: 48,
      height: 48,
      borderRadius: radius.sm,
      backgroundColor: colors.glassBg,
      borderWidth: 1,
      borderColor: colors.glassBorder,
      overflow: 'hidden',
    },
    cpwThumbImg: {
      width: 48,
      height: 48,
    },
    cpwInfo: {
      flex: 1,
      gap: 2,
    },
    cpwName: {
      fontFamily: fonts.body,
      fontSize: fontSizes.sm,
      color: colors.textPrimary,
      fontWeight: fontWeights.medium,
    },
    cpwValue: {
      fontFamily: fonts.display,
      fontSize: fontSizes.base,
      color: colors.textSecondary,
    },
    cpwEmoji: {
      fontSize: 20,
    },
    cpwNudge: {
      fontFamily: fonts.body,
      fontSize: fontSizes.xs,
      color: colors.textMuted,
      marginTop: spacing.xs,
    },

    // ── Price backfill nudge (unlocks cost-per-wear) ──────────────────────────
    priceNudge: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.sm,
      paddingVertical: 12,
      paddingHorizontal: spacing.md,
      borderRadius: radius.md,
      backgroundColor: colors.glassBg,
      borderWidth: 1,
      borderColor: colors.glassBorder,
    },
    priceNudgeText: {
      flex: 1,
      fontFamily: fonts.body,
      fontSize: fontSizes.sm,
      color: colors.textSecondary,
      lineHeight: fontSizes.sm * 1.5,
    },
    priceNudgeCta: {
      fontFamily: fonts.body,
      fontSize: fontSizes.sm,
      fontWeight: fontWeights.semibold,
      color: colors.textPrimary,
    },

    // ── Sleeping / Donation shared list ───────────────────────────────────────
    itemCard: {
      borderRadius: radius.lg,
      padding: spacing.md,
      gap: spacing.sm,
    },
    itemCardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    itemCardTitle: {
      fontFamily: fonts.display,
      fontSize: fontSizes.lg,
      color: colors.textPrimary,
    },
    countBadge: {
      paddingVertical: 3,
      paddingHorizontal: 8,
      borderRadius: radius.pill,
      backgroundColor: colors.glassBg,
      borderWidth: 1,
      borderColor: colors.glassBorder,
    },
    countBadgeText: {
      fontFamily: fonts.body,
      fontSize: fontSizes.xs,
      color: colors.textMuted,
      fontWeight: fontWeights.medium,
    },
    itemRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    itemThumb: {
      width: 52,
      height: 52,
      borderRadius: radius.sm,
      backgroundColor: colors.glassBg,
      borderWidth: 1,
      borderColor: colors.glassBorder,
      overflow: 'hidden',
      alignItems: 'center',
      justifyContent: 'center',
    },
    itemThumbImg: {
      width: 52,
      height: 52,
    },
    itemInfo: {
      flex: 1,
      gap: 2,
    },
    itemName: {
      fontFamily: fonts.body,
      fontSize: fontSizes.sm,
      color: colors.textPrimary,
      fontWeight: fontWeights.medium,
    },
    itemSub: {
      fontFamily: fonts.body,
      fontSize: fontSizes.xs,
      color: colors.textMuted,
    },
    itemActions: {
      flexDirection: 'row',
      gap: spacing.xs,
    },
    actionChip: {
      paddingVertical: 5,
      paddingHorizontal: 10,
      borderRadius: radius.pill,
      backgroundColor: colors.glassBg,
      borderWidth: 1,
      borderColor: colors.glassBorder,
    },
    actionChipText: {
      fontFamily: fonts.body,
      fontSize: fontSizes.xs,
      color: colors.textSecondary,
    },
    actionChipDanger: {
      backgroundColor: colors.dangerBg,
      borderColor: colors.dangerBorder,
    },
    actionChipDangerText: {
      color: colors.dangerText,
    },
    actionChipSuccess: {
      backgroundColor: colors.successBg,
      borderColor: colors.successBorder,
    },
    actionChipSuccessText: {
      color: colors.successText,
    },
    divider: {
      height: 1,
      backgroundColor: colors.glassBorder,
      marginVertical: 2,
    },
    showMoreBtn: {
      alignItems: 'center',
      paddingVertical: spacing.xs,
    },
    showMoreText: {
      fontFamily: fonts.body,
      fontSize: fontSizes.sm,
      color: colors.textMuted,
    },
    shareBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.xs,
      paddingVertical: 10,
      borderRadius: radius.sm,
      borderWidth: 1,
      borderColor: colors.glassBorder,
      backgroundColor: colors.glassBg,
    },
    shareBtnText: {
      fontFamily: fonts.body,
      fontSize: fontSizes.sm,
      color: colors.textSecondary,
    },
    emptyText: {
      fontFamily: fonts.body,
      fontSize: fontSizes.sm,
      color: colors.textMuted,
      textAlign: 'center',
      paddingVertical: spacing.sm,
    },

    // ── Gaps card ─────────────────────────────────────────────────────────────
    gapsCard: {
      borderRadius: radius.lg,
      padding: spacing.md,
      gap: spacing.sm,
    },
    gapRow: {
      gap: spacing.xs,
    },
    gapMsg: {
      fontFamily: fonts.body,
      fontSize: fontSizes.sm,
      color: colors.textSecondary,
      lineHeight: 19,
    },
    gapShopBtn: {
      alignSelf: 'flex-start',
      paddingVertical: 5,
      paddingHorizontal: 12,
      borderRadius: radius.pill,
      backgroundColor: colors.glassBg,
      borderWidth: 1,
      borderColor: colors.glassBorder,
    },
    gapShopBtnText: {
      fontFamily: fonts.body,
      fontSize: fontSizes.xs,
      color: colors.textSecondary,
      fontWeight: fontWeights.medium,
    },
  });
