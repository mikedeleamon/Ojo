/**
 * WearCalendarScreen — outfit history as a calendar you can see.
 *
 * Replaces the text-only History list. Top to bottom:
 *   - streaks: current run, days this month, outfits logged;
 *   - the year strip, a GitHub-style grid of the last 26 weeks with every logged
 *     day painted in the color of what was worn, so a season reads as a palette;
 *   - month grids, newest first, each logged day a tiny collage of the outfit's
 *     own photos. Tapping a day opens what was worn, the weather it was worn in,
 *     and the option to remove it;
 *   - clearing all history, kept at the bottom, away from the content.
 *
 * Data is the same outfit history as before (lib/outfitHistory) joined to the
 * closets for photos and colors; layout math is in lib/wearCalendar.
 */

import { memo, useCallback, useMemo, useRef, useState } from 'react';
import {
    FlatList,
    Image,
    Modal,
    ScrollView,
    StyleSheet,
    type LayoutChangeEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { View, Text, Pressable } from '../../../components/primitives';
import { useConfirm } from '../../../components/ConfirmDialog';
import GarmentSilhouette, { hasSilhouette } from '../../../components/GarmentSilhouette';
import { useClosets } from '../../../hooks/useClosets';
import { useSettings } from '../../../hooks/useSettings';
import { usePaneOverlay } from '../../../hooks/usePaneOverlay';
import { useTheme } from '../../../theme/ThemeContext';
import { fonts, fontSizes, radius, spacing, type ColorTokens } from '../../../theme/tokens';
import { CSS_COLORS } from '../../../lib/colors/cssColors';
import { clearHistory, deleteHistoryEntry, loadHistory } from '../../../lib/outfitHistory';
import { formatTemp } from '../../../lib/units';
import { hapticSelection } from '../../../lib/haptics';
import {
    entryArticles,
    groupByDay,
    monthGrids,
    wearStats,
    yearStrip,
    type MonthDay,
    type MonthGrid,
    type StripCell,
} from '../../../lib/wearCalendar';
import { articleDisplayName, type ClothingArticle, type Closet, type OutfitHistoryEntry } from '../../../types';
import type { ScrollViewRef } from '../../../types/nativeRefs';

const STRIP_WEEKS = 26;
const STRIP_CELL = 11;
const STRIP_GAP = 3;
const DAY_GAP = 6;
const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const STRIP_ROW_LABELS = ['', 'M', '', 'W', '', 'F', ''];

type ArticleMap = ReadonlyMap<string, ClothingArticle>;

const swatch = (a: ClothingArticle, fallback: string) => (a.color && CSS_COLORS[a.color]) || fallback;

/** Outline color that shows on a swatch: dark on pale pieces, light on the rest. */
const outlineOn = (hex: string) => {
    const m = /^#([0-9a-f]{6})$/i.exec(hex);
    if (!m) return 'rgba(255,255,255,0.75)';
    const n = parseInt(m[1], 16);
    const lum = (0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255;
    return lum > 0.6 ? 'rgba(15,23,42,0.55)' : 'rgba(255,255,255,0.75)';
};

const fromKey = (key: string) => {
    const [y, m, d] = key.split('-').map(Number);
    return new Date(y, m - 1, d);
};

// ─── Collage ────────────────────────────────────────────────────────────────

/** One piece: its photo, or its color with a garment outline when it has none. */
const PieceTile = ({ article, colors, size }: { article: ClothingArticle; colors: ColorTokens; size: number }) => {
    if (article.imageUrl) {
        return <Image source={{ uri: article.imageUrl }} style={StyleSheet.absoluteFill} resizeMode='cover' />;
    }
    const fill = swatch(article, colors.glassBgStrong);
    return (
        <View style={[StyleSheet.absoluteFill, styles.center, { backgroundColor: fill }]}>
            {size >= 18 && hasSilhouette(article.clothingType) && (
                <GarmentSilhouette clothingType={article.clothingType} size={Math.min(22, size * 0.6)} color={outlineOn(fill)} />
            )}
        </View>
    );
};

/**
 * Up to four pieces of an outfit in a square: one fills it, two split it, three
 * or four make a 2×2. Main pieces first; accessories only fill spare slots.
 */
const OutfitCollage = memo(({ articles, size, colors }: { articles: ClothingArticle[]; size: number; colors: ColorTokens }) => {
    const ordered = [...articles.filter((a) => !a.isAccessory), ...articles.filter((a) => a.isAccessory)].slice(0, 4);
    if (ordered.length === 0) return <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.glassBgStrong }]} />;
    if (ordered.length === 1) {
        return <PieceTile article={ordered[0]} colors={colors} size={size} />;
    }
    if (ordered.length === 2) {
        return (
            <View style={[StyleSheet.absoluteFill, styles.row]}>
                {ordered.map((a) => (
                    <View key={a._id} style={styles.half}>
                        <PieceTile article={a} colors={colors} size={size / 2} />
                    </View>
                ))}
            </View>
        );
    }
    return (
        <View style={[StyleSheet.absoluteFill, styles.grid]}>
            {[0, 1, 2, 3].map((i) => (
                <View key={i} style={styles.quarter}>
                    {ordered[i] ? (
                        <PieceTile article={ordered[i]} colors={colors} size={size / 2} />
                    ) : (
                        <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.glassBg }]} />
                    )}
                </View>
            ))}
        </View>
    );
});
OutfitCollage.displayName = 'OutfitCollage';

// ─── Month grid ─────────────────────────────────────────────────────────────

interface DayCellProps {
    day: MonthDay;
    entries: OutfitHistoryEntry[] | undefined;
    size: number;
    byId: ArticleMap;
    colors: ColorTokens;
    onOpen: (key: string) => void;
}

const DayCell = memo(({ day, entries, size, byId, colors, onOpen }: DayCellProps) => {
    const date = fromKey(day.key);
    const longDate = date.toLocaleDateString([], { month: 'long', day: 'numeric' });
    if (!entries || entries.length === 0) {
        return (
            <View
                style={[
                    styles.day,
                    { width: size, height: size, backgroundColor: colors.glassBg, opacity: day.isFuture ? 0.35 : 1 },
                    day.isToday && { borderWidth: 1.5, borderColor: colors.textPrimary },
                ]}
                accessible
                accessibilityLabel={`${longDate}${day.isToday ? ', today' : ''}, nothing logged`}
            >
                <Text style={[styles.dayNumberEmpty, { color: colors.textMuted }]}>{day.day}</Text>
            </View>
        );
    }
    const articles = entryArticles(entries[0], byId);
    return (
        <Pressable
            onPress={() => onOpen(day.key)}
            style={({ pressed }) => [
                styles.day,
                { width: size, height: size, opacity: pressed ? 0.75 : 1, borderColor: colors.glassBorder, borderWidth: StyleSheet.hairlineWidth },
                day.isToday && { borderWidth: 2, borderColor: colors.textPrimary },
            ]}
            accessibilityRole='button'
            accessibilityLabel={`${longDate}${day.isToday ? ', today' : ''}, ${entries.length} outfit${entries.length === 1 ? '' : 's'} logged`}
        >
            <OutfitCollage articles={articles} size={size} colors={colors} />
            <View style={styles.dayNumberPill}>
                <Text style={styles.dayNumber}>{day.day}</Text>
            </View>
            {entries.length > 1 && (
                <View style={styles.countBadge}>
                    <Text style={styles.countText}>×{entries.length}</Text>
                </View>
            )}
        </Pressable>
    );
});
DayCell.displayName = 'DayCell';

interface MonthProps {
    month: MonthGrid;
    days: ReadonlyMap<string, OutfitHistoryEntry[]>;
    cell: number;
    byId: ArticleMap;
    colors: ColorTokens;
    onOpen: (key: string) => void;
}

const MonthSection = memo(({ month, days, cell, byId, colors, onOpen }: MonthProps) => {
    const title = new Date(month.year, month.month, 1).toLocaleDateString([], { month: 'long', year: 'numeric' });
    return (
        <View style={styles.month}>
            <View style={styles.monthHead}>
                <Text style={[styles.monthTitle, { color: colors.textPrimary }]} accessibilityRole='header'>
                    {title}
                </Text>
                <Text style={[styles.monthCount, { color: colors.textMuted }]}>
                    {month.daysLogged === 0 ? 'Nothing logged' : `${month.daysLogged} day${month.daysLogged === 1 ? '' : 's'} logged`}
                </Text>
            </View>
            <View style={[styles.weekRow, { gap: DAY_GAP }]}>
                {WEEKDAYS.map((d, i) => (
                    <Text key={i} style={[styles.weekday, { width: cell, color: colors.textMuted }]} importantForAccessibility='no'>
                        {d}
                    </Text>
                ))}
            </View>
            {month.weeks.map((week, r) => (
                <View key={r} style={[styles.weekRow, { gap: DAY_GAP }]}>
                    {week.map((day, i) =>
                        day ? (
                            <DayCell key={day.key} day={day} entries={days.get(day.key)} size={cell} byId={byId} colors={colors} onOpen={onOpen} />
                        ) : (
                            <View key={`pad${i}`} style={{ width: cell, height: cell }} />
                        ),
                    )}
                </View>
            ))}
        </View>
    );
});
MonthSection.displayName = 'MonthSection';

// ─── Year strip ─────────────────────────────────────────────────────────────

const YearStrip = memo(({ strip, colors, onOpen }: { strip: StripCell[][]; colors: ColorTokens; onOpen: (key: string) => void }) => {
    const scrollRef = useRef<ScrollViewRef>(null);
    return (
        <View style={styles.stripWrap}>
            <View style={[styles.stripLabels, { gap: STRIP_GAP }]}>
                {STRIP_ROW_LABELS.map((l, i) => (
                    <Text key={i} style={[styles.stripLabel, { color: colors.textMuted }]} importantForAccessibility='no'>
                        {l}
                    </Text>
                ))}
            </View>
            <ScrollView
                ref={scrollRef}
                horizontal
                showsHorizontalScrollIndicator={false}
                // Open on the latest weeks, like the months below.
                onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
                contentContainerStyle={{ gap: STRIP_GAP }}
                accessibilityLabel={`The last ${STRIP_WEEKS} weeks, each logged day in the color of its outfit`}
            >
                {strip.map((col, c) => (
                    <View key={c} style={{ gap: STRIP_GAP }}>
                        {col.map((cell) => {
                            const fill = cell.count > 0
                                ? (cell.color && CSS_COLORS[cell.color]) || colors.textSecondary
                                : colors.glassBg;
                            const square = (
                                <View
                                    style={[
                                        styles.stripCell,
                                        { backgroundColor: fill, opacity: cell.isFuture ? 0.25 : 1 },
                                        cell.count > 0 && { borderColor: colors.glassBorder, borderWidth: StyleSheet.hairlineWidth },
                                        cell.isToday && { borderColor: colors.textPrimary, borderWidth: 1.5 },
                                    ]}
                                />
                            );
                            return cell.count > 0 ? (
                                <Pressable
                                    key={cell.key}
                                    onPress={() => onOpen(cell.key)}
                                    hitSlop={2}
                                    accessibilityRole='button'
                                    accessibilityLabel={`${fromKey(cell.key).toLocaleDateString([], { month: 'long', day: 'numeric' })}, ${cell.color ?? 'outfit'} logged`}
                                >
                                    {square}
                                </Pressable>
                            ) : (
                                <View key={cell.key}>{square}</View>
                            );
                        })}
                    </View>
                ))}
            </ScrollView>
        </View>
    );
});
YearStrip.displayName = 'YearStrip';

// ─── Day sheet ──────────────────────────────────────────────────────────────

interface DaySheetProps {
    dayKey: string | null;
    entries: OutfitHistoryEntry[];
    byId: ArticleMap;
    colors: ColorTokens;
    tempScale: 'imperial' | 'metric';
    onClose: () => void;
    onRemove: (entry: OutfitHistoryEntry) => void;
}

const weatherLine = (e: OutfitHistoryEntry, scale: 'imperial' | 'metric'): string | null => {
    const c = e.context;
    if (!c || typeof c.feelsLikeF !== 'number') return null;
    const parts = [`Felt like ${formatTemp(c.feelsLikeF, scale)}`];
    if (c.isSnowing) parts.push('snow');
    else if (c.precipIntensity && c.precipIntensity !== 'none') parts.push(`${c.precipIntensity} rain`);
    if (c.windMph >= 15) parts.push('windy');
    return parts.join(' · ');
};

const DaySheet = ({ dayKey, entries, byId, colors, tempScale, onClose, onRemove }: DaySheetProps) => {
    const overlay = usePaneOverlay();
    const title = dayKey
        ? fromKey(dayKey).toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })
        : '';
    return (
        <Modal visible={!!dayKey} transparent animationType='slide' onRequestClose={onClose}>
            <Pressable style={styles.backdrop} onPress={onClose} accessibilityRole='button' accessibilityLabel='Close' />
            <View style={[styles.sheet, { backgroundColor: colors.bgDefault, borderColor: colors.glassBorder }, overlay]}>
                <View style={[styles.grabber, { backgroundColor: colors.glassBorder }]} />
                <Text style={[styles.sheetTitle, { color: colors.textPrimary }]} accessibilityRole='header'>
                    {title}
                </Text>
                <ScrollView contentContainerStyle={styles.sheetBody}>
                    {entries.map((e) => {
                        const pieces = entryArticles(e, byId);
                        const time = new Date(e.wornAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
                        const weather = weatherLine(e, tempScale);
                        return (
                            <View key={e.id} style={styles.entry}>
                                <Text style={[styles.entryMeta, { color: colors.textMuted }]}>
                                    {time} · {e.closetName}
                                </Text>
                                {weather && <Text style={[styles.entryWeather, { color: colors.textSecondary }]}>{weather}</Text>}
                                {pieces.length > 0 ? (
                                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pieces}>
                                        {pieces.map((a) => (
                                            <View key={a._id} style={styles.piece}>
                                                <View style={[styles.pieceImage, { backgroundColor: colors.glassBg, borderColor: colors.glassBorder }]}>
                                                    <PieceTile article={a} colors={colors} size={76} />
                                                </View>
                                                <Text style={[styles.pieceName, { color: colors.textSecondary }]} numberOfLines={2}>
                                                    {articleDisplayName(a)}
                                                </Text>
                                            </View>
                                        ))}
                                    </ScrollView>
                                ) : (
                                    // Every piece has since been deleted; the summary saved at
                                    // log time is all that's left.
                                    <Text style={[styles.entrySummary, { color: colors.textSecondary }]}>{e.articleSummary}</Text>
                                )}
                                <Pressable
                                    onPress={() => onRemove(e)}
                                    hitSlop={8}
                                    accessibilityRole='button'
                                    accessibilityLabel={`Remove the ${time} outfit from history`}
                                >
                                    <Text style={[styles.remove, { color: colors.dangerText }]}>Remove from history</Text>
                                </Pressable>
                            </View>
                        );
                    })}
                </ScrollView>
            </View>
        </Modal>
    );
};

// ─── Screen ─────────────────────────────────────────────────────────────────

const Stat = ({ value, label, colors }: { value: string; label: string; colors: ColorTokens }) => (
    <View style={[styles.stat, { backgroundColor: colors.glassBg, borderColor: colors.glassBorder }]} accessible accessibilityLabel={`${value} ${label}`}>
        <Text style={[styles.statValue, { color: colors.textPrimary }]}>{value}</Text>
        <Text style={[styles.statLabel, { color: colors.textMuted }]}>{label}</Text>
    </View>
);

export interface WearCalendarViewProps {
    entries: OutfitHistoryEntry[];
    closets: Closet[];
    now: Date;
    tempScale: 'imperial' | 'metric';
    onRemove: (entry: OutfitHistoryEntry) => void;
    onClearAll: () => void;
}

/** The calendar itself, from data it's handed. WearCalendarScreen loads that data. */
export const WearCalendarView = ({ entries, closets, now, tempScale, onRemove, onClearAll }: WearCalendarViewProps) => {
    const { colors } = useTheme();
    const [openDay, setOpenDay] = useState<string | null>(null);
    const [width, setWidth] = useState(0);

    const byId = useMemo(() => {
        const m = new Map<string, ClothingArticle>();
        for (const c of closets) for (const a of c.articles) m.set(a._id, a);
        return m;
    }, [closets]);
    const days = useMemo(() => groupByDay(entries), [entries]);
    const months = useMemo(() => monthGrids(days, now), [days, now]);
    const strip = useMemo(() => yearStrip(days, byId, now, STRIP_WEEKS), [days, byId, now]);
    const stats = useMemo(() => wearStats(days, now), [days, now]);
    // The sheet closes by itself once its day has nothing left on it.
    const sheetDay = openDay && days.has(openDay) ? openDay : null;

    const onLayout = useCallback((e: LayoutChangeEvent) => {
        const w = Math.round(e.nativeEvent.layout.width);
        setWidth((prev) => (prev === w ? prev : w));
    }, []);
    const cell = width > 0 ? Math.floor((width - spacing.md * 2 - DAY_GAP * 6) / 7) : 0;

    const open = useCallback((key: string) => {
        hapticSelection();
        setOpenDay(key);
    }, []);

    const header = (
        <View style={styles.header}>
            <View style={styles.stats}>
                <Stat value={`${stats.currentStreak}`} label='day streak' colors={colors} />
                <Stat value={`${stats.daysThisMonth}`} label='days this month' colors={colors} />
                <Stat value={`${stats.totalOutfits}`} label={stats.totalOutfits === 1 ? 'outfit logged' : 'outfits logged'} colors={colors} />
            </View>
            {stats.longestStreak > stats.currentStreak && (
                <Text style={[styles.best, { color: colors.textMuted }]}>Longest streak: {stats.longestStreak} days</Text>
            )}
            <View style={styles.sectionHead}>
                <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>Last 6 months</Text>
                <Text style={[styles.sectionHint, { color: colors.textMuted }]}>Each day, in the color you wore</Text>
            </View>
            <YearStrip strip={strip} colors={colors} onOpen={open} />
            {entries.length === 0 && (
                <View style={[styles.empty, { backgroundColor: colors.glassBg, borderColor: colors.glassBorder }]}>
                    <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>No outfits logged yet</Text>
                    <Text style={[styles.emptyBody, { color: colors.textSecondary }]}>
                        Tap "Wore this today" on Home and each day fills in here with what you wore.
                    </Text>
                </View>
            )}
        </View>
    );

    const footer = (
        <View style={styles.footer}>
            <Text style={[styles.hint, { color: colors.textMuted }]}>
                Outfits from the last 3 days are deprioritised in new suggestions.
            </Text>
            {entries.length > 0 && (
                <Pressable onPress={onClearAll} hitSlop={8} accessibilityRole='button' accessibilityLabel='Clear all outfit history'>
                    <Text style={[styles.clearAll, { color: colors.dangerText }]}>Clear all history</Text>
                </Pressable>
            )}
        </View>
    );

    return (
        <SafeAreaView style={[styles.root, { backgroundColor: colors.bgDefault }]} edges={['bottom', 'right']} onLayout={onLayout}>
            {cell > 0 && (
                <FlatList
                    data={months}
                    keyExtractor={(m) => m.key}
                    renderItem={({ item }) => (
                        <MonthSection month={item} days={days} cell={cell} byId={byId} colors={colors} onOpen={open} />
                    )}
                    ListHeaderComponent={header}
                    ListFooterComponent={footer}
                    contentContainerStyle={styles.content}
                    initialNumToRender={2}
                    maxToRenderPerBatch={2}
                    windowSize={5}
                    showsVerticalScrollIndicator={false}
                />
            )}
            <DaySheet
                dayKey={sheetDay}
                entries={sheetDay ? days.get(sheetDay) ?? [] : []}
                byId={byId}
                colors={colors}
                tempScale={tempScale}
                onClose={() => setOpenDay(null)}
                onRemove={onRemove}
            />
        </SafeAreaView>
    );
};

export const WearCalendarScreen = () => {
    const { settings } = useSettings();
    const { closets } = useClosets();
    const confirm = useConfirm();
    const tempScale = settings.temperatureScale === 'Metric' ? 'metric' : 'imperial';
    const [entries, setEntries] = useState<OutfitHistoryEntry[]>([]);
    const [now, setNow] = useState(() => new Date());

    useFocusEffect(
        useCallback(() => {
            setNow(new Date());
            loadHistory().then(setEntries).catch(() => {});
        }, []),
    );

    const removeEntry = useCallback(
        async (entry: OutfitHistoryEntry) => {
            const ok = await confirm({
                title: 'Remove this outfit?',
                message: 'It comes off your calendar, your streak, and what Ojo learns from.',
                confirmLabel: 'Remove',
                destructive: true,
            });
            if (!ok) return;
            await deleteHistoryEntry(entry.id);
            setEntries((prev) => prev.filter((e) => e.id !== entry.id));
        },
        [confirm],
    );

    const clearAll = useCallback(async () => {
        const ok = await confirm({
            title: `Clear all ${entries.length} entries?`,
            message: 'Your outfit history will be permanently removed.',
            confirmLabel: 'Clear all',
            destructive: true,
        });
        if (!ok) return;
        await clearHistory();
        setEntries([]);
    }, [confirm, entries.length]);

    return (
        <WearCalendarView
            entries={entries}
            closets={closets}
            now={now}
            tempScale={tempScale}
            onRemove={removeEntry}
            onClearAll={clearAll}
        />
    );
};

const styles = StyleSheet.create({
    root: { flex: 1 },
    content: { padding: spacing.md, paddingBottom: spacing.xl, gap: spacing.lg },
    center: { alignItems: 'center', justifyContent: 'center' },
    row: { flexDirection: 'row' },
    half: { flex: 1, overflow: 'hidden' },
    grid: { flexDirection: 'row', flexWrap: 'wrap' },
    quarter: { width: '50%', height: '50%', overflow: 'hidden' },

    header: { gap: spacing.sm },
    stats: { flexDirection: 'row', gap: spacing.xsPlus },
    stat: {
        flex: 1,
        borderWidth: 1,
        borderRadius: radius.sm,
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.xsPlus,
        gap: 2,
    },
    statValue: { fontFamily: fonts.display, fontSize: 26, lineHeight: 30 },
    statLabel: { fontFamily: fonts.body, fontSize: fontSizes.xs },
    best: { fontFamily: fonts.body, fontSize: fontSizes.xs },
    sectionHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: spacing.xsPlus },
    sectionLabel: {
        fontFamily: fonts.bodySemiBold,
        fontSize: fontSizes.xs,
        letterSpacing: 0.8,
        textTransform: 'uppercase',
    },
    sectionHint: { fontFamily: fonts.body, fontSize: fontSizes.xs },

    stripWrap: { flexDirection: 'row', gap: 6 },
    stripLabels: { paddingTop: 0 },
    stripLabel: { fontFamily: fonts.body, fontSize: 9, height: STRIP_CELL, lineHeight: STRIP_CELL, width: 10 },
    stripCell: { width: STRIP_CELL, height: STRIP_CELL, borderRadius: 3 },

    empty: { borderWidth: 1, borderRadius: radius.md, padding: spacing.smPlus, gap: 4, marginTop: spacing.xsPlus },
    emptyTitle: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.base },
    emptyBody: { fontFamily: fonts.body, fontSize: fontSizes.sm, lineHeight: 19 },

    month: { gap: DAY_GAP },
    monthHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 2 },
    monthTitle: { fontFamily: fonts.display, fontSize: fontSizes.lg },
    monthCount: { fontFamily: fonts.body, fontSize: fontSizes.xs },
    weekRow: { flexDirection: 'row' },
    weekday: { fontFamily: fonts.bodyMedium, fontSize: 10, textAlign: 'center' },

    day: { borderRadius: 10, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
    dayNumberEmpty: { fontFamily: fonts.body, fontSize: fontSizes.xs },
    dayNumberPill: {
        position: 'absolute',
        top: 3,
        left: 3,
        minWidth: 15,
        paddingHorizontal: 3,
        borderRadius: 5,
        backgroundColor: 'rgba(15,23,42,0.62)',
        alignItems: 'center',
    },
    dayNumber: { fontFamily: fonts.bodySemiBold, fontSize: 9, lineHeight: 13, color: '#ffffff' },
    countBadge: {
        position: 'absolute',
        bottom: 3,
        right: 3,
        paddingHorizontal: 3,
        borderRadius: 5,
        backgroundColor: 'rgba(15,23,42,0.62)',
    },
    countText: { fontFamily: fonts.bodySemiBold, fontSize: 9, lineHeight: 13, color: '#ffffff' },

    footer: { gap: spacing.sm, alignItems: 'center', paddingTop: spacing.sm },
    hint: { fontFamily: fonts.body, fontSize: fontSizes.xs, textAlign: 'center' },
    clearAll: { fontFamily: fonts.bodyMedium, fontSize: fontSizes.sm, paddingVertical: spacing.xs },

    backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.4)' },
    sheet: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        maxHeight: '75%',
        borderTopLeftRadius: radius.lg,
        borderTopRightRadius: radius.lg,
        borderWidth: StyleSheet.hairlineWidth,
        paddingTop: spacing.xsPlus,
        paddingBottom: spacing.xl,
    },
    grabber: { alignSelf: 'center', width: 36, height: 4, borderRadius: 2, marginBottom: spacing.sm },
    sheetTitle: { fontFamily: fonts.display, fontSize: fontSizes.xl, paddingHorizontal: spacing.md },
    sheetBody: { padding: spacing.md, gap: spacing.lg },
    entry: { gap: spacing.xs },
    entryMeta: { fontFamily: fonts.bodyMedium, fontSize: fontSizes.sm },
    entryWeather: { fontFamily: fonts.body, fontSize: fontSizes.sm },
    entrySummary: { fontFamily: fonts.body, fontSize: fontSizes.base, lineHeight: 21 },
    pieces: { gap: spacing.sm, paddingVertical: spacing.xs },
    piece: { width: 76, gap: 4 },
    pieceImage: { width: 76, height: 92, borderRadius: radius.sm, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth },
    pieceName: { fontFamily: fonts.body, fontSize: fontSizes.xs, lineHeight: 15 },
    remove: { fontFamily: fonts.bodyMedium, fontSize: fontSizes.sm, paddingVertical: 4 },
});
