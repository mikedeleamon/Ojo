import { StyleSheet } from 'react-native';
import { ColorTokens, fonts, fontSizes, spacing } from '../../theme/tokens';

export const makeStyles = (colors: ColorTokens) => StyleSheet.create({
    root: { flex: 1 },
    contentLayer: { flex: 1 },
    loadingOverlay: {
        ...StyleSheet.absoluteFillObject,
        zIndex: 10,
        alignItems: 'center',
        justifyContent: 'center',
        // Opaque background so the weather content mounting behind it is
        // hidden until the fade-out completes. Matches the gradient's start
        // colour so the transition looks seamless.
        backgroundColor: colors.bgDefault,
    },
    loadingIcon: { width: 80, height: 80 },
    scroll: { flexGrow: 1, paddingBottom: spacing.xl },
    center: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        padding: spacing.lg,
    },
    errorText: {
        fontFamily: fonts.body,
        fontSize: fontSizes.base,
        color: colors.textSecondary,
        textAlign: 'center',
        lineHeight: fontSizes.base * 1.5,
    },
    header: { alignItems: 'center', paddingTop: spacing.lg, gap: 4 },
    gearBtn: { position: 'absolute', right: spacing.md, borderRadius: 999, overflow: 'hidden' },
    gearBtnInner: { padding: 8 },
    city: {
        fontFamily: fonts.display,
        fontSize: 36,
        color: colors.textPrimary,
    },
    condition: {
        fontFamily: fonts.body,
        fontSize: fontSizes.base,
        color: 'rgba(255,255,255,0.75)',
    },
    lastUpdated: {
        fontFamily: fonts.body,
        fontSize: fontSizes.xs,
        color: 'rgba(255,255,255,0.35)',
        marginTop: 2,
    },
    retryBtn: {
        paddingVertical: 10,
        paddingHorizontal: 28,
        backgroundColor: colors.saveBtnBg,
        borderRadius: 10,
        marginTop: 4,
    },
    retryBtnText: {
        fontFamily: fonts.body,
        fontSize: fontSizes.sm,
        fontWeight: '600' as any,
        color: colors.saveBtnText,
    },
    settingsLink: {
        fontFamily: fonts.body,
        fontSize: fontSizes.sm,
        color: colors.textSecondary,
        textDecorationLine: 'underline',
    },
    hero: { alignItems: 'center', paddingVertical: spacing.lg },
    weatherAttribution: { alignItems: 'center', paddingVertical: spacing.sm },

    hiLo: {
        fontFamily: fonts.body,
        fontSize: fontSizes.sm,
        color: 'rgba(255,255,255,0.55)',
        marginTop: 4,
        letterSpacing: 0.5,
    },
    forecastStrip: {
        flexDirection: 'row',
        gap: 8,
        paddingHorizontal: spacing.md,
        paddingBottom: spacing.md,
    },
    details: {
        marginHorizontal: spacing.md,
        backgroundColor: colors.glassBg,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: colors.glassBorder,
        padding: spacing.md,
        gap: spacing.md,
    },
});
