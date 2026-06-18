import { StyleSheet } from 'react-native';
import {
    ColorTokens,
    fonts,
    fontSizes,
    fontWeights,
    spacing,
    radius,
} from '../../theme/tokens';

export const makeStyles = (colors: ColorTokens) => StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.bgDefault },

    // ── Closet tab bar ─────────────────────────────────────────────────────────
    closetBar: {
        flexDirection: 'row',
        gap: 8,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        alignItems: 'center',
    },
    // Tab surface (GlassCard for inactive / solid pill for active); layout lives
    // on closetTabInner so the native glass material isn't tinted.
    closetTab: {
        borderRadius: radius.pill,
        overflow: 'hidden',
        flexShrink: 0,   // never compress — scroll instead
    },
    closetTabInner: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        paddingVertical: 8,
        paddingHorizontal: 14,
    },
    closetTabActive: {
        backgroundColor: colors.saveBtnBg,
        borderWidth: 1,
        borderColor: colors.saveBtnBg,
    },
    closetTabText: {
        fontFamily: fonts.body,
        fontSize: fontSizes.sm,
        color: colors.textSecondary,
    },
    closetTabTextActive: {
        color: colors.saveBtnText,
        fontWeight: fontWeights.semibold,
    },
    starBadge: { color: '#fbbf24', fontSize: 10 },
    countBadge: {
        fontFamily: fonts.body,
        fontSize: 10,
        color: colors.textMuted,
        backgroundColor: 'rgba(255,255,255,0.08)',
        borderRadius: radius.pill,
        paddingHorizontal: 6,
        paddingVertical: 2,
        overflow: 'hidden',
    },
    countBadgeActive: {
        color: colors.saveBtnText,
        backgroundColor: 'rgba(0,0,0,0.18)',
        opacity: 0.85,
    },
    newClosetBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        overflow: 'hidden',
    },
    // Fill style for a Pressable that lives inside a GlassCard icon button.
    iconBtnFill: {
        flex: 1,
        width: '100%',
        alignItems: 'center',
        justifyContent: 'center',
    },

    // ── Inline forms (rename / create) ─────────────────────────────────────────
    inlineForm: { flexDirection: 'row', gap: 8, alignItems: 'center' },
    inlineInput: {
        flex: 1,
        fontFamily: fonts.body,
        fontSize: fontSizes.sm,
        color: colors.textPrimary,
        backgroundColor: colors.glassBg,
        borderWidth: 1,
        borderColor: colors.glassBorder,
        borderRadius: radius.sm,
        paddingVertical: 8,
        paddingHorizontal: 12,
    },
    inlineOk: {
        paddingVertical: 8,
        paddingHorizontal: 12,
        backgroundColor: colors.saveBtnBg,
        borderRadius: radius.sm,
    },
    inlineOkText: {
        fontFamily: fonts.body,
        fontSize: fontSizes.sm,
        color: colors.saveBtnText,
        fontWeight: fontWeights.semibold,
    },
    inlineCancel: { paddingVertical: 8, paddingHorizontal: 10 },

    // ── Content header row (title + controls) ──────────────────────────────────
    mainHead: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: spacing.md,
        paddingTop: 4,
        paddingBottom: spacing.sm,
        gap: 6,
    },
    mainTitle: {
        fontFamily: fonts.display,
        fontSize: 26,
        color: colors.textPrimary,
        flex: 1,
    },
    headerRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    overflowBtn: {
        width: 30,
        height: 30,
        borderRadius: radius.sm,
        overflow: 'hidden',
    },
    // Single cycling view-mode button
    viewCycleBtn: {
        width: 30,
        height: 30,
        borderRadius: radius.sm,
        overflow: 'hidden',
    },

    // ── Search + sort + filter row ──────────────────────────────────────────────
    searchBar: {
        flexDirection: 'row',
        gap: 6,
        paddingHorizontal: spacing.md,
        paddingBottom: spacing.sm,
    },
    searchInputWrap: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: radius.sm,
        overflow: 'hidden',
        paddingHorizontal: 10,
        gap: 6,
    },
    searchInput: {
        flex: 1,
        fontFamily: fonts.body,
        fontSize: fontSizes.sm,
        color: colors.textPrimary,
        paddingVertical: 10,
    },
    sortBtn: {
        width: 40,
        borderRadius: radius.sm,
        overflow: 'hidden',
    },
    sortBtnActive: {
        borderWidth: 1,
        borderColor: colors.textSecondary,
        backgroundColor: colors.glassBgStrong,
    },
    filterBtn: {
        borderRadius: radius.sm,
        overflow: 'hidden',
    },
    filterBtnInner: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: 10,
        paddingHorizontal: 12,
    },
    filterBtnActive: { borderWidth: 1, borderColor: colors.textSecondary, backgroundColor: colors.glassBgStrong },
    filterCountBadge: {
        minWidth: 16,
        height: 16,
        borderRadius: 8,
        paddingHorizontal: 4,
        backgroundColor: colors.saveBtnBg,
        alignItems: 'center',
        justifyContent: 'center',
    },
    filterCountText: {
        fontFamily: fonts.body,
        fontSize: 10,
        fontWeight: fontWeights.semibold,
        color: colors.saveBtnText,
    },
    filterPanel: {
        maxHeight: 240,
        borderBottomWidth: 1,
        borderBottomColor: colors.glassBorder,
    },
    filterGroupLabel: {
        fontFamily: fonts.body,
        fontSize: fontSizes.xs,
        color: colors.textMuted,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
    chip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingVertical: 7,
        paddingHorizontal: 13,
        borderRadius: radius.pill,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: colors.glassBorder,
        backgroundColor: 'transparent',
    },
    chipActive: {
        backgroundColor: colors.saveBtnBg,
        borderColor: colors.saveBtnBg,
    },
    chipText: {
        fontFamily: fonts.body,
        fontSize: fontSizes.xs,
        color: colors.textSecondary,
        letterSpacing: 0.2,
    },
    chipTextActive: { color: colors.saveBtnText, fontWeight: fontWeights.semibold },
    chipColor: { width: 9, height: 9, borderRadius: 5 },
    clearFiltersText: {
        fontFamily: fonts.body,
        fontSize: fontSizes.sm,
        color: colors.textSecondary,
        textDecorationLine: 'underline',
    },

    // ── Article list ───────────────────────────────────────────────────────────
    articleList: {
        padding: spacing.md,
        gap: spacing.sm,
        paddingBottom: 96,
    },
    // Surface = GlassCard (native iOS glass / flat-glass fallback); the inner
    // Pressable owns the row layout so the material stays clean.
    articleCard: {
        borderRadius: radius.sm,
        overflow: 'hidden',
    },
    articleCardInner: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        padding: 10,
    },
    articleCardOOS: { opacity: 0.42 },
    articleImg: {
        width: 52,
        height: 52,
        borderRadius: 10,
        backgroundColor: colors.glassBg,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
    },
    articleImgFill: { width: 52, height: 52 },
    articleInfo: { flex: 1, gap: 2 },
    articleName: {
        fontFamily: fonts.body,
        fontSize: fontSizes.sm,
        color: colors.textPrimary,
        fontWeight: fontWeights.medium,
        flexShrink: 1,
    },
    articleMeta: {
        fontFamily: fonts.body,
        fontSize: fontSizes.xs,
        color: colors.textMuted,
    },
    categoryTag: {
        fontFamily: fonts.body,
        fontSize: 10,
        color: colors.textMuted,
        backgroundColor: colors.glassBg,
        borderRadius: 4,
        paddingHorizontal: 6,
        paddingVertical: 2,
        alignSelf: 'flex-start',
    },
    colorDot: {
        width: 12,
        height: 12,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.2)',
    },

    // ── Empty states ───────────────────────────────────────────────────────────
    emptyState: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.sm,
        padding: spacing.xl,
        paddingTop: spacing.lg,
    },
    emptyTitle: {
        fontFamily: fonts.body,
        fontSize: fontSizes.base,
        color: colors.textSecondary,
    },
    addBtn: {
        paddingVertical: 8,
        paddingHorizontal: 14,
        backgroundColor: colors.saveBtnBg,
        borderRadius: radius.sm,
    },
    addBtnText: {
        fontFamily: fonts.body,
        fontSize: fontSizes.sm,
        fontWeight: fontWeights.semibold,
        color: colors.saveBtnText,
    },

    // ── Tile grid ──────────────────────────────────────────────────────────────
    tileGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        padding: spacing.md,
        gap: spacing.sm,
        paddingBottom: 96,
    },
    tileCard: {
        borderRadius: radius.md,
        overflow: 'hidden',
    },
    tileCardInner: { width: '100%' },
    tileCardOOS: { opacity: 0.42 },
    tileImg: {
        width: '100%',
        aspectRatio: 1,
        backgroundColor: colors.glassBg,
        alignItems: 'center',
        justifyContent: 'center',
    },
    tileImgFill: { width: '100%', height: '100%' },
    tileInfo: { padding: 8, gap: 3 },
    tileName: {
        fontFamily: fonts.body,
        fontSize: fontSizes.xs,
        fontWeight: fontWeights.medium,
        color: colors.textPrimary,
        flexShrink: 1,
    },
    tileMetaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 6,
    },
    tileMeta: {
        fontFamily: fonts.body,
        fontSize: 10,
        color: colors.textMuted,
        flexShrink: 1,
    },
    tileColorDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.2)',
    },

    // ── TripFit discovery banner ────────────────────────────────────────────────
    tripBanner: {
        marginTop: spacing.md,
        borderRadius: radius.md,
        overflow: 'hidden',
        width: '100%',
    },
    tripBannerInner: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        padding: 14,
    },
    tripBannerInfo: { flex: 1, gap: 2 },
    tripBannerTitle: {
        fontFamily: fonts.bodySemiBold,
        fontSize: fontSizes.base,
        color: colors.textPrimary,
        letterSpacing: 0.2,
    },
    tripBannerDesc: {
        fontFamily: fonts.body,
        fontSize: fontSizes.xs,
        color: colors.textMuted,
    },

    // ── Floating action button ──────────────────────────────────────────────────
    fab: {
        position: 'absolute',
        bottom: 105,
        right: spacing.md,
        width: 52,
        height: 52,
        borderRadius: 26,
        backgroundColor: colors.saveBtnBg,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 8,
    },
});
