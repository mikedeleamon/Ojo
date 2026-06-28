import { StyleSheet } from 'react-native';
import {
    ColorTokens,
    fonts,
    fontSizes,
    fontWeights,
    radius,
    spacing,
} from '../../theme/tokens';

/**
 * Shared style atlas for the auth flow (Login, Signup, Forgot/Reset password).
 * Previously each screen redeclared its own near-identical copy of these.
 * Components in this folder (AuthScaffold, AuthField, AuthStatus, AuthButton)
 * consume these internally; screens use the remaining atoms (card, title,
 * footer, link, divider, apple) for the parts that aren't componentized.
 */
export const makeAuthStyles = (colors: ColorTokens) =>
    StyleSheet.create({
        // Scaffold
        root: { flex: 1, backgroundColor: colors.bgDefault },
        content: { flexGrow: 1, padding: spacing.md, gap: spacing.md },
        contentCentered: { justifyContent: 'center' },

        // Card surfaces
        card: {
            backgroundColor: colors.glassBg,
            borderRadius: radius.lg,
            borderWidth: 1,
            borderColor: colors.glassBorder,
            padding: spacing.lg,
            gap: spacing.md,
        },
        cardCentered: { alignItems: 'center' },

        // Typography
        title: {
            fontFamily: fonts.display,
            fontSize: 28,
            color: colors.textPrimary,
            letterSpacing: -0.02 * 28,
        },
        body: {
            fontFamily: fonts.body,
            fontSize: fontSizes.base,
            color: colors.textSecondary,
        },

        // Fields
        field: { width: '100%', gap: 6 },
        label: {
            fontFamily: fonts.body,
            fontSize: fontSizes.xs,
            fontWeight: fontWeights.medium,
            letterSpacing: 0.1 * fontSizes.xs,
            textTransform: 'uppercase',
            color: colors.textMuted,
        },
        inputRow: {
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: colors.glassBg,
            borderWidth: 1,
            borderColor: colors.glassBorder,
            borderRadius: radius.sm,
        },
        inputRowError: { borderColor: colors.errorBorder },
        input: {
            flex: 1,
            paddingVertical: 12,
            paddingHorizontal: spacing.md,
            color: colors.textPrimary,
            fontFamily: fonts.body,
            fontSize: fontSizes.base,
        },
        inputSuffix: { paddingHorizontal: spacing.sm, paddingVertical: 12 },
        inputSuffixText: {
            fontFamily: fonts.body,
            fontSize: fontSizes.sm,
            color: colors.textMuted,
        },
        fieldError: {
            fontFamily: fonts.body,
            fontSize: fontSizes.xs,
            color: colors.errorText,
            marginTop: 2,
        },

        // Status boxes
        errorBox: {
            width: '100%',
            padding: spacing.sm,
            backgroundColor: colors.errorBg,
            borderRadius: radius.sm,
            borderWidth: 1,
            borderColor: colors.errorBorder,
            gap: 8,
        },
        errorText: {
            fontFamily: fonts.body,
            fontSize: fontSizes.sm,
            color: colors.errorText,
        },
        successBox: {
            width: '100%',
            padding: spacing.sm,
            backgroundColor: colors.successBg,
            borderRadius: radius.sm,
            borderWidth: 1,
            borderColor: colors.successBorder,
            gap: 8,
        },
        successText: {
            fontFamily: fonts.body,
            fontSize: fontSizes.sm,
            color: colors.successText,
        },

        // Primary button
        btn: {
            width: '100%',
            paddingVertical: 14,
            backgroundColor: colors.saveBtnBg,
            borderRadius: radius.sm,
            alignItems: 'center',
        },
        btnText: {
            fontFamily: fonts.body,
            fontSize: fontSizes.base,
            fontWeight: fontWeights.semibold,
            color: colors.saveBtnText,
        },

        // Links / footer
        footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
        footerText: {
            fontFamily: fonts.body,
            fontSize: fontSizes.sm,
            color: colors.textSecondary,
        },
        link: {
            fontFamily: fonts.body,
            fontSize: fontSizes.sm,
            color: colors.textPrimary,
            textDecorationLine: 'underline',
        },
        linkMuted: {
            fontFamily: fonts.body,
            fontSize: fontSizes.sm,
            color: colors.textSecondary,
            textDecorationLine: 'underline',
        },

        // Login divider + Apple button
        dividerRow: {
            flexDirection: 'row',
            alignItems: 'center',
            width: '100%',
            gap: spacing.sm,
            marginVertical: spacing.xs,
        },
        dividerLine: {
            flex: 1,
            height: StyleSheet.hairlineWidth,
            backgroundColor: colors.glassBorder,
        },
        dividerText: {
            fontFamily: fonts.body,
            fontSize: fontSizes.xs,
            color: colors.textMuted,
            textTransform: 'uppercase',
            letterSpacing: 1,
        },
        appleBtn: { width: '100%', height: 48 },

        googleBtn: {
            width: '100%',
            height: 48,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: spacing.sm,
            borderRadius: radius.sm,
        },
        googleBtnText: {
            fontFamily: fonts.body,
            fontSize: fontSizes.base,
            fontWeight: fontWeights.semibold,
        },
    });

export type AuthStyles = ReturnType<typeof makeAuthStyles>;
