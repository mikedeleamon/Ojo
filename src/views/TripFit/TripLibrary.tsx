import { useEffect, useMemo, useState } from 'react';
import {
    ScrollView,
    Pressable,
    StyleSheet,
    Alert,
    View as RNView,
    ActivityIndicator,
    Animated,
} from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { View, Text, GlassCard } from '../../components/primitives';
import SuitcaseIcon from '../../components/icons/SuitcaseIcon';
import { useTheme, ForceDarkPalette } from '../../theme/ThemeContext';
import { fonts, fontSizes, radius, spacing, darkColors } from '../../theme/tokens';
import { gradientFor } from '../../components/WeatherHUD/weatherPalette';
import api from '../../api/client';
import { authHeaders } from '../../lib/auth';
import type { SavedTripFitPlan } from '../../types';
import type { PlannerPrefill } from './TripPlanner';
import {
    phraseEmoji,
    fmtShortISO,
    daysUntil,
    tripFitStatus,
    planArticleIds,
} from './shared';

// ─── Airline-trip cross-link ────────────────────────────────────────────────────
// The /api/trips collection holds Gmail-imported / manual flight confirmations.
// We surface ones the user hasn't planned outfits for yet as quick-start chips.
interface AirlineTrip {
    _id: string;
    destinationCity?: string;
    departureDate: string;
    returnDate?: string;
}

const isoDay = (d: string): string => new Date(d).toISOString().slice(0, 10);

function airlineTripCovered(trip: AirlineTrip, plans: SavedTripFitPlan[]): boolean {
    const city = (trip.destinationCity ?? '').trim().toLowerCase();
    const dep = isoDay(trip.departureDate);
    return plans.some(
        (p) =>
            p.sourceAirlineTripId === trip._id ||
            (!!city &&
                p.destination.toLowerCase().includes(city) &&
                Math.abs(daysUntil(p.startDate) - daysUntil(dep)) <= 2),
    );
}

// ─── Props ──────────────────────────────────────────────────────────────────────

interface TripLibraryProps {
    plans: SavedTripFitPlan[];
    loading: boolean;
    onNew: () => void;
    onOpen: (plan: SavedTripFitPlan) => void;
    onDelete: (id: string) => void;
    onPlanFromAirline: (prefill: PlannerPrefill) => void;
    onBackToCloset: () => void;
}

// ─── TripCard ────────────────────────────────────────────────────────────────────

// The trip tile is a vibrant weather-gradient card designed for the dark
// palette (light text on a dark glass material). It renders identically in
// light and dark mode: ForceDarkPalette flips the nested glass to dark, and
// darkColors keeps the text light for contrast against the gradient.
const TripCard = ({
    plan,
    onOpen,
    onDelete,
    st,
}: {
    plan: SavedTripFitPlan;
    onOpen: () => void;
    onDelete: () => void;
    st: ReturnType<typeof makeStyles>;
}) => {
    const status = tripFitStatus(plan);

    const { minTemp, maxTemp, dominantPhrase } = useMemo(() => {
        if (!plan.days.length)
            return { minTemp: null, maxTemp: null, dominantPhrase: 'Cloudy' };
        const mins = plan.days.map((d) => d.minTempF);
        const maxs = plan.days.map((d) => d.maxTempF);
        const counts: Record<string, number> = {};
        for (const d of plan.days)
            counts[d.dayPhrase] = (counts[d.dayPhrase] ?? 0) + 1;
        const dominant =
            Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'Cloudy';
        return {
            minTemp: Math.round(Math.min(...mins)),
            maxTemp: Math.round(Math.max(...maxs)),
            dominantPhrase: dominant,
        };
    }, [plan.days]);

    const totalItems = planArticleIds(plan).length;
    const packed = plan.checkedIds.length;
    const grad = gradientFor(dominantPhrase, true) as [string, string, ...string[]];

    const badgeLabel =
        status === 'completed'
            ? 'Completed'
            : status === 'pending'
              ? `In ${Math.max(0, daysUntil(plan.startDate))}d`
              : 'Planned';

    const renderRightActions = (
        _progress: ReturnType<Animated.Value['interpolate']>,
        dragX: ReturnType<Animated.Value['interpolate']>,
        swipeable: Swipeable,
    ) => {
        const translateX = dragX.interpolate({
            inputRange: [-110, 0],
            outputRange: [0, 110],
            extrapolate: 'clamp',
        });
        return (
            <Animated.View style={[st.deleteActionWrap, { transform: [{ translateX }] }]}>
                <Pressable
                    style={st.deleteAction}
                    onPress={() => {
                        swipeable.close();
                        onDelete();
                    }}
                    accessibilityRole='button'
                    accessibilityLabel='Delete trip'
                >
                    <Text style={st.deleteText}>Delete trip</Text>
                </Pressable>
            </Animated.View>
        );
    };

    return (
        <Swipeable
            renderRightActions={renderRightActions}
            rightThreshold={55}
            overshootRight={false}
        >
            <ForceDarkPalette>
                <Pressable
                    onPress={onOpen}
                    accessibilityRole='button'
                    accessibilityLabel={`Open trip to ${plan.destination}`}
                    style={[status === 'completed' && st.cardCompleted]}
                >
                    <RNView style={st.cardWrap}>
                        <LinearGradient
                            colors={grad}
                            style={StyleSheet.absoluteFill}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                        />
                        <GlassCard glassStyle='regular' style={st.card}>
                            <RNView style={st.cardTopRow}>
                                <Text style={st.cardEmoji}>{phraseEmoji(dominantPhrase)}</Text>
                                <GlassCard glassStyle='clear' style={st.badge}>
                                    <Text style={[st.badgeText, { color: darkColors.textSecondary }]}>
                                        {badgeLabel}
                                    </Text>
                                </GlassCard>
                            </RNView>

                            <Text style={[st.cardTitle, { color: darkColors.textPrimary }]} numberOfLines={1}>
                                {plan.name || plan.destination}
                            </Text>
                            {!!plan.name && (
                                <Text style={[st.cardSub, { color: darkColors.textSecondary }]} numberOfLines={1}>
                                    {plan.destination}
                                </Text>
                            )}

                            <Text style={[st.cardDates, { color: darkColors.textSecondary }]}>
                                {fmtShortISO(plan.startDate)} – {fmtShortISO(plan.endDate)}
                                {minTemp !== null ? ` · ${minTemp}°–${maxTemp}°F` : ''}
                            </Text>

                            {status === 'pending' ? (
                                <Text style={[st.cardMeta, { color: darkColors.textMuted }]}>
                                    Outfits unlock when within 10 days
                                </Text>
                            ) : (
                                <Text style={[st.cardMeta, { color: darkColors.textMuted }]}>
                                    {totalItems > 0
                                        ? `${packed}/${totalItems} packed`
                                        : 'No items yet'}
                                </Text>
                            )}
                        </GlassCard>
                    </RNView>
                </Pressable>
            </ForceDarkPalette>
        </Swipeable>
    );
};

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function TripLibrary({
    plans,
    loading,
    onNew,
    onOpen,
    onDelete,
    onPlanFromAirline,
    onBackToCloset,
}: TripLibraryProps) {
    const { colors } = useTheme();
    const st = useMemo(() => makeStyles(colors), [colors]);

    const [airlineTrips, setAirlineTrips] = useState<AirlineTrip[]>([]);

    useEffect(() => {
        let cancelled = false;
        api
            .get<AirlineTrip[]>('/api/trips', authHeaders())
            .then(({ data }) => {
                if (!cancelled) setAirlineTrips(data ?? []);
            })
            .catch(() => {});
        return () => {
            cancelled = true;
        };
    }, []);

    // Section the saved plans by derived status.
    const { upcoming, completed } = useMemo(() => {
        const up: SavedTripFitPlan[] = [];
        const done: SavedTripFitPlan[] = [];
        for (const p of plans) {
            if (tripFitStatus(p) === 'completed') done.push(p);
            else up.push(p);
        }
        up.sort((a, b) => a.startDate.localeCompare(b.startDate));
        done.sort((a, b) => b.endDate.localeCompare(a.endDate));
        return { upcoming: up, completed: done };
    }, [plans]);

    // Items that do double duty across 2+ upcoming, fully-planned trips.
    const overlap = useMemo(() => {
        const planned = upcoming.filter((p) => tripFitStatus(p) === 'planned');
        if (planned.length < 2) return null;
        const byArticle = new Map<string, Set<string>>();
        for (const p of planned)
            for (const id of planArticleIds(p)) {
                (byArticle.get(id) ?? byArticle.set(id, new Set()).get(id)!).add(p.id);
            }
        const sharedPlanIds = new Set<string>();
        let sharedCount = 0;
        for (const [, planSet] of byArticle)
            if (planSet.size >= 2) {
                sharedCount++;
                planSet.forEach((id) => sharedPlanIds.add(id));
            }
        if (sharedCount === 0) return null;
        const names = planned
            .filter((p) => sharedPlanIds.has(p.id))
            .map((p) => p.name || p.destination);
        return { count: sharedCount, names };
    }, [upcoming]);

    // Airline trips without a matching TripFit plan yet.
    const suggestions = useMemo(
        () =>
            airlineTrips
                .filter((t) => t.destinationCity && !airlineTripCovered(t, plans))
                .slice(0, 5),
        [airlineTrips, plans],
    );

    return (
        <SafeAreaView style={st.root} edges={['top', 'bottom']}>
            <View style={st.header}>
                <Pressable
                    onPress={onBackToCloset}
                    style={st.backBtn}
                    accessibilityLabel='Go back to closet'
                    accessibilityRole='button'
                >
                    <Text style={[st.backArrow, { color: colors.textPrimary }]}>‹</Text>
                </Pressable>
                <Text style={st.title}>TripFit</Text>
            </View>

            <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={st.scroll}
                showsVerticalScrollIndicator={false}
            >
                {/* Plan new trip CTA */}
                <Pressable
                    onPress={onNew}
                    style={[st.newBtn, { backgroundColor: colors.saveBtnBg }]}
                    accessibilityRole='button'
                    accessibilityLabel='Plan a new trip'
                >
                    <Text style={[st.newBtnText, { color: colors.saveBtnText }]}>
                        ＋ Plan a new trip
                    </Text>
                </Pressable>

                {/* Airline suggestions */}
                {suggestions.length > 0 && (
                    <RNView style={{ gap: spacing.xs }}>
                        <Text style={st.sectionHeader}>From your flights ✈️</Text>
                        {suggestions.map((t) => (
                            <Pressable
                                key={t._id}
                                onPress={() =>
                                    onPlanFromAirline({
                                        destination: t.destinationCity,
                                        startDate: new Date(t.departureDate),
                                        endDate: t.returnDate
                                            ? new Date(t.returnDate)
                                            : new Date(t.departureDate),
                                        sourceAirlineTripId: t._id,
                                    })
                                }
                                accessibilityRole='button'
                            >
                                <GlassCard glassStyle='clear' style={st.suggestionCard}>
                                    <Text style={[st.suggestionText, { color: colors.textPrimary }]}>
                                        ✈️ {t.destinationCity} · {fmtShortISO(isoDay(t.departureDate))}
                                    </Text>
                                    <Text style={[st.suggestionCta, { color: colors.textSecondary }]}>
                                        Plan outfits →
                                    </Text>
                                </GlassCard>
                            </Pressable>
                        ))}
                    </RNView>
                )}

                {/* Multi-trip overlap insight */}
                {overlap && (
                    <GlassCard glassStyle='clear' style={st.overlapCard}>
                        <RNView style={st.overlapTitleRow}>
                            <SuitcaseIcon size={14} color={colors.textPrimary} />
                            <Text style={[st.overlapTitle, { color: colors.textPrimary }]}>
                                {overlap.count} piece{overlap.count === 1 ? '' : 's'} do double duty
                            </Text>
                        </RNView>
                        <Text style={[st.overlapSub, { color: colors.textMuted }]}>
                            Shared across {overlap.names.slice(0, 3).join(', ')}
                            {overlap.names.length > 3 ? ' and more' : ''}. Pack versatile favorites
                            once.
                        </Text>
                    </GlassCard>
                )}

                {/* Loading */}
                {loading && plans.length === 0 && (
                    <RNView style={st.centerBox}>
                        <ActivityIndicator color={colors.textPrimary} />
                    </RNView>
                )}

                {/* Empty state */}
                {!loading && plans.length === 0 && (
                    <GlassCard glassStyle='regular' style={st.emptyCard}>
                        <Text style={st.emptyEmoji}>🌍</Text>
                        <Text style={[st.emptyTitle, { color: colors.textPrimary }]}>
                            No trips yet
                        </Text>
                        <Text style={[st.emptySub, { color: colors.textMuted }]}>
                            Plan a trip and Ojo builds a day-by-day outfit plan and packing list
                            from your closet.
                        </Text>
                    </GlassCard>
                )}

                {/* Upcoming */}
                {upcoming.length > 0 && (
                    <RNView style={{ gap: spacing.sm }}>
                        <Text style={st.sectionHeader}>Upcoming</Text>
                        {upcoming.map((p) => (
                            <TripCard
                                key={p.id}
                                plan={p}
                                st={st}
                                onOpen={() => onOpen(p)}
                                onDelete={() => confirmDelete(p, onDelete)}
                            />
                        ))}
                    </RNView>
                )}

                {/* Completed */}
                {completed.length > 0 && (
                    <RNView style={{ gap: spacing.sm }}>
                        <Text style={st.sectionHeader}>Past trips</Text>
                        {completed.map((p) => (
                            <TripCard
                                key={p.id}
                                plan={p}
                                st={st}
                                onOpen={() => onOpen(p)}
                                onDelete={() => confirmDelete(p, onDelete)}
                            />
                        ))}
                    </RNView>
                )}
            </ScrollView>
        </SafeAreaView>
    );
}

function confirmDelete(plan: SavedTripFitPlan, onDelete: (id: string) => void) {
    Alert.alert(
        'Delete trip',
        `Remove "${plan.name || plan.destination}" and its packing list?`,
        [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Delete', style: 'destructive', onPress: () => onDelete(plan.id) },
        ],
    );
}

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
        newBtn: {
            borderRadius: radius.sm,
            paddingVertical: 14,
            alignItems: 'center',
            justifyContent: 'center',
        },
        newBtnText: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.base },
        sectionHeader: {
            fontFamily: fonts.bodySemiBold,
            fontSize: fontSizes.md,
            color: colors.textPrimary,
            marginTop: spacing.xs,
        },
        suggestionCard: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: spacing.sm,
            borderRadius: radius.sm,
        },
        suggestionText: { fontFamily: fonts.bodyMedium, fontSize: fontSizes.sm, flex: 1 },
        suggestionCta: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.xs },
        overlapCard: { padding: spacing.md, borderRadius: radius.md, gap: 4 },
        overlapTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
        overlapTitle: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.sm },
        overlapSub: { fontFamily: fonts.body, fontSize: fontSizes.xs },
        cardWrap: { borderRadius: radius.lg, overflow: 'hidden' },
        cardCompleted: { opacity: 0.6 },
        card: { padding: spacing.md, gap: 4, minHeight: 130 },
        cardTopRow: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
        },
        cardEmoji: { fontSize: 30, lineHeight: 36 },
        badge: { borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4 },
        badgeText: {
            fontFamily: fonts.bodySemiBold,
            fontSize: fontSizes.xs,
            textTransform: 'uppercase',
            letterSpacing: 0.5,
        },
        cardTitle: { fontFamily: fonts.display, fontSize: fontSizes.xl, marginTop: 2 },
        cardSub: { fontFamily: fonts.body, fontSize: fontSizes.xs },
        cardDates: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.sm },
        cardMeta: { fontFamily: fonts.body, fontSize: fontSizes.xs },
        deleteActionWrap: {
            width: 110,
            alignSelf: 'stretch',
        },
        deleteAction: {
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
            backgroundColor: '#FF3B30',
            borderRadius: radius.lg,
        },
        deleteText: {
            fontFamily: fonts.bodySemiBold,
            fontSize: fontSizes.sm,
            color: '#ffffff',
        },
        centerBox: { paddingVertical: spacing.xl, alignItems: 'center' },
        emptyCard: { padding: spacing.lg, borderRadius: radius.md, alignItems: 'center', gap: 6 },
        emptyEmoji: { fontSize: 44, lineHeight: 50 },
        emptyTitle: { fontFamily: fonts.display, fontSize: fontSizes.lg },
        emptySub: { fontFamily: fonts.body, fontSize: fontSizes.sm, textAlign: 'center' },
    });
}
