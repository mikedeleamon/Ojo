import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import {
    ScrollView,
    TextInput,
    ActivityIndicator,
    Pressable,
    StyleSheet,
    Alert,
    Share,
    Image,
    Animated,
    useWindowDimensions,
    View as RNView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { View, Text, GlassCard, GlassGroup } from '../../components/primitives';
import OccasionChips from '../../components/OccasionChips';
import { HangerIcon } from '../../components/shared';
import { useTheme, ForceDarkPalette } from '../../theme/ThemeContext';
import {
    fonts,
    fontSizes,
    radius,
    spacing,
    darkColors,
} from '../../theme/tokens';
import type { ColorTokens } from '../../theme/tokens';
import { useReduceMotion } from '../../hooks/useReduceMotion';
import { generateOutfits } from '../../lib/outfitEngine';
import type { OutfitResult } from '../../lib/outfitEngine';
import { recordGapsFromNotes } from '../../lib/wardrobeGaps';
import { gradientFor } from '../../components/WeatherHUD/weatherPalette';
import { humanizeCondition } from '../../lib/weather/humanizeCondition';
import api from '../../api/client';
import { authHeaders } from '../../lib/auth';
import { newPlanId } from '../../lib/tripStorage';
import CityAutocomplete from '../../features/settings/components/CityAutocomplete';
import type { CitySuggestion } from '../../lib/citySearch';
import TripCalendar from './TripCalendar';
import type {
    DailyForecast,
    ClothingArticle,
    OutfitOccasion,
    Settings,
    SavedTripFitPlan,
} from '../../types';
import {
    PACKING_GROUPS,
    FORECAST_WINDOW_DAYS,
    type DayPlan,
    activeOutfit,
    buildTripWeather,
    fmtDate,
    fmtShortDate,
    phraseEmoji,
    categoryKey,
    daysUntil,
    isInForecastWindow,
    isForecastStale,
    tripFitStatus,
    rehydratePlans,
    snapshotFromPlans,
} from './shared';
import ShareToInstagramSheet from '../../components/ShareCard/ShareToInstagramSheet';
import TripFitShareCard from '../../components/ShareCard/TripFitShareCard';
import { tripShareLink } from '../../lib/share/deepLinks';

// ─── Local date helper ──────────────────────────────────────────────────────────
// Build a yyyy-mm-dd string from a Date using LOCAL components, so a calendar
// selection (local midnight) never shifts a day under negative UTC offsets.
const toISODate = (d: Date): string =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
        d.getDate(),
    ).padStart(2, '0')}`;

const fromISODate = (iso: string): Date => new Date(iso + 'T12:00:00');

// ─── ThumbImage ───────────────────────────────────────────────────────────────

const ThumbImage = ({
    article,
    size,
    colors,
}: {
    article: ClothingArticle;
    size: number;
    colors: ColorTokens;
}) => {
    const [err, setErr] = useState(false);
    return (
        <GlassCard
            glassStyle='clear'
            style={{
                width: size,
                height: size,
                borderRadius: radius.sm - 2,
                alignItems: 'center',
                justifyContent: 'center',
            }}
        >
            {article.imageUrl && !err ? (
                <Image
                    source={{ uri: article.imageUrl }}
                    style={{ width: size, height: size }}
                    resizeMode='cover'
                    onError={() => setErr(true)}
                />
            ) : (
                <HangerIcon size={size * 0.4} color={colors.textMuted} decorative />
            )}
        </GlassCard>
    );
};

// ─── DayCard ─────────────────────────────────────────────────────────────────

const DayCard = ({
    plan,
    colors,
    cardWidth,
    animValue,
    isReplanning,
    onReplan,
    onShare,
}: {
    plan: DayPlan;
    colors: ColorTokens;
    cardWidth: number;
    animValue: Animated.Value;
    isReplanning: boolean;
    onReplan: () => void;
    onShare: () => void;
}) => {
    const outfit = activeOutfit(plan);
    const articles = outfit.slots.map(
        (s: { article: ClothingArticle }) => s.article,
    );
    const thumbSize = Math.floor(
        (cardWidth - spacing.md * 2 - spacing.xs * 3) / 4,
    );

    const translateY = animValue.interpolate({
        inputRange: [0, 1],
        outputRange: [20, 0],
    });

    return (
        <Animated.View
            style={{
                transform: [{ translateY }],
                width: cardWidth,
                paddingHorizontal: spacing.xs,
            }}
        >
            <GlassCard style={dayCardSt.card} glassStyle='regular'>
                <Text style={[dayCardSt.dateLabel, { color: colors.textSecondary }]}>
                    {phraseEmoji(plan.day.dayPhrase)} {fmtDate(plan.day.date)}
                </Text>
                <Text style={[dayCardSt.tempRow, { color: colors.textMuted }]}>
                    {Math.round(plan.day.minTempF)}° – {Math.round(plan.day.maxTempF)}°F ·{' '}
                    {humanizeCondition(plan.day.dayPhrase)}
                </Text>

                <RNView style={dayCardSt.thumbGrid}>
                    {articles.slice(0, 4).map((a: ClothingArticle, i: number) => (
                        <ThumbImage
                            key={a._id ?? i}
                            article={a}
                            size={thumbSize}
                            colors={colors}
                        />
                    ))}
                </RNView>

                {outfit.notes.length > 0 && (
                    <Text
                        style={[dayCardSt.note, { color: colors.textMuted }]}
                        numberOfLines={2}
                    >
                        {outfit.notes[0]}
                    </Text>
                )}

                <GlassCard glassStyle='clear' style={dayCardSt.replanBtn}>
                    <Pressable
                        onPress={onReplan}
                        disabled={isReplanning}
                        style={dayCardSt.replanInner}
                        accessibilityRole='button'
                        accessibilityLabel='Replan this day'
                        hitSlop={8}
                    >
                        {isReplanning ? (
                            <ActivityIndicator size='small' color={colors.textPrimary} />
                        ) : (
                            <Text
                                style={[dayCardSt.replanIcon, { color: colors.textSecondary }]}
                            >
                                ↺
                            </Text>
                        )}
                    </Pressable>
                </GlassCard>

                <GlassCard glassStyle='clear' style={dayCardSt.shareBtn}>
                    <Pressable
                        onPress={onShare}
                        style={dayCardSt.replanInner}
                        accessibilityRole='button'
                        accessibilityLabel='Share this day to Instagram'
                        hitSlop={8}
                    >
                        <Text
                            style={[dayCardSt.replanIcon, { color: colors.textSecondary }]}
                        >
                            📸
                        </Text>
                    </Pressable>
                </GlassCard>
            </GlassCard>
        </Animated.View>
    );
};

const dayCardSt = StyleSheet.create({
    card: { padding: spacing.md, gap: 8, minHeight: 200, borderRadius: radius.lg },
    dateLabel: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.sm },
    tempRow: { fontFamily: fonts.body, fontSize: fontSizes.xs },
    thumbGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
    note: { fontFamily: fonts.body, fontSize: fontSizes.xs, fontStyle: 'italic' },
    replanBtn: {
        position: 'absolute',
        top: spacing.xs,
        right: spacing.xs,
        borderRadius: radius.pill,
        overflow: 'hidden',
    },
    shareBtn: {
        position: 'absolute',
        top: spacing.xs,
        right: spacing.xs + 38,
        borderRadius: radius.pill,
        overflow: 'hidden',
    },
    replanInner: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center' },
    replanIcon: { fontSize: 18, lineHeight: 22 },
});

// ─── SkeletonCard ─────────────────────────────────────────────────────────────

const SkeletonCard = ({ cardWidth }: { cardWidth: number }) => {
    const shimmer = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        const loop = Animated.loop(
            Animated.sequence([
                Animated.timing(shimmer, { toValue: 1, duration: 700, useNativeDriver: true }),
                Animated.timing(shimmer, { toValue: 0, duration: 700, useNativeDriver: true }),
            ]),
        );
        loop.start();
        return () => loop.stop();
    }, [shimmer]);

    const shimmerOpacity = shimmer.interpolate({
        inputRange: [0, 1],
        outputRange: [0.35, 0.85],
    });

    return (
        <RNView style={{ width: cardWidth, paddingHorizontal: spacing.xs }}>
            <GlassCard glassStyle='regular' style={skSt.card}>
                <Animated.View style={{ opacity: shimmerOpacity, gap: 10 }}>
                    <GlassCard glassStyle='clear' style={[skSt.line, { width: '45%' }]} />
                    <GlassCard glassStyle='clear' style={[skSt.line, { width: '70%' }]} />
                    <RNView style={skSt.thumbRow}>
                        {[0, 1, 2, 3].map((i) => (
                            <GlassCard key={i} glassStyle='clear' style={skSt.thumbBox} />
                        ))}
                    </RNView>
                    <GlassCard glassStyle='clear' style={[skSt.line, { width: '85%' }]} />
                </Animated.View>
            </GlassCard>
        </RNView>
    );
};

const skSt = StyleSheet.create({
    card: { padding: spacing.md, gap: 10, minHeight: 200, borderRadius: radius.lg },
    line: { height: 11, borderRadius: 6 },
    thumbRow: { flexDirection: 'row', gap: spacing.xs },
    thumbBox: { width: 52, height: 52, borderRadius: radius.sm - 2 },
});

// ─── HeroBanner ───────────────────────────────────────────────────────────────

// Vibrant weather-gradient banner designed for the dark palette (light text on
// dark glass). Forced dark so it looks the same in light and dark mode, matching
// the trip tiles in TripLibrary.
const HeroBanner = ({
    plans,
    destination,
}: {
    plans: DayPlan[];
    destination: string;
}) => {
    const allMin = plans.map((p) => p.day.minTempF);
    const allMax = plans.map((p) => p.day.maxTempF);
    const minTemp = Math.round(Math.min(...allMin));
    const maxTemp = Math.round(Math.max(...allMax));

    const startStr = fmtShortDate(fromISODate(plans[0].day.date));
    const endStr = fmtShortDate(fromISODate(plans[plans.length - 1].day.date));

    const phraseCounts: Record<string, number> = {};
    for (const p of plans)
        phraseCounts[p.day.dayPhrase] = (phraseCounts[p.day.dayPhrase] ?? 0) + 1;
    const dominantPhrase = Object.entries(phraseCounts).sort(
        (a, b) => b[1] - a[1],
    )[0][0];

    const gradColors = gradientFor(dominantPhrase, true) as string[];

    return (
        <ForceDarkPalette>
            <RNView style={{ borderRadius: radius.lg, overflow: 'hidden' }}>
                <LinearGradient
                    colors={gradColors as [string, string, ...string[]]}
                    style={StyleSheet.absoluteFill}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                />
                <GlassCard glassStyle='regular' style={heroBannerSt.card}>
                    <Text style={heroBannerSt.emoji}>{phraseEmoji(dominantPhrase)}</Text>
                    <Text style={[heroBannerSt.destination, { color: darkColors.textPrimary }]}>
                        {destination}
                    </Text>
                    <Text style={[heroBannerSt.dateRange, { color: darkColors.textSecondary }]}>
                        {startStr} – {endStr}
                    </Text>
                    <Text style={[heroBannerSt.tempRange, { color: darkColors.textPrimary }]}>
                        {minTemp}° – {maxTemp}°F
                    </Text>
                </GlassCard>
            </RNView>
        </ForceDarkPalette>
    );
};

const heroBannerSt = StyleSheet.create({
    card: { padding: spacing.md, gap: 4 },
    emoji: { fontSize: 36, lineHeight: 42 },
    destination: { fontFamily: fonts.display, fontSize: fontSizes.xxl, marginTop: 2 },
    dateRange: { fontFamily: fonts.body, fontSize: fontSizes.sm },
    tempRange: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.md },
});

// ─── PackingRow ───────────────────────────────────────────────────────────────

const PackingRow = ({
    article,
    colors,
    isChecked,
    onToggle,
}: {
    article: ClothingArticle;
    colors: ColorTokens;
    isChecked: boolean;
    onToggle: () => void;
}) => (
    <Pressable
        onPress={onToggle}
        style={[packSt.row, { borderBottomColor: colors.glassBorder }]}
        accessibilityRole='checkbox'
        accessibilityState={{ checked: isChecked }}
    >
        <GlassCard
            glassStyle='clear'
            style={[
                packSt.checkCircle,
                { borderColor: isChecked ? colors.saveBtnBg : colors.glassBorder },
            ]}
        >
            {isChecked && (
                <Text style={[packSt.checkMark, { color: colors.saveBtnBg }]}>✓</Text>
            )}
        </GlassCard>
        <RNView style={{ flex: 1, gap: 2 }}>
            <Text
                style={[
                    packSt.name,
                    { color: isChecked ? colors.textMuted : colors.textPrimary },
                    isChecked && packSt.checkedName,
                ]}
            >
                {article.name || article.clothingType}
            </Text>
            <Text style={[packSt.meta, { color: colors.textMuted }]}>
                {[article.clothingType, article.color].filter(Boolean).join(' · ')}
            </Text>
        </RNView>
    </Pressable>
);

const packSt = StyleSheet.create({
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        borderBottomWidth: StyleSheet.hairlineWidth,
        gap: spacing.sm,
    },
    checkCircle: {
        width: 24,
        height: 24,
        borderRadius: 12,
        borderWidth: 1.5,
        alignItems: 'center',
        justifyContent: 'center',
    },
    checkMark: { fontSize: 13, fontFamily: fonts.bodySemiBold, lineHeight: 16 },
    name: { fontFamily: fonts.bodyMedium, fontSize: fontSizes.sm },
    checkedName: { textDecorationLine: 'line-through' },
    meta: { fontFamily: fonts.body, fontSize: fontSizes.xs },
});

// ─── GroupedPackingList ───────────────────────────────────────────────────────

const GroupedPackingList = ({
    packingList,
    checkedIds,
    onToggle,
    colors,
}: {
    packingList: ClothingArticle[];
    checkedIds: Set<string>;
    onToggle: (id: string) => void;
    colors: ColorTokens;
}) => {
    const unpacked = packingList.filter((a) => !checkedIds.has(a._id));
    const packed = packingList.filter((a) => checkedIds.has(a._id));

    const unpGrouped: Record<string, ClothingArticle[]> = {};
    for (const a of unpacked) {
        const k = categoryKey(a);
        (unpGrouped[k] ??= []).push(a);
    }

    return (
        <RNView>
            {PACKING_GROUPS.map(({ key, label, emoji }) => {
                const items = unpGrouped[key];
                if (!items?.length) return null;
                return (
                    <RNView key={key}>
                        <Text style={[groupSt.sectionHeader, { color: colors.textMuted }]}>
                            {emoji} {label}
                        </Text>
                        {items.map((a) => (
                            <PackingRow
                                key={a._id}
                                article={a}
                                colors={colors}
                                isChecked={false}
                                onToggle={() => onToggle(a._id)}
                            />
                        ))}
                    </RNView>
                );
            })}

            {packed.length > 0 && (
                <RNView>
                    <Text
                        style={[
                            groupSt.sectionHeader,
                            { color: colors.textMuted, marginTop: spacing.sm },
                        ]}
                    >
                        ✓ Packed
                    </Text>
                    {packed.map((a) => (
                        <PackingRow
                            key={a._id}
                            article={a}
                            colors={colors}
                            isChecked
                            onToggle={() => onToggle(a._id)}
                        />
                    ))}
                </RNView>
            )}
        </RNView>
    );
};

const groupSt = StyleSheet.create({
    sectionHeader: {
        fontFamily: fonts.bodySemiBold,
        fontSize: fontSizes.xs,
        textTransform: 'uppercase',
        letterSpacing: 0.8,
        paddingVertical: 8,
    },
});


// ─── Props ──────────────────────────────────────────────────────────────────────

export interface PlannerPrefill {
    destination?: string;
    startDate?: Date | null;
    endDate?: Date | null;
    occasion?: OutfitOccasion;
    sourceAirlineTripId?: string;
}

interface TripPlannerProps {
    articles: ClothingArticle[];
    closetId: string;
    settings: Settings;
    existingPlan?: SavedTripFitPlan;
    prefill?: PlannerPrefill;
    onBack: () => void;
    onPersist: (plan: SavedTripFitPlan) => Promise<SavedTripFitPlan>;
    onDeleted: (id: string) => void;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function TripPlanner({
    articles,
    closetId,
    settings,
    existingPlan,
    prefill,
    onBack,
    onPersist,
    onDeleted,
}: TripPlannerProps) {
    const { colors } = useTheme();
    const reduceMotion = useReduceMotion();
    const { width: windowWidth } = useWindowDimensions();

    const cardWidth = windowWidth - spacing.md * 4.1;

    // ── Form state ──
    const [destination, setDestination] = useState(
        existingPlan?.destination ?? prefill?.destination ?? '',
    );
    const [tripName, setTripName] = useState(existingPlan?.name ?? '');
    const [tripStart, setTripStart] = useState<Date | null>(
        existingPlan ? fromISODate(existingPlan.startDate) : prefill?.startDate ?? null,
    );
    const [tripEnd, setTripEnd] = useState<Date | null>(
        existingPlan ? fromISODate(existingPlan.endDate) : prefill?.endDate ?? null,
    );
    const [selectedOccasion, setSelectedOccasion] = useState<OutfitOccasion>(
        existingPlan?.occasion ?? prefill?.occasion ?? 'everyday',
    );

    // ── Result / interaction state ──
    const [loading, setLoading] = useState(false);
    const [savingPending, setSavingPending] = useState(false);
    const [plans, setPlans] = useState<DayPlan[]>(
        existingPlan ? rehydratePlans(existingPlan, articles) : [],
    );
    const [error, setError] = useState<string | null>(null);
    const [activeIdx, setActiveIdx] = useState(0);
    const [shareDayIdx, setShareDayIdx] = useState<number | null>(null);
    const [checkedIds, setCheckedIds] = useState<Set<string>>(
        new Set(existingPlan?.checkedIds ?? []),
    );
    const [replanningIdx, setReplanningIdx] = useState<number | null>(null);
    const [isSaved, setIsSaved] = useState(!!existingPlan);
    const [refreshAvailable, setRefreshAvailable] = useState(
        existingPlan
            ? tripFitStatus(existingPlan) === 'planned' &&
                  isInForecastWindow(existingPlan.startDate) &&
                  isForecastStale(existingPlan)
            : false,
    );

    // ── Refs (avoid stale closures when persisting after a state update) ──
    const pagerRef = useRef<ScrollView>(null);
    const forecastDaysRef = useRef<DailyForecast[]>([]);
    const animValues = useRef<Animated.Value[]>([]).current;
    const planIdRef = useRef<string>(existingPlan?.id ?? newPlanId());
    const createdAtRef = useRef<string>(existingPlan?.createdAt ?? new Date().toISOString());
    const latRef = useRef<number>(existingPlan?.lat ?? 0);
    const lonRef = useRef<number>(existingPlan?.lon ?? 0);
    const fetchedAtRef = useRef<string | undefined>(existingPlan?.forecastFetchedAt);
    const sourceTripRef = useRef<string | undefined>(
        existingPlan?.sourceAirlineTripId ?? prefill?.sourceAirlineTripId,
    );
    const plansRef = useRef<DayPlan[]>(plans);
    const checkedRef = useRef<Set<string>>(checkedIds);
    useEffect(() => { plansRef.current = plans; }, [plans]);
    useEffect(() => { checkedRef.current = checkedIds; }, [checkedIds]);

    // ── Derived ──
    const { days, startISO } = useMemo(() => {
        if (!tripStart || !tripEnd) return { days: 0, startISO: null as string | null };
        const count =
            Math.round((tripEnd.getTime() - tripStart.getTime()) / 86_400_000) + 1;
        return { days: count, startISO: toISODate(tripStart) };
    }, [tripStart, tripEnd]);

    const beyondWindow = useMemo(
        () => (startISO ? daysUntil(startISO) > FORECAST_WINDOW_DAYS : false),
        [startISO],
    );

    const status = useMemo(() => {
        if (tripEnd && daysUntil(toISODate(tripEnd)) < 0) return 'completed' as const;
        return plans.length ? ('planned' as const) : ('pending' as const);
    }, [tripEnd, plans.length]);

    const packingList: ClothingArticle[] = useMemo(() => {
        const seen = new Set<string>();
        const result: ClothingArticle[] = [];
        for (const plan of plans) {
            const outfit = activeOutfit(plan);
            if (!outfit) continue;
            for (const slot of outfit.slots) {
                if (!seen.has(slot.article._id)) {
                    seen.add(slot.article._id);
                    result.push(slot.article);
                }
            }
        }
        return result;
    }, [plans]);

    // ── Stagger animation ──
    const runStagger = useCallback(
        (count: number) => {
            animValues.splice(0);
            for (let i = 0; i < count; i++) animValues.push(new Animated.Value(0));
            if (reduceMotion) {
                animValues.forEach((v) => v.setValue(1));
            } else {
                Animated.stagger(
                    80,
                    animValues.map((v) =>
                        Animated.timing(v, { toValue: 1, duration: 320, useNativeDriver: true }),
                    ),
                ).start();
            }
        },
        [animValues, reduceMotion],
    );

    // Run the entrance animation once for a rehydrated saved plan.
    useEffect(() => {
        if (existingPlan && plans.length) runStagger(plans.length);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ── Build a SavedTripFitPlan from current state ──
    const buildPlan = useCallback(
        (override?: Partial<SavedTripFitPlan>): SavedTripFitPlan => {
            const snap = override?.days ?? snapshotFromPlans(plansRef.current);
            return {
                id: planIdRef.current,
                name: tripName.trim() || undefined,
                destination: destination.trim(),
                lat: latRef.current,
                lon: lonRef.current,
                startDate: tripStart ? toISODate(tripStart) : existingPlan?.startDate ?? '',
                endDate: tripEnd ? toISODate(tripEnd) : existingPlan?.endDate ?? '',
                occasion: selectedOccasion,
                closetId,
                days: snap,
                checkedIds: override?.checkedIds ?? [...checkedRef.current],
                forecastFetchedAt: snap.length ? fetchedAtRef.current : undefined,
                sourceAirlineTripId: sourceTripRef.current,
                createdAt: createdAtRef.current,
                updatedAt: new Date().toISOString(),
                ...override,
            };
        },
        [tripName, destination, tripStart, tripEnd, selectedOccasion, closetId, existingPlan],
    );

    const persist = useCallback(
        async (override?: Partial<SavedTripFitPlan>) => {
            const plan = buildPlan(override);
            await onPersist(plan);
            setIsSaved(true);
            setRefreshAvailable(false);
        },
        [buildPlan, onPersist],
    );

    // ── Core: fetch forecast + generate day-by-day outfits ──
    const generate = useCallback(async (): Promise<boolean> => {
        if (!destination.trim() || !(latRef.current || lonRef.current)) {
            Alert.alert('Select a destination', 'Choose a city from the suggestions list.');
            return false;
        }
        if (!tripStart || !tripEnd) {
            Alert.alert('Select dates', 'Pick a start and end date on the calendar.');
            return false;
        }

        setLoading(true);
        setError(null);
        setActiveIdx(0);

        try {
            const coords = { lat: latRef.current, lon: lonRef.current };

            const res = await api.get<DailyForecast[]>('/api/weather/daily', {
                params: { lat: coords.lat, lon: coords.lon },
                ...authHeaders(),
            });
            const allDays: DailyForecast[] = res.data ?? [];

            const start = toISODate(tripStart);
            const slicedDays = allDays.filter((d) => d.date >= start).slice(0, days);

            if (!slicedDays.length) {
                throw new Error(
                    'Selected dates are beyond the forecast window. Choose dates within the next 10 days.',
                );
            }

            forecastDaysRef.current = slicedDays;

            const effectiveSettings = { ...settings, occasion: selectedOccasion };
            const usedAcrossTrip = new Set<string>();
            const newPlans: DayPlan[] = slicedDays.map((day) => {
                const weather = buildTripWeather(day);
                const { results } = generateOutfits(
                    articles,
                    weather,
                    effectiveSettings,
                    new Set(usedAcrossTrip),
                    8,
                );
                const top = results[0];
                if (top) for (const slot of top.slots) usedAcrossTrip.add(slot.article._id);
                return { day, candidates: results, candidateIdx: 0 };
            });

            for (const p of newPlans) {
                const top = p.candidates[0];
                if (top?.notes.length) recordGapsFromNotes(top.notes).catch(() => {});
            }

            fetchedAtRef.current = new Date().toISOString();
            setPlans(newPlans);
            plansRef.current = newPlans;
            runStagger(newPlans.length);
            return true;
        } catch (err: any) {
            const msg: string =
                err?.response?.data?.error ?? err?.message ?? 'Could not plan trip.';
            setError(msg);
            return false;
        } finally {
            setLoading(false);
        }
    }, [destination, tripStart, tripEnd, days, articles, settings, selectedOccasion, runStagger]);

    // Auto-generate when opening a pending trip that has entered the forecast window.
    useEffect(() => {
        if (
            existingPlan &&
            tripFitStatus(existingPlan) === 'pending' &&
            isInForecastWindow(existingPlan.startDate)
        ) {
            (async () => {
                const ok = await generate();
                if (ok) await persist();
            })();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ── New-trip: plan (generate only; user saves explicitly) ──
    const onPlan = useCallback(async () => {
        const ok = await generate();
        // An already-saved trip (e.g. forecast refresh) persists immediately.
        if (ok && isSaved) await persist();
    }, [generate, isSaved, persist]);

    // ── Save a brand-new in-window trip ──
    const onSave = useCallback(async () => {
        await persist();
    }, [persist]);

    // ── Save a beyond-window trip for later (pending, no outfits yet) ──
    const onSaveForLater = useCallback(async () => {
        if (!destination.trim() || !(latRef.current || lonRef.current) || !tripStart || !tripEnd) {
            Alert.alert('Add details', 'Choose a destination from the suggestions list and pick trip dates.');
            return;
        }
        setSavingPending(true);
        try {
            await persist({ days: [], checkedIds: [], forecastFetchedAt: undefined });
            onBack();
        } finally {
            setSavingPending(false);
        }
    }, [destination, tripStart, tripEnd, persist, onBack]);

    // ── Replan a single day ──
    const onReplanDay = useCallback(
        async (idx: number) => {
            const day = forecastDaysRef.current[idx] ?? plansRef.current[idx]?.day;
            if (!day) return;
            setReplanningIdx(idx);
            try {
                const prev = plansRef.current;
                const current = prev[idx];
                if (!current) return;

                let next = [...prev];
                const nextIdx = current.candidateIdx + 1;
                if (nextIdx < current.candidates.length) {
                    next[idx] = { ...current, candidateIdx: nextIdx };
                } else {
                    // Exhausted candidates — regenerate, penalising the current outfit.
                    const excluded = new Set<string>();
                    const cur = current.candidates[current.candidateIdx];
                    if (cur) for (const slot of cur.slots) excluded.add(slot.article._id);
                    const effectiveSettings = { ...settings, occasion: selectedOccasion };
                    const { results } = generateOutfits(
                        articles,
                        buildTripWeather(day),
                        effectiveSettings,
                        excluded,
                        8,
                    );
                    next[idx] = {
                        day,
                        candidates: results.length ? results : current.candidates,
                        candidateIdx: 0,
                    };
                }

                setPlans(next);
                plansRef.current = next;

                if (!reduceMotion && animValues[idx]) {
                    animValues[idx].setValue(0);
                    Animated.timing(animValues[idx], {
                        toValue: 1,
                        duration: 320,
                        useNativeDriver: true,
                    }).start();
                }

                if (isSaved) await persist({ days: snapshotFromPlans(next) });
            } finally {
                setReplanningIdx(null);
            }
        },
        [articles, settings, selectedOccasion, reduceMotion, animValues, isSaved, persist],
    );

    // ── Toggle a packed item ──
    const toggleChecked = useCallback(
        (id: string) => {
            const next = new Set(checkedRef.current);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            setCheckedIds(next);
            checkedRef.current = next;
            if (isSaved) persist({ checkedIds: [...next] }).catch(() => {});
        },
        [isSaved, persist],
    );

    // ── Rename (saved trips) ──
    const onRenameSubmit = useCallback(() => {
        if (isSaved) persist().catch(() => {});
    }, [isSaved, persist]);

    // ── Delete ──
    const onDelete = useCallback(() => {
        Alert.alert('Delete trip', 'Remove this trip and its packing list?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete',
                style: 'destructive',
                onPress: () => onDeleted(planIdRef.current),
            },
        ]);
    }, [onDeleted]);

    // ── Share packing list ──
    const handleSharePacking = useCallback(() => {
        if (!packingList.length) return;
        const lines: string[] = [`✈️ TripFit Packing List — ${destination}`, ''];
        for (const { key, label, emoji } of PACKING_GROUPS) {
            const items = packingList.filter((a) => categoryKey(a) === key);
            if (!items.length) continue;
            lines.push(`${emoji} ${label}:`);
            for (const a of items) {
                lines.push(
                    `  • ${a.name || a.clothingType}${a.color ? ` (${a.color})` : ''}`,
                );
            }
            lines.push('');
        }
        lines.push('Packed with Ojo ✨');
        Share.share({ message: lines.join('\n') }).catch(() => {});
    }, [packingList, destination]);

    const st = useMemo(() => makeStyles(colors), [colors]);
    const calContainerWidth = windowWidth - spacing.md * 2;
    const showForm = !isSaved;

    return (
        <SafeAreaView style={st.root} edges={['top', 'bottom']}>
            {/* Header */}
            <View style={st.header}>
                <Pressable
                    onPress={onBack}
                    style={st.backBtn}
                    accessibilityLabel='Back to trips'
                    accessibilityRole='button'
                >
                    <Text style={[st.backArrow, { color: colors.textPrimary }]}>‹</Text>
                </Pressable>
                <Text style={st.title}>{isSaved ? 'Your Trip' : 'New Trip'}</Text>
            </View>

            <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={st.scroll}
                keyboardShouldPersistTaps='handled'
            >
                {/* Name (always available) */}
                <View style={st.inputSection}>
                    <Text style={st.label}>Trip name (optional)</Text>
                    <TextInput
                        style={[
                            st.textInput,
                            {
                                color: colors.textPrimary,
                                borderColor: colors.glassBorder,
                                backgroundColor: colors.glassBg,
                            },
                        ]}
                        placeholder='e.g. Summer in Lisbon'
                        placeholderTextColor={colors.textMuted}
                        value={tripName}
                        onChangeText={setTripName}
                        onSubmitEditing={onRenameSubmit}
                        onBlur={onRenameSubmit}
                        returnKeyType='done'
                        autoCapitalize='words'
                    />
                </View>

                {showForm ? (
                    <>
                        {/* Destination */}
                        <View style={st.inputSection}>
                            <Text style={st.label}>Destination</Text>
                            <CityAutocomplete
                                initialQuery={destination}
                                onSelect={(city: CitySuggestion | null) => {
                                    if (city) {
                                        setDestination(city.name);
                                        latRef.current = city.lat;
                                        lonRef.current = city.lon;
                                    } else {
                                        // Editing away from a prior pick invalidates it —
                                        // force a fresh selection before planning/saving.
                                        setDestination('');
                                        latRef.current = 0;
                                        lonRef.current = 0;
                                    }
                                }}
                                placeholder='e.g. New York, Tokyo, London'
                                accessibilityLabel='Search for a destination city'
                            />
                        </View>

                        {/* Calendar */}
                        <View style={st.inputSection}>
                            <Text style={st.label}>Trip Dates</Text>
                            <TripCalendar
                                startDate={tripStart}
                                endDate={tripEnd}
                                onRangeChange={(start, end) => {
                                    setTripStart(start);
                                    setTripEnd(end);
                                }}
                                maxDays={FORECAST_WINDOW_DAYS}
                                containerWidth={calContainerWidth}
                            />
                            {days > 0 && tripStart && tripEnd && (
                                <Text style={[st.dateSummary, { color: colors.textSecondary }]}>
                                    {days} day{days !== 1 ? 's' : ''} · {fmtShortDate(tripStart)} –{' '}
                                    {fmtShortDate(tripEnd)}
                                </Text>
                            )}
                        </View>

                        {/* Occasion */}
                        <View style={st.inputSection}>
                            <Text style={st.label}>Occasion</Text>
                            <OccasionChips
                                active={selectedOccasion}
                                onChange={setSelectedOccasion}
                            />
                        </View>

                        {/* Primary action: generate (in window) or save for later (beyond window) */}
                        {beyondWindow ? (
                            <>
                                <RNView style={st.infoNote}>
                                    <GlassCard glassStyle='clear' style={st.infoInner}>
                                        <Text style={[st.infoText, { color: colors.textSecondary }]}>
                                            ✈️ This trip is beyond the 10-day forecast. Save it now and
                                            we'll generate outfits once it's within range.
                                        </Text>
                                    </GlassCard>
                                </RNView>
                                <Pressable
                                    style={[
                                        st.planBtn,
                                        { backgroundColor: colors.saveBtnBg },
                                        (savingPending || days === 0) && st.planBtnDisabled,
                                    ]}
                                    onPress={onSaveForLater}
                                    disabled={savingPending || days === 0}
                                    accessibilityRole='button'
                                    accessibilityLabel='Save trip for later'
                                >
                                    {savingPending ? (
                                        <ActivityIndicator color={colors.saveBtnText} />
                                    ) : (
                                        <Text style={[st.planBtnText, { color: colors.saveBtnText }]}>
                                            Save trip for later
                                        </Text>
                                    )}
                                </Pressable>
                            </>
                        ) : (
                            <Pressable
                                style={[
                                    st.planBtn,
                                    { backgroundColor: colors.saveBtnBg },
                                    (loading || days === 0) && st.planBtnDisabled,
                                ]}
                                onPress={onPlan}
                                disabled={loading || days === 0}
                                accessibilityRole='button'
                                accessibilityLabel='Plan trip'
                            >
                                {loading ? (
                                    <ActivityIndicator color={colors.saveBtnText} />
                                ) : (
                                    <Text style={[st.planBtnText, { color: colors.saveBtnText }]}>
                                        Plan my trip ✈️
                                    </Text>
                                )}
                            </Pressable>
                        )}
                    </>
                ) : (
                    /* Saved summary */
                    <RNView style={st.summaryRow}>
                        <Text style={[st.summaryText, { color: colors.textSecondary }]}>
                            📍 {destination} · {selectedOccasion}
                            {tripStart && tripEnd
                                ? ` · ${fmtShortDate(tripStart)}–${fmtShortDate(tripEnd)}`
                                : ''}
                        </Text>
                        <StatusBadge status={status} startDate={startISO} colors={colors} st={st} />
                    </RNView>
                )}

                {/* Refresh banner for stale planned trips */}
                {refreshAvailable && !loading && (
                    <Pressable onPress={onPlan} accessibilityRole='button'>
                        <GlassCard glassStyle='clear' style={st.refreshCard}>
                            <Text style={[st.refreshText, { color: colors.textPrimary }]}>
                                🔄 The forecast may have changed — tap to regenerate outfits.
                            </Text>
                        </GlassCard>
                    </Pressable>
                )}

                {/* Pending placeholder (saved, beyond window) */}
                {isSaved && status === 'pending' && !loading && startISO && (
                    <GlassCard glassStyle='regular' style={st.pendingCard}>
                        <Text style={st.pendingEmoji}>🧳</Text>
                        <Text style={[st.pendingTitle, { color: colors.textPrimary }]}>
                            Outfits unlock soon
                        </Text>
                        <Text style={[st.pendingSub, { color: colors.textMuted }]}>
                            We'll build your day-by-day plan when {destination} comes within the
                            10-day forecast — about {Math.max(0, daysUntil(startISO) - FORECAST_WINDOW_DAYS)}{' '}
                            day(s) from now.
                        </Text>
                    </GlassCard>
                )}

                {/* Error */}
                {error && (
                    <RNView
                        style={{
                            borderRadius: radius.sm,
                            borderWidth: 1,
                            borderColor: 'rgba(239,68,68,0.4)',
                            overflow: 'hidden',
                        }}
                    >
                        <GlassCard glassStyle='clear' style={st.errorInner}>
                            <Text style={st.errorText}>{error}</Text>
                        </GlassCard>
                    </RNView>
                )}

                {/* Skeleton loading */}
                {loading && (
                    <>
                        <Text style={st.sectionHeader}>Day-by-Day Outfits</Text>
                        <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false}>
                            {[0, 1, 2].map((i) => (
                                <SkeletonCard key={i} cardWidth={cardWidth} />
                            ))}
                        </ScrollView>
                    </>
                )}

                {/* Results */}
                {!loading && plans.length > 0 && (
                    <>
                        <HeroBanner plans={plans} destination={destination} />

                        {/* Save CTA for a freshly planned, not-yet-saved trip */}
                        {!isSaved && (
                            <Pressable
                                style={[st.planBtn, { backgroundColor: colors.saveBtnBg }]}
                                onPress={onSave}
                                accessibilityRole='button'
                                accessibilityLabel='Save trip'
                            >
                                <Text style={[st.planBtnText, { color: colors.saveBtnText }]}>
                                    Save to My Trips
                                </Text>
                            </Pressable>
                        )}

                        <Text style={st.sectionHeader}>Day-by-Day Outfits</Text>

                        <GlassGroup spacing={12}>
                            <ScrollView
                                ref={pagerRef}
                                horizontal
                                snapToInterval={cardWidth}
                                snapToAlignment='start'
                                disableIntervalMomentum
                                decelerationRate='normal'
                                scrollEventThrottle={16}
                                showsHorizontalScrollIndicator={false}
                                contentContainerStyle={{ paddingVertical: spacing.xs }}
                                onMomentumScrollEnd={(e) => {
                                    const page = Math.round(
                                        e.nativeEvent.contentOffset.x / cardWidth,
                                    );
                                    setActiveIdx(Math.max(0, Math.min(page, plans.length - 1)));
                                }}
                            >
                                {plans.map((plan, i) => (
                                    <DayCard
                                        key={i}
                                        plan={plan}
                                        colors={colors}
                                        cardWidth={cardWidth}
                                        animValue={animValues[i] ?? new Animated.Value(1)}
                                        isReplanning={replanningIdx === i}
                                        onReplan={() => onReplanDay(i)}
                                        onShare={() => setShareDayIdx(i)}
                                    />
                                ))}
                            </ScrollView>
                        </GlassGroup>

                        {/* Dot indicators */}
                        {plans.length > 1 && (
                            <RNView style={st.dotsRow}>
                                <GlassCard glassStyle='clear' style={st.dotsPill}>
                                    {plans.map((_, i) => (
                                        <Pressable
                                            key={i}
                                            hitSlop={8}
                                            onPress={() => {
                                                setActiveIdx(i);
                                                pagerRef.current?.scrollTo({
                                                    x: i * cardWidth,
                                                    animated: true,
                                                });
                                            }}
                                            style={[
                                                st.dot,
                                                i === activeIdx && st.dotActive,
                                                {
                                                    backgroundColor:
                                                        i === activeIdx
                                                            ? colors.textPrimary
                                                            : colors.glassBorder,
                                                },
                                            ]}
                                            accessibilityRole='button'
                                            accessibilityLabel={`Day ${i + 1}`}
                                        />
                                    ))}
                                </GlassCard>
                            </RNView>
                        )}

                        {/* Packing list header */}
                        <RNView style={st.sectionHeaderRow}>
                            <RNView>
                                <Text style={st.sectionHeader}>Packing List</Text>
                                <Text style={[st.sectionSub, { color: colors.textMuted }]}>
                                    {packingList.length - checkedIds.size} remaining ·{' '}
                                    {packingList.length} total
                                </Text>
                            </RNView>
                            <GlassCard glassStyle='clear' style={st.shareBtn}>
                                <Pressable
                                    onPress={handleSharePacking}
                                    style={st.shareBtnInner}
                                    accessibilityRole='button'
                                    accessibilityLabel='Share packing list'
                                >
                                    <Text style={[st.shareBtnText, { color: colors.textSecondary }]}>
                                        ↑ Share
                                    </Text>
                                </Pressable>
                            </GlassCard>
                        </RNView>

                        <GlassCard glassStyle='regular' style={st.packCard}>
                            <GroupedPackingList
                                packingList={packingList}
                                checkedIds={checkedIds}
                                onToggle={toggleChecked}
                                colors={colors}
                            />
                        </GlassCard>
                    </>
                )}

                {/* Delete (saved trips only) */}
                {isSaved && (
                    <Pressable
                        onPress={onDelete}
                        style={st.deleteBtn}
                        accessibilityRole='button'
                        accessibilityLabel='Delete trip'
                    >
                        <Text style={st.deleteText}>Delete trip</Text>
                    </Pressable>
                )}
            </ScrollView>

            {shareDayIdx !== null && plans[shareDayIdx] && (
                <ShareToInstagramSheet
                    visible
                    onClose={() => setShareDayIdx(null)}
                    renderCard={(cardRef) => (
                        <TripFitShareCard
                            ref={cardRef}
                            destination={destination}
                            day={plans[shareDayIdx].day}
                            slots={activeOutfit(plans[shareDayIdx]).slots}
                            dayLabel={`Day ${shareDayIdx + 1} of ${plans.length}`}
                        />
                    )}
                    attributionURL={tripShareLink(planIdRef.current)}
                />
            )}
        </SafeAreaView>
    );
}

// ─── StatusBadge ────────────────────────────────────────────────────────────────

const StatusBadge = ({
    status,
    startDate,
    colors,
    st,
}: {
    status: 'pending' | 'planned' | 'completed';
    startDate: string | null;
    colors: ColorTokens;
    st: ReturnType<typeof makeStyles>;
}) => {
    const label =
        status === 'completed'
            ? 'Completed'
            : status === 'pending'
              ? startDate
                  ? `In ${Math.max(0, daysUntil(startDate))}d`
                  : 'Pending'
              : 'Planned';
    return (
        <GlassCard glassStyle='clear' style={st.badge}>
            <Text style={[st.badgeText, { color: colors.textSecondary }]}>{label}</Text>
        </GlassCard>
    );
};

// ─── Styles ───────────────────────────────────────────────────────────────────

function makeStyles(colors: ReturnType<typeof useTheme>['colors']) {
    return StyleSheet.create({
        root: { flex: 1, backgroundColor: colors.bgDefault },
        header: {
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.sm,
            gap: spacing.sm,
        },
        backBtn: { padding: 4 },
        backArrow: { fontSize: 28, lineHeight: 32 },
        title: { fontFamily: fonts.display, fontSize: fontSizes.xl, color: colors.textPrimary },
        scroll: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xl },
        inputSection: { gap: spacing.xs },
        label: {
            fontFamily: fonts.bodySemiBold,
            fontSize: fontSizes.sm,
            color: colors.textSecondary,
        },
        textInput: {
            fontFamily: fonts.body,
            fontSize: fontSizes.base,
            borderWidth: 1,
            borderRadius: radius.sm,
            paddingHorizontal: spacing.sm,
            paddingVertical: 12,
        },
        dateSummary: { fontFamily: fonts.body, fontSize: fontSizes.xs, marginTop: 4 },
        planBtn: {
            borderRadius: radius.sm,
            paddingVertical: 14,
            alignItems: 'center',
            justifyContent: 'center',
        },
        planBtnDisabled: { opacity: 0.5 },
        planBtnText: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.base },
        infoNote: { borderRadius: radius.sm, overflow: 'hidden' },
        infoInner: { padding: spacing.sm },
        infoText: { fontFamily: fonts.body, fontSize: fontSizes.sm },
        summaryRow: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: spacing.sm,
        },
        summaryText: { fontFamily: fonts.bodyMedium, fontSize: fontSizes.sm, flex: 1 },
        badge: { borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4 },
        badgeText: {
            fontFamily: fonts.bodySemiBold,
            fontSize: fontSizes.xs,
            textTransform: 'uppercase',
            letterSpacing: 0.5,
        },
        refreshCard: { padding: spacing.sm, borderRadius: radius.sm },
        refreshText: { fontFamily: fonts.bodyMedium, fontSize: fontSizes.sm },
        pendingCard: {
            padding: spacing.lg,
            borderRadius: radius.md,
            alignItems: 'center',
            gap: 6,
        },
        pendingEmoji: { fontSize: 40, lineHeight: 46 },
        pendingTitle: { fontFamily: fonts.display, fontSize: fontSizes.lg },
        pendingSub: { fontFamily: fonts.body, fontSize: fontSizes.sm, textAlign: 'center' },
        errorInner: { padding: spacing.sm, backgroundColor: 'rgba(239,68,68,0.12)' },
        errorText: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: '#f87171' },
        sectionHeader: {
            fontFamily: fonts.bodySemiBold,
            fontSize: fontSizes.md,
            color: colors.textPrimary,
            marginTop: spacing.xs,
        },
        sectionSub: { fontFamily: fonts.body, fontSize: fontSizes.xs },
        sectionHeaderRow: {
            flexDirection: 'row',
            alignItems: 'flex-end',
            justifyContent: 'space-between',
            marginTop: spacing.xs,
        },
        dotsRow: { alignItems: 'center', marginTop: 6 },
        dotsPill: {
            flexDirection: 'row',
            gap: 6,
            paddingHorizontal: 12,
            paddingVertical: 6,
            borderRadius: radius.pill,
        },
        dot: { width: 7, height: 7, borderRadius: 4 },
        dotActive: { width: 18, height: 7, borderRadius: 4 },
        packCard: {
            borderRadius: radius.md,
            paddingHorizontal: spacing.sm,
            paddingBottom: spacing.xs,
        },
        shareBtn: { borderRadius: radius.pill, overflow: 'hidden' },
        shareBtnInner: { paddingHorizontal: 12, paddingVertical: 5 },
        shareBtnText: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.xs },
        deleteBtn: { alignItems: 'center', paddingVertical: spacing.md, marginTop: spacing.sm },
        deleteText: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.sm, color: '#f87171' },
    });
}
