import { StyleSheet } from 'react-native';
import { fonts, fontSizes, fontWeights, radius, spacing } from '../../theme/tokens';
import type { ColorTokens } from '../../theme/tokens';

export const makeStyles = (colors: ColorTokens) =>
    StyleSheet.create({
        // Rendered inline at the top of OutfitSuggestion (not a floating overlay),
        // so the planned trip outfit occupies the single "today's outfit" surface.
        wrap: {
            marginBottom: spacing.sm,
        },
        card: {
            borderRadius: radius.lg,
            padding: spacing.md,
            gap: 10,
            borderWidth: 1,
            borderColor: colors.glassBorder,
        },
        headerRow: {
            flexDirection: 'row',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: spacing.sm,
        },
        eyebrow: {
            fontFamily: fonts.bodySemiBold,
            fontSize: fontSizes.xs,
            letterSpacing: 0.8,
            textTransform: 'uppercase',
            color: colors.textSecondary,
        },
        destination: {
            fontFamily: fonts.display,
            fontSize: fontSizes.xl,
            color: colors.textPrimary,
            marginTop: 1,
        },
        dayLine: {
            fontFamily: fonts.body,
            fontSize: fontSizes.sm,
            color: colors.textMuted,
            marginTop: 1,
        },
        badge: {
            borderRadius: radius.pill,
            paddingHorizontal: 10,
            paddingVertical: 5,
            borderWidth: 1,
            borderColor: colors.glassBorder,
        },
        badgeText: {
            fontFamily: fonts.bodySemiBold,
            fontSize: fontSizes.xs,
            color: colors.textSecondary,
        },
        thumbRow: {
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: spacing.xs,
        },
        thumb: {
            width: 56,
            height: 56,
            borderRadius: radius.sm - 2,
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
        },
        thumbImg: { width: 56, height: 56 },
        emptyText: {
            fontFamily: fonts.body,
            fontSize: fontSizes.sm,
            color: colors.textMuted,
            fontStyle: 'italic',
        },
        driftNote: {
            fontFamily: fonts.bodyMedium,
            fontSize: fontSizes.sm,
            color: colors.textPrimary,
            lineHeight: fontSizes.sm * 1.4,
        },
        sourceTag: {
            fontFamily: fonts.body,
            fontSize: fontSizes.xs,
            color: colors.textMuted,
        },
        actionsRow: {
            flexDirection: 'row',
            gap: spacing.sm,
            marginTop: 2,
        },
        primaryBtn: {
            flex: 1,
            backgroundColor: colors.saveBtnBg,
            borderRadius: radius.sm,
            paddingVertical: 11,
            alignItems: 'center',
            justifyContent: 'center',
        },
        primaryBtnText: {
            fontFamily: fonts.bodySemiBold,
            fontSize: fontSizes.sm,
            color: colors.saveBtnText,
        },
        secondaryBtn: {
            flex: 1,
            borderRadius: radius.sm,
            borderWidth: 1,
            borderColor: colors.glassBorder,
            paddingVertical: 11,
            alignItems: 'center',
            justifyContent: 'center',
        },
        secondaryBtnText: {
            fontFamily: fonts.bodyMedium,
            fontSize: fontSizes.sm,
            color: colors.textSecondary,
        },
        dismissBtn: {
            position: 'absolute',
            top: 6,
            right: 6,
            width: 28,
            height: 28,
            alignItems: 'center',
            justifyContent: 'center',
        },
        dismissText: {
            fontSize: 16,
            lineHeight: 18,
            color: colors.textMuted,
            fontWeight: fontWeights.medium,
        },
    });
