import { StyleSheet } from 'react-native';
import { ColorTokens, fonts, fontSizes, spacing } from '../../theme/tokens';
import { LIGHT_SKY_SCRIM } from '../../lib/weather/skyContrast';

export const makeStyles = (colors: ColorTokens) => StyleSheet.create({
    root: { flex: 1 },
    contentLayer: { flex: 1 },
    loadingOverlay: {
        ...StyleSheet.absoluteFill,
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
    scrollRow: { flexDirection: 'row', alignItems: 'flex-start' },
    scrollStacked: { paddingTop: spacing.xsPlus },
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
    stickyBar: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 20,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: spacing.md,
    },
    gearBtn: { borderRadius: 999, overflow: 'hidden' },
    gearBtnInner: { padding: 8 },
    locationsBtn: { borderRadius: 999, overflow: 'hidden' },
    locationsBtnInner: { padding: 8 },
    locationsBtnPlaceholder: { width: 44, height: 44 },
    barBtnInnerStacked: { padding: 11 },
    miniWrap: {
        maxWidth: '60%',
    },
    miniPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        borderRadius: 20,
        paddingHorizontal: 10,
        paddingVertical: 6,
        overflow: 'hidden',
    },
    // Sticky mini header mirrors the hero (see WeatherIconDisplay's `animate`
    // comment), so it stays on `fonts.hero` too.
    miniCity: {
        fontFamily: fonts.hero,
        fontSize: 16,
        color: colors.textPrimary,
        flexShrink: 1,
    },
    miniTemp: {
        fontFamily: fonts.hero,
        fontSize: 16,
        color: colors.textPrimary,
    },
    city: {
        fontFamily: fonts.hero,
        fontSize: 36,
        color: colors.textPrimary,
    },
    condition: {
        fontFamily: fonts.body,
        fontSize: fontSizes.lg,
        color: 'rgba(255,255,255,0.75)',
    },
    // 60%, not 35%: at 35% it measured 3.2:1 even on the clear-night sky, and
    // this style also sets the WeatherKit attribution, which must stay legible.
    lastUpdated: {
        fontFamily: fonts.body,
        fontSize: fontSizes.sm,
        color: 'rgba(255,255,255,0.6)',
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
    // Duo cover: place on the left, temperature on the right, one row.
    coverHero: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: spacing.md,
        paddingHorizontal: 20,
        paddingBottom: spacing.lg,
    },
    // Two-pane weather pane: the place on top, left-aligned, then the icon
    // beside the temperature.
    paneHero: {
        alignItems: 'flex-start',
        gap: 4,
        paddingHorizontal: 20,
        paddingBottom: spacing.sm,
    },
    paneTempRow: {
        alignSelf: 'center',
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        marginTop: 10,
    },
    // Tucked into the empty bottom of the icon's box, so the hours below stay put.
    paneFeels: { alignSelf: 'center', marginTop: -10 },
    paneTemp: {
        fontFamily: fonts.hero,
        fontSize: 80,
        lineHeight: 88,
        color: colors.textPrimary,
    },
    // Duo inner screen turned upright: the half above the fold.
    stackedHero: { alignItems: 'center', paddingHorizontal: 20 },
    // Same height as the buttons either side; the padding keeps a long city name
    // clear of them.
    stackedCityRow: { height: 44, alignSelf: 'stretch', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 64 },
    stackedCity: { fontFamily: fonts.hero, fontSize: 34, color: colors.textPrimary },
    stackedStatus: { flexDirection: 'row', marginTop: 2 },
    stackedStatusText: {
        fontFamily: fonts.body,
        fontSize: fontSizes.base,
        lineHeight: 18,
        color: 'rgba(255,255,255,0.85)',
    },
    stackedTempRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.smPlus, marginTop: 6 },
    stackedTemp: { fontFamily: fonts.hero, fontSize: 100, lineHeight: 110, color: colors.textPrimary },
    stackedFeels: {
        fontFamily: fonts.body,
        fontSize: fontSizes.base,
        lineHeight: 20,
        color: 'rgba(255,255,255,0.9)',
        // The temperature's line box is taller than its digits.
        marginTop: -4,
        marginBottom: spacing.smPlus,
    },
    coverHeroPlace: { flex: 1, gap: 4 },
    coverHeroTemps: { alignItems: 'flex-end' },
    coverTempRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    coverTemp: {
        fontFamily: fonts.hero,
        fontSize: 56,
        lineHeight: 62,
        color: colors.textPrimary,
    },
    coverFeels: {
        fontFamily: fonts.body,
        fontSize: fontSizes.sm,
        color: colors.textSecondary,
    },
    coverHiLo: {
        fontFamily: fonts.body,
        fontSize: fontSizes.sm,
        color: 'rgba(255,255,255,0.55)',
        marginTop: 2,
        letterSpacing: 0.5,
    },
    weatherAttribution: { alignItems: 'center', paddingVertical: spacing.sm },
    shareForecastBtn: {
        alignSelf: 'center',
        marginTop: spacing.sm,
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 999,
        backgroundColor: colors.glassBg,
        borderWidth: 1,
        borderColor: colors.glassBorder,
    },
    shareForecastBtnRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    shareForecastBtnText: {
        fontFamily: fonts.bodyMedium,
        fontSize: fontSizes.sm,
        color: colors.textSecondary,
    },
    // On a pale sky the pill sits on the near-white horizon: give it a navy
    // surface and full-strength text.
    shareForecastBtnLight: {
        backgroundColor: LIGHT_SKY_SCRIM,
        borderColor: 'rgba(255,255,255,0.18)',
    },
    shareForecastBtnTextLight: { color: colors.textPrimary },

    hiLo: {
        fontFamily: fonts.body,
        fontSize: fontSizes.base,
        color: 'rgba(255,255,255,0.55)',
        marginTop: 4,
        letterSpacing: 0.5,
    },
    // `gap` is load-bearing beyond spacing: the tiles are individual glass
    // surfaces and the space between them is NOT blurred, so widening the gap
    // trades layout density against blurred area — which is what this screen
    // turns out to be sensitive to. See the note in MinimizedWeatherDisplay.
    forecastStrip: {
        flexDirection: 'row',
        gap: 8,
        paddingHorizontal: spacing.md,
        paddingBottom: spacing.md,
    },
    forecastStripStacked: { paddingBottom: 14 },
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
