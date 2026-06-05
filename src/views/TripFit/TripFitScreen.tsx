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
import { HangerIcon } from '../../components/shared';
import { useTheme } from '../../theme/ThemeContext';
import {
    fonts,
    fontSizes,
    fontWeights,
    radius,
    spacing,
} from '../../theme/tokens';
import type { ColorTokens } from '../../theme/tokens';
import { useClosets } from '../../hooks/useClosets';
import { useRouter } from 'expo-router';
import { useReduceMotion } from '../../hooks/useReduceMotion';
import { generateOutfits } from '../../lib/outfitEngine';
import type { OutfitResult } from '../../lib/outfitEngine';
import { recordGapsFromNotes } from '../../lib/wardrobeGaps';
import { scheduleTripPackingReminder } from '../../lib/notifications';
import { useSettings } from '../../context/SettingsContext';
import { gradientFor } from '../../components/WeatherHUD/weatherPalette';
import api from '../../api/client';
import { authHeaders } from '../../lib/auth';
import { geocodeCity } from '../../lib/geocoding';
import TripCalendar from './TripCalendar';
import type {
    DailyForecast,
    CurrentWeather,
    ClothingArticle,
    OutfitOccasion,
} from '../../types';

// ─── Types ────────────────────────────────────────────────────────────────────

interface DayPlan {
    day: DailyForecast;
    candidates: OutfitResult[];
    candidateIdx: number;
}

const activeOutfit = (p: DayPlan): OutfitResult =>
    p.candidates[p.candidateIdx] ?? p.candidates[0];

// ─── Constants ────────────────────────────────────────────────────────────────

const OCCASION_CHIPS: { value: OutfitOccasion; label: string }[] = [
    { value: 'everyday', label: 'Everyday' },
    { value: 'work', label: 'Work' },
    { value: 'weekend', label: 'Weekend' },
    { value: 'date', label: 'Date' },
    { value: 'outdoor', label: 'Outdoor' },
    { value: 'athletic', label: 'Athletic' },
];

const PACKING_GROUPS: { key: string; label: string; emoji: string }[] = [
    { key: 'top', label: 'Tops', emoji: '👕' },
    { key: 'bottom', label: 'Bottoms', emoji: '👖' },
    { key: 'outerwear', label: 'Outerwear', emoji: '🧥' },
    { key: 'footwear', label: 'Footwear', emoji: '👟' },
    { key: 'accessory', label: 'Accessories', emoji: '👜' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildTripWeather(day: DailyForecast): CurrentWeather {
    const midF = (day.minTempF + day.maxTempF) / 2;
    return {
        WeatherText: day.dayPhrase,
        HasPrecipitation: day.hasPrecipitation,
        PrecipitationType: day.hasPrecipitation ? 'Rain' : null,
        IsDayTime: true,
        Temperature: {
            Imperial: { Value: midF, Unit: 'F' },
            Metric: { Value: (midF - 32) * (5 / 9), Unit: 'C' },
        },
        RealFeelTemperature: {
            Imperial: { Value: midF, Unit: 'F' },
            Metric: { Value: (midF - 32) * (5 / 9), Unit: 'C' },
        },
        Wind: { Speed: { Imperial: { Value: 5 }, Metric: { Value: 8 } } },
        RelativeHumidity: 60,
        UVIndexText: 'Moderate',
    };
}

function fmtDate(iso: string): string {
    return new Date(iso + 'T12:00:00').toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
    });
}

function fmtShortDate(d: Date): string {
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function phraseEmoji(phrase: string): string {
    const p = phrase.toLowerCase();
    if (p.includes('snow')) return '❄️';
    if (p.includes('rain') || p.includes('shower')) return '🌧️';
    if (p.includes('thunder')) return '⛈️';
    if (p.includes('cloud') || p.includes('overcast')) return '☁️';
    if (p.includes('sun') || p.includes('clear') || p.includes('fair'))
        return '☀️';
    if (p.includes('wind')) return '💨';
    return '🌤️';
}

function categoryKey(a: ClothingArticle): string {
    if (a.isAccessory) return 'accessory';
    const cat = (
        a.clothingCategory ??
        a.topOrBottom ??
        a.clothingType ??
        ''
    ).toLowerCase();
    if (
        cat.includes('outer') ||
        cat.includes('jacket') ||
        cat.includes('coat') ||
        cat.includes('layer')
    )
        return 'outerwear';
    if (
        cat.includes('shoe') ||
        cat.includes('boot') ||
        cat.includes('foot') ||
        cat.includes('sandal')
    )
        return 'footwear';
    if (
        cat.includes('bottom') ||
        cat.includes('pant') ||
        cat.includes('skirt') ||
        cat.includes('short')
    )
        return 'bottom';
    return 'top';
}

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
                <HangerIcon
                    size={size * 0.4}
                    color={colors.textMuted}
                    decorative
                />
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
}: {
    plan: DayPlan;
    colors: ColorTokens;
    cardWidth: number;
    animValue: Animated.Value;
    isReplanning: boolean;
    onReplan: () => void;
}) => {
    const outfit = activeOutfit(plan);
    const articles = outfit.slots.map(
        (s: { article: ClothingArticle }) => s.article,
    );
    const thumbSize = Math.floor(
        (cardWidth - spacing.md * 2 - spacing.xs * 3) / 4,
    );

    // translateY only — no opacity on the Animated.View wrapper.
    // GlassView (inside GlassCard) must be mounted at full opacity so iOS can
    // sample the background immediately and initialize native blur. Mounting
    // inside opacity:0 prevents that initialization. (See WeatherHUD.tsx comment.)
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
                <GlassCard
                    style={dayCardSt.card}
                    glassStyle='regular'
                >
                    {/* Date + weather */}
                    <Text
                        style={[
                            dayCardSt.dateLabel,
                            { color: colors.textSecondary },
                        ]}
                    >
                        {phraseEmoji(plan.day.dayPhrase)}{' '}
                        {fmtDate(plan.day.date)}
                    </Text>
                    <Text
                        style={[dayCardSt.tempRow, { color: colors.textMuted }]}
                    >
                        {Math.round(plan.day.minTempF)}° –{' '}
                        {Math.round(plan.day.maxTempF)}°F · {plan.day.dayPhrase}
                    </Text>

                    {/* Photo grid */}
                    <RNView style={dayCardSt.thumbGrid}>
                        {articles
                            .slice(0, 4)
                            .map((a: ClothingArticle, i: number) => (
                                <ThumbImage
                                    key={a._id ?? i}
                                    article={a}
                                    size={thumbSize}
                                    colors={colors}
                                />
                            ))}
                    </RNView>

                    {/* Outfit note */}
                    {outfit.notes.length > 0 && (
                        <Text
                            style={[
                                dayCardSt.note,
                                { color: colors.textMuted },
                            ]}
                            numberOfLines={2}
                        >
                            {outfit.notes[0]}
                        </Text>
                    )}

                    {/* Replan button */}
                    <GlassCard
                        glassStyle='clear'
                        style={dayCardSt.replanBtn}
                    >
                        <Pressable
                            onPress={onReplan}
                            disabled={isReplanning}
                            style={dayCardSt.replanInner}
                            accessibilityRole='button'
                            accessibilityLabel='Replan this day'
                            hitSlop={8}
                        >
                            {isReplanning ? (
                                <ActivityIndicator
                                    size='small'
                                    color={colors.textPrimary}
                                />
                            ) : (
                                <Text
                                    style={[
                                        dayCardSt.replanIcon,
                                        { color: colors.textSecondary },
                                    ]}
                                >
                                    ↺
                                </Text>
                            )}
                        </Pressable>
                    </GlassCard>
                </GlassCard>
        </Animated.View>
    );
};

const dayCardSt = StyleSheet.create({
    card: {
        padding: spacing.md,
        gap: 8,
        minHeight: 200,
        borderRadius: radius.lg,
    },
    dateLabel: {
        fontFamily: fonts.bodySemiBold,
        fontSize: fontSizes.sm,
    },
    tempRow: {
        fontFamily: fonts.body,
        fontSize: fontSizes.xs,
    },
    thumbGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing.xs,
    },
    note: {
        fontFamily: fonts.body,
        fontSize: fontSizes.xs,
        fontStyle: 'italic',
    },
    replanBtn: {
        position: 'absolute',
        top: spacing.xs,
        right: spacing.xs,
        borderRadius: radius.pill,
        overflow: 'hidden',
    },
    replanInner: {
        width: 30,
        height: 30,
        alignItems: 'center',
        justifyContent: 'center',
    },
    replanIcon: {
        fontSize: 18,
        lineHeight: 22,
    },
});

// ─── SkeletonCard ─────────────────────────────────────────────────────────────

const SkeletonCard = ({ cardWidth }: { cardWidth: number }) => {
    const shimmer = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        const loop = Animated.loop(
            Animated.sequence([
                Animated.timing(shimmer, {
                    toValue: 1,
                    duration: 700,
                    useNativeDriver: true,
                }),
                Animated.timing(shimmer, {
                    toValue: 0,
                    duration: 700,
                    useNativeDriver: true,
                }),
            ]),
        );
        loop.start();
        return () => loop.stop();
    }, [shimmer]);

    // The outer GlassCard is always at full opacity so GlassView can initialise
    // its native blur immediately. The shimmer animation runs only on the inner
    // placeholder content — never on the GlassCard wrapper itself.
    const shimmerOpacity = shimmer.interpolate({
        inputRange: [0, 1],
        outputRange: [0.35, 0.85],
    });

    return (
        <RNView style={{ width: cardWidth, paddingHorizontal: spacing.xs }}>
            <GlassCard
                glassStyle='regular'
                style={skSt.card}
            >
                <Animated.View style={{ opacity: shimmerOpacity, gap: 10 }}>
                    <GlassCard
                        glassStyle='clear'
                        style={[skSt.line, { width: '45%' }]}
                    />
                    <GlassCard
                        glassStyle='clear'
                        style={[skSt.line, { width: '70%' }]}
                    />
                    <RNView style={skSt.thumbRow}>
                        {[0, 1, 2, 3].map((i) => (
                            <GlassCard
                                key={i}
                                glassStyle='clear'
                                style={skSt.thumbBox}
                            />
                        ))}
                    </RNView>
                    <GlassCard
                        glassStyle='clear'
                        style={[skSt.line, { width: '85%' }]}
                    />
                </Animated.View>
            </GlassCard>
        </RNView>
    );
};

const skSt = StyleSheet.create({
    card: {
        padding: spacing.md,
        gap: 10,
        minHeight: 200,
        borderRadius: radius.lg,
    },
    line: {
        height: 11,
        borderRadius: 6,
    },
    thumbRow: {
        flexDirection: 'row',
        gap: spacing.xs,
    },
    thumbBox: {
        width: 52,
        height: 52,
        borderRadius: radius.sm - 2,
    },
});

// ─── HeroBanner ───────────────────────────────────────────────────────────────

const HeroBanner = ({
    plans,
    destination,
    colors,
}: {
    plans: DayPlan[];
    destination: string;
    colors: ColorTokens;
}) => {
    const allMin = plans.map((p) => p.day.minTempF);
    const allMax = plans.map((p) => p.day.maxTempF);
    const minTemp = Math.round(Math.min(...allMin));
    const maxTemp = Math.round(Math.max(...allMax));

    const startStr = fmtShortDate(new Date(plans[0].day.date + 'T12:00:00'));
    const endStr = fmtShortDate(
        new Date(plans[plans.length - 1].day.date + 'T12:00:00'),
    );

    const phraseCounts: Record<string, number> = {};
    for (const p of plans)
        phraseCounts[p.day.dayPhrase] =
            (phraseCounts[p.day.dayPhrase] ?? 0) + 1;
    const dominantPhrase = Object.entries(phraseCounts).sort(
        (a, b) => b[1] - a[1],
    )[0][0];

    const gradColors = gradientFor(dominantPhrase, true) as string[];

    return (
        <RNView style={{ borderRadius: radius.lg, overflow: 'hidden' }}>
            <LinearGradient
                colors={gradColors as [string, string, ...string[]]}
                style={StyleSheet.absoluteFill}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
            />
            <GlassCard
                glassStyle='regular'
                style={heroBannerSt.card}
            >
                <Text style={heroBannerSt.emoji}>
                    {phraseEmoji(dominantPhrase)}
                </Text>
                <Text
                    style={[
                        heroBannerSt.destination,
                        { color: colors.textPrimary },
                    ]}
                >
                    {destination}
                </Text>
                <Text
                    style={[
                        heroBannerSt.dateRange,
                        { color: colors.textSecondary },
                    ]}
                >
                    {startStr} – {endStr}
                </Text>
                <Text
                    style={[
                        heroBannerSt.tempRange,
                        { color: colors.textPrimary },
                    ]}
                >
                    {minTemp}° – {maxTemp}°F
                </Text>
            </GlassCard>
        </RNView>
    );
};

const heroBannerSt = StyleSheet.create({
    card: {
        padding: spacing.md,
        gap: 4,
    },
    emoji: {
        fontSize: 36,
        lineHeight: 42,
    },
    destination: {
        fontFamily: fonts.display,
        fontSize: fontSizes.xxl,
        marginTop: 2,
    },
    dateRange: {
        fontFamily: fonts.body,
        fontSize: fontSizes.sm,
    },
    tempRange: {
        fontFamily: fonts.bodySemiBold,
        fontSize: fontSizes.md,
    },
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
                {
                    borderColor: isChecked
                        ? colors.saveBtnBg
                        : colors.glassBorder,
                },
            ]}
        >
            {isChecked && (
                <Text style={[packSt.checkMark, { color: colors.saveBtnBg }]}>
                    ✓
                </Text>
            )}
        </GlassCard>
        <RNView style={{ flex: 1, gap: 2 }}>
            <Text
                style={[
                    packSt.name,
                    {
                        color: isChecked
                            ? colors.textMuted
                            : colors.textPrimary,
                    },
                    isChecked && packSt.checkedName,
                ]}
            >
                {article.name || article.clothingType}
            </Text>
            <Text style={[packSt.meta, { color: colors.textMuted }]}>
                {[article.clothingType, article.color]
                    .filter(Boolean)
                    .join(' · ')}
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
    checkMark: {
        fontSize: 13,
        fontFamily: fonts.bodySemiBold,
        lineHeight: 16,
    },
    name: {
        fontFamily: fonts.bodyMedium,
        fontSize: fontSizes.sm,
    },
    checkedName: {
        textDecorationLine: 'line-through',
    },
    meta: {
        fontFamily: fonts.body,
        fontSize: fontSizes.xs,
    },
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
    const grouped = useMemo(() => {
        const map: Record<string, ClothingArticle[]> = {};
        for (const a of packingList) {
            const k = categoryKey(a);
            (map[k] ??= []).push(a);
        }
        return map;
    }, [packingList]);

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
                        <Text
                            style={[
                                groupSt.sectionHeader,
                                { color: colors.textMuted },
                            ]}
                        >
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

// ─── OccasionChips ────────────────────────────────────────────────────────────

const OccasionChips = ({
    active,
    onChange,
    colors,
}: {
    active: OutfitOccasion;
    onChange: (o: OutfitOccasion) => void;
    colors: ColorTokens;
}) => (
    <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{
            flexDirection: 'row',
            gap: 8,
            paddingVertical: 2,
        }}
    >
        {OCCASION_CHIPS.map(({ value, label }) => (
            <GlassCard
                key={value}
                glassStyle={active === value ? 'regular' : 'clear'}
                style={[
                    chipSt.chip,
                    {
                        borderColor:
                            active === value
                                ? colors.saveBtnBg
                                : colors.glassBorder,
                    },
                ]}
            >
                <Pressable
                    onPress={() => onChange(value)}
                    hitSlop={4}
                    style={chipSt.chipInner}
                    accessibilityRole='radio'
                    accessibilityState={{ checked: active === value }}
                >
                    <Text
                        style={[
                            chipSt.chipText,
                            {
                                color:
                                    active === value
                                        ? colors.saveBtnText
                                        : colors.textSecondary,
                            },
                            active === value && chipSt.chipTextActive,
                        ]}
                    >
                        {label}
                    </Text>
                </Pressable>
            </GlassCard>
        ))}
    </ScrollView>
);

const chipSt = StyleSheet.create({
    chip: {
        borderRadius: radius.pill,
        borderWidth: 1,
        overflow: 'hidden',
    },
    chipInner: {
        paddingVertical: 5,
        paddingHorizontal: 12,
    },
    chipText: {
        fontFamily: fonts.body,
        fontSize: fontSizes.xs,
        fontWeight: fontWeights.medium,
    },
    chipTextActive: {
        fontWeight: fontWeights.semibold,
    },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function TripFitScreen() {
    const { colors } = useTheme();
    const router = useRouter();
    const { closets } = useClosets();
    const { settings } = useSettings();
    const reduceMotion = useReduceMotion();
    const { width: windowWidth } = useWindowDimensions();

    const cardWidth = windowWidth - spacing.md * 4.1;

    // ── State ──
    const [destination, setDestination] = useState('');
    const [tripStart, setTripStart] = useState<Date | null>(null);
    const [tripEnd, setTripEnd] = useState<Date | null>(null);
    const [selectedOccasion, setSelectedOccasion] =
        useState<OutfitOccasion>('everyday');
    const [loading, setLoading] = useState(false);
    const [plans, setPlans] = useState<DayPlan[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [activeIdx, setActiveIdx] = useState(0);
    const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
    const [replanningIdx, setReplanningIdx] = useState<number | null>(null);

    const pagerRef = useRef<ScrollView>(null);
    const forecastDaysRef = useRef<DailyForecast[]>([]);
    const animValues = useRef<Animated.Value[]>([]).current;

    // ── Derived ──
    const { days, forecastStartDate } = useMemo(() => {
        if (!tripStart || !tripEnd) return { days: 0, forecastStartDate: null };
        const count =
            Math.round((tripEnd.getTime() - tripStart.getTime()) / 86400000) +
            1;
        return {
            days: count,
            forecastStartDate: tripStart.toISOString().slice(0, 10),
        };
    }, [tripStart, tripEnd]);

    const articles: ClothingArticle[] = useMemo(() => {
        if (!closets.length) return [];
        const preferred = closets.find((c) => c.isPreferred) ?? closets[0];
        return preferred.articles;
    }, [closets]);

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
            for (let i = 0; i < count; i++)
                animValues.push(new Animated.Value(0));

            if (reduceMotion) {
                animValues.forEach((v) => v.setValue(1));
            } else {
                Animated.stagger(
                    80,
                    animValues.map((v) =>
                        Animated.timing(v, {
                            toValue: 1,
                            duration: 320,
                            useNativeDriver: true,
                        }),
                    ),
                ).start();
            }
        },
        [animValues, reduceMotion],
    );

    // ── Plan trip ──
    const onPlan = useCallback(async () => {
        const query = destination.trim();
        if (!query) {
            Alert.alert(
                'Enter a destination',
                'Type a city name to plan your trip.',
            );
            return;
        }
        if (!tripStart || !tripEnd) {
            Alert.alert(
                'Select dates',
                'Pick a start and end date on the calendar.',
            );
            return;
        }

        setLoading(true);
        setError(null);
        setPlans([]);
        setActiveIdx(0);
        setCheckedIds(new Set());

        try {
            // Resolve destination → coordinates via on-device geocoder
            const coords = await geocodeCity(query);
            if (!coords) throw new Error(`City not found: "${query}"`);

            // WeatherKit always returns up to 10 days on the free tier — single call.
            const res = await api.get<DailyForecast[]>('/api/weather/daily', {
                params: { lat: coords.lat, lon: coords.lon },
                ...authHeaders(),
            });
            const allDays: DailyForecast[] = res.data ?? [];

            // Slice to selected date range
            const slicedDays = forecastStartDate
                ? allDays
                      .filter((d) => d.date >= forecastStartDate)
                      .slice(0, days)
                : allDays.slice(0, days);

            if (!slicedDays.length) {
                throw new Error(
                    'Selected dates are beyond the forecast window. Choose dates within the next 10 days.',
                );
            }

            forecastDaysRef.current = slicedDays;

            // Generate outfits — produce K candidates per day so the user can
            // refresh through alternatives. Accumulate worn article IDs across
            // days so each day's #1 pick is biased away from prior days.
            const effectiveSettings = {
                ...settings,
                occasion: selectedOccasion,
            };
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
                if (top) {
                    for (const slot of top.slots)
                        usedAcrossTrip.add(slot.article._id);
                }
                return { day, candidates: results, candidateIdx: 0 };
            });

            for (const p of newPlans) {
                const top = p.candidates[0];
                if (top?.notes.length)
                    recordGapsFromNotes(top.notes).catch(() => {});
            }

            setPlans(newPlans);
            runStagger(newPlans.length);

            if (tripStart) {
                scheduleTripPackingReminder(query, tripStart).catch(() => {});
            }
        } catch (err: any) {
            const msg: string =
                err?.response?.data?.error ??
                err?.message ??
                'Could not plan trip.';
            setError(msg);
        } finally {
            setLoading(false);
        }
    }, [
        destination,
        tripStart,
        tripEnd,
        days,
        forecastStartDate,
        articles,
        settings,
        selectedOccasion,
        runStagger,
    ]);

    // ── Replan single day ──
    const onReplanDay = useCallback(
        async (idx: number) => {
            const day = forecastDaysRef.current[idx];
            if (!day) return;
            setReplanningIdx(idx);
            try {
                setPlans((prev) => {
                    const next = [...prev];
                    const current = next[idx];
                    if (!current) return prev;

                    const nextIdx = current.candidateIdx + 1;
                    if (nextIdx < current.candidates.length) {
                        // Cycle to the next pre-generated candidate
                        next[idx] = { ...current, candidateIdx: nextIdx };
                        return next;
                    }

                    // Exhausted candidates — regenerate while penalising
                    // articles from the current outfit so we get fresh picks.
                    const excluded = new Set<string>();
                    const cur = current.candidates[current.candidateIdx];
                    if (cur) {
                        for (const slot of cur.slots)
                            excluded.add(slot.article._id);
                    }
                    const effectiveSettings = {
                        ...settings,
                        occasion: selectedOccasion,
                    };
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
                    return next;
                });
                if (!reduceMotion && animValues[idx]) {
                    animValues[idx].setValue(0);
                    Animated.timing(animValues[idx], {
                        toValue: 1,
                        duration: 320,
                        useNativeDriver: true,
                    }).start();
                }
            } finally {
                setReplanningIdx(null);
            }
        },
        [articles, settings, selectedOccasion, reduceMotion, animValues],
    );

    // ── Share packing list ──
    const handleSharePacking = useCallback(() => {
        if (!packingList.length) return;
        const lines: string[] = [
            `✈️ TripFit Packing List — ${destination}`,
            '',
        ];
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

    // ── Toggle packed item ──
    const toggleChecked = useCallback((id: string) => {
        setCheckedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    }, []);

    const st = useMemo(
        () => makeStyles(colors, cardWidth),
        [colors, cardWidth],
    );

    const calContainerWidth = windowWidth - spacing.md * 2;

    return (
        <SafeAreaView
            style={st.root}
            edges={['top', 'bottom']}
        >
            {/* Header */}
            <View style={st.header}>
                <Pressable
                    onPress={() => router.replace('/(tabs)/closet')}
                    style={st.backBtn}
                    accessibilityLabel='Go back to closet'
                    accessibilityRole='button'
                >
                    <Text style={[st.backArrow, { color: colors.textPrimary }]}>
                        ‹
                    </Text>
                </Pressable>
                <Text style={st.title}>TripFit</Text>
            </View>

            <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={st.scroll}
                keyboardShouldPersistTaps='handled'
            >
                {/* Destination */}
                <View style={st.inputSection}>
                    <Text style={st.label}>Destination</Text>
                    <TextInput
                        style={[
                            st.textInput,
                            {
                                color: colors.textPrimary,
                                borderColor: colors.glassBorder,
                                backgroundColor: colors.glassBg,
                            },
                        ]}
                        placeholder='e.g. New York, Tokyo, London'
                        placeholderTextColor={colors.textMuted}
                        value={destination}
                        onChangeText={setDestination}
                        returnKeyType='done'
                        onSubmitEditing={onPlan}
                        autoCapitalize='words'
                        autoCorrect={false}
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
                        maxDays={10}
                        containerWidth={calContainerWidth}
                    />
                    {days > 0 && tripStart && tripEnd && (
                        <Text
                            style={[
                                st.dateSummary,
                                { color: colors.textSecondary },
                            ]}
                        >
                            {days} day{days !== 1 ? 's' : ''} ·{' '}
                            {fmtShortDate(tripStart)} – {fmtShortDate(tripEnd)}
                        </Text>
                    )}
                </View>

                {/* Occasion */}
                <View style={st.inputSection}>
                    <Text style={st.label}>Occasion</Text>
                    <OccasionChips
                        active={selectedOccasion}
                        onChange={setSelectedOccasion}
                        colors={colors}
                    />
                </View>

                {/* Plan button */}
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
                        <Text
                            style={[
                                st.planBtnText,
                                { color: colors.saveBtnText },
                            ]}
                        >
                            Plan my trip ✈️
                        </Text>
                    )}
                </Pressable>

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
                        <GlassCard
                            glassStyle='clear'
                            style={st.errorInner}
                        >
                            <Text style={st.errorText}>{error}</Text>
                        </GlassCard>
                    </RNView>
                )}

                {/* Skeleton loading */}
                {loading && (
                    <>
                        <Text style={st.sectionHeader}>Day-by-Day Outfits</Text>
                        <ScrollView
                            horizontal
                            pagingEnabled
                            showsHorizontalScrollIndicator={false}
                        >
                            {[0, 1, 2].map((i) => (
                                <SkeletonCard
                                    key={i}
                                    cardWidth={cardWidth}
                                />
                            ))}
                        </ScrollView>
                    </>
                )}

                {/* Results */}
                {!loading && plans.length > 0 && (
                    <>
                        <HeroBanner
                            plans={plans}
                            destination={destination}
                            colors={colors}
                        />

                        <Text style={st.sectionHeader}>Day-by-Day Outfits</Text>

                        {/* Full-width pager */}
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
                            contentContainerStyle={{
                                paddingVertical: spacing.xs,
                            }}
                            onMomentumScrollEnd={(e) => {
                                const page = Math.round(
                                    e.nativeEvent.contentOffset.x / cardWidth,
                                );
                                setActiveIdx(
                                    Math.max(
                                        0,
                                        Math.min(page, plans.length - 1),
                                    ),
                                );
                            }}
                        >
                            {plans.map((plan, i) => (
                                <DayCard
                                    key={i}
                                    plan={plan}
                                    colors={colors}
                                    cardWidth={cardWidth}
                                    animValue={
                                        animValues[i] ?? new Animated.Value(1)
                                    }
                                    isReplanning={replanningIdx === i}
                                    onReplan={() => onReplanDay(i)}
                                />
                            ))}
                        </ScrollView>
                        </GlassGroup>

                        {/* Dot indicators */}
                        {plans.length > 1 && (
                            <RNView style={st.dotsRow}>
                                <GlassCard
                                    glassStyle='clear'
                                    style={st.dotsPill}
                                >
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
                                <Text style={st.sectionHeader}>
                                    Packing List
                                </Text>
                                <Text
                                    style={[
                                        st.sectionSub,
                                        { color: colors.textMuted },
                                    ]}
                                >
                                    {packingList.length - checkedIds.size}{' '}
                                    remaining · {packingList.length} total
                                </Text>
                            </RNView>
                            <GlassCard
                                glassStyle='clear'
                                style={st.shareBtn}
                            >
                                <Pressable
                                    onPress={handleSharePacking}
                                    style={st.shareBtnInner}
                                    accessibilityRole='button'
                                    accessibilityLabel='Share packing list'
                                >
                                    <Text
                                        style={[
                                            st.shareBtnText,
                                            { color: colors.textSecondary },
                                        ]}
                                    >
                                        ↑ Share
                                    </Text>
                                </Pressable>
                            </GlassCard>
                        </RNView>

                        <GlassCard
                            glassStyle='regular'
                            style={st.packCard}
                        >
                            <GroupedPackingList
                                packingList={packingList}
                                checkedIds={checkedIds}
                                onToggle={toggleChecked}
                                colors={colors}
                            />
                        </GlassCard>
                    </>
                )}
            </ScrollView>
        </SafeAreaView>
    );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

function makeStyles(
    colors: ReturnType<typeof useTheme>['colors'],
    _cardWidth: number,
) {
    return StyleSheet.create({
        root: {
            flex: 1,
            backgroundColor: colors.bgDefault,
        },
        header: {
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.sm,
            gap: spacing.sm,
        },
        backBtn: { padding: 4 },
        backArrow: { fontSize: 28, lineHeight: 32 },
        title: {
            fontFamily: fonts.display,
            fontSize: fontSizes.xl,
            color: colors.textPrimary,
        },
        scroll: {
            padding: spacing.md,
            gap: spacing.md,
            paddingBottom: spacing.xl,
        },
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
        dateSummary: {
            fontFamily: fonts.body,
            fontSize: fontSizes.xs,
            marginTop: 4,
        },
        planBtn: {
            borderRadius: radius.sm,
            paddingVertical: 14,
            alignItems: 'center',
            justifyContent: 'center',
        },
        planBtnDisabled: { opacity: 0.5 },
        planBtnText: {
            fontFamily: fonts.bodySemiBold,
            fontSize: fontSizes.base,
        },
        errorInner: {
            padding: spacing.sm,
            backgroundColor: 'rgba(239,68,68,0.12)',
        },
        errorText: {
            fontFamily: fonts.body,
            fontSize: fontSizes.sm,
            color: '#f87171',
        },
        sectionHeader: {
            fontFamily: fonts.bodySemiBold,
            fontSize: fontSizes.md,
            color: colors.textPrimary,
            marginTop: spacing.xs,
        },
        sectionSub: {
            fontFamily: fonts.body,
            fontSize: fontSizes.xs,
        },
        sectionHeaderRow: {
            flexDirection: 'row',
            alignItems: 'flex-end',
            justifyContent: 'space-between',
            marginTop: spacing.xs,
        },
        dotsRow: {
            alignItems: 'center',
            marginTop: 6,
        },
        dotsPill: {
            flexDirection: 'row',
            gap: 6,
            paddingHorizontal: 12,
            paddingVertical: 6,
            borderRadius: radius.pill,
        },
        dot: {
            width: 7,
            height: 7,
            borderRadius: 4,
        },
        dotActive: {
            width: 18,
            height: 7,
            borderRadius: 4,
        },
        packCard: {
            borderRadius: radius.md,
            paddingHorizontal: spacing.sm,
            paddingBottom: spacing.xs,
        },
        shareBtn: {
            borderRadius: radius.pill,
            overflow: 'hidden',
        },
        shareBtnInner: {
            paddingHorizontal: 12,
            paddingVertical: 5,
        },
        shareBtnText: {
            fontFamily: fonts.bodySemiBold,
            fontSize: fontSizes.xs,
        },
    });
}
