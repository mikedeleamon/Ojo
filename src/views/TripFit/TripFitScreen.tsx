/**
 * TripFitScreen.tsx
 * ─────────────────
 * Given a destination city and number of days, fetches the 5-day daily forecast,
 * runs generateOutfits() for each day, and presents:
 *   • Day-by-day outfit cards (horizontally scrollable)
 *   • A deduplicated packing list
 *   • A gap section for items missing from the closet
 */

import { useState, useMemo, useCallback } from 'react';
import {
    ScrollView,
    TextInput,
    ActivityIndicator,
    Pressable,
    StyleSheet,
    Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { View, Text } from '../../components/primitives';
import { useTheme } from '../../theme/ThemeContext';
import { fonts, fontSizes, fontWeights, radius, spacing } from '../../theme/tokens';
import { useClosets } from '../../hooks/useClosets';
import { useAppNavigation } from '../../hooks/useAppNavigation';
import { generateOutfits } from '../../lib/outfitEngine';
import type { OutfitResult } from '../../lib/outfitEngine';
import { recordGapsFromNotes } from '../../lib/wardrobeGaps';
import { useSettings } from '../../context/SettingsContext';
import api from '../../api/client';
import { authHeaders } from '../../lib/auth';
import type {
    DailyForecast,
    CurrentWeather,
    ClothingArticle,
} from '../../types';

// ─── Types ────────────────────────────────────────────────────────────────────

interface DayPlan {
    day:    DailyForecast;
    outfit: OutfitResult;
}

interface AccuDailyDay {
    EpochDate:    number;
    Temperature:  { Minimum?: { Value?: number }; Maximum?: { Value?: number } };
    Day?:         { IconPhrase?: string; HasPrecipitation?: boolean };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Build a synthetic CurrentWeather object from a DailyForecast day.
 * Uses the midpoint of min/max for temperature; safe defaults for the
 * derived fields generateOutfits() needs but aren't in a daily forecast.
 */
function buildTripWeather(day: DailyForecast): CurrentWeather {
    const midF = (day.minTempF + day.maxTempF) / 2;
    return {
        WeatherText:           day.dayPhrase,
        HasPrecipitation:      day.hasPrecipitation,
        PrecipitationType:     day.hasPrecipitation ? 'Rain' : null,
        IsDayTime:             true,
        Temperature: {
            Imperial: { Value: midF,                    Unit: 'F' },
            Metric:   { Value: (midF - 32) * (5 / 9),  Unit: 'C' },
        },
        RealFeelTemperature: {
            Imperial: { Value: midF,                    Unit: 'F' },
            Metric:   { Value: (midF - 32) * (5 / 9),  Unit: 'C' },
        },
        Wind:              { Speed: { Imperial: { Value: 5 },  Metric: { Value: 8 } } },
        RelativeHumidity:  60,
        UVIndexText:       'Moderate',
    };
}

/** Parse the raw AccuWeather 5-day response into our DailyForecast shape. */
function parseDailyForecasts(raw: unknown): DailyForecast[] {
    const data = raw as { DailyForecasts?: AccuDailyDay[] };
    if (!Array.isArray(data?.DailyForecasts)) return [];
    return data.DailyForecasts.map((d: AccuDailyDay) => ({
        date:             new Date(d.EpochDate * 1000).toISOString().slice(0, 10),
        minTempF:         d.Temperature?.Minimum?.Value ?? 60,
        maxTempF:         d.Temperature?.Maximum?.Value ?? 75,
        dayPhrase:        d.Day?.IconPhrase ?? 'Partly cloudy',
        hasPrecipitation: !!d.Day?.HasPrecipitation,
    }));
}

/** Friendly short date string, e.g. "Mon, May 26". */
function fmtDate(iso: string): string {
    return new Date(iso).toLocaleDateString('en-US', {
        weekday: 'short', month: 'short', day: 'numeric',
    });
}

/** Weather phrase → small emoji indicator. */
function phraseEmoji(phrase: string): string {
    const p = phrase.toLowerCase();
    if (p.includes('snow'))                      return '❄️';
    if (p.includes('rain') || p.includes('shower')) return '🌧️';
    if (p.includes('thunder'))                   return '⛈️';
    if (p.includes('cloud') || p.includes('overcast')) return '☁️';
    if (p.includes('sun') || p.includes('clear') || p.includes('fair')) return '☀️';
    if (p.includes('wind'))                      return '💨';
    return '🌤️';
}

// ─── Sub-components ───────────────────────────────────────────────────────────

const DayCard = ({
    plan,
    colors,
}: {
    plan: DayPlan;
    colors: ReturnType<typeof useTheme>['colors'];
}) => {
    const articles = plan.outfit.slots.map((s: { article: ClothingArticle }) => s.article);
    return (
        <View style={[dayCardStyles.card, { backgroundColor: colors.glassBg, borderColor: colors.glassBorder }]}>
            <Text style={[dayCardStyles.dateLabel, { color: colors.textSecondary }]}>
                {phraseEmoji(plan.day.dayPhrase)} {fmtDate(plan.day.date)}
            </Text>
            <Text style={[dayCardStyles.tempRow, { color: colors.textMuted }]}>
                {Math.round(plan.day.minTempF)}° – {Math.round(plan.day.maxTempF)}°F · {plan.day.dayPhrase}
            </Text>
            <View style={dayCardStyles.articleList}>
                {articles.map((a: ClothingArticle, i: number) => (
                    <Text key={i} style={[dayCardStyles.articleChip, { color: colors.textPrimary, borderColor: colors.glassBorder }]}>
                        {a.name || a.clothingType}
                    </Text>
                ))}
            </View>
            {plan.outfit.notes.length > 0 && (
                <Text style={[dayCardStyles.note, { color: colors.textMuted }]} numberOfLines={2}>
                    {plan.outfit.notes[0]}
                </Text>
            )}
        </View>
    );
};

const dayCardStyles = StyleSheet.create({
    card: {
        width: 220,
        borderRadius: radius.md,
        borderWidth: 1,
        padding: spacing.sm,
        marginRight: spacing.sm,
        gap: 6,
    },
    dateLabel: {
        fontFamily: fonts.bodySemiBold,
        fontSize: fontSizes.sm,
    },
    tempRow: {
        fontFamily: fonts.body,
        fontSize: fontSizes.xs,
    },
    articleList: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 4,
    },
    articleChip: {
        fontFamily: fonts.body,
        fontSize: fontSizes.xs,
        borderWidth: 1,
        borderRadius: radius.pill,
        paddingHorizontal: 8,
        paddingVertical: 2,
    },
    note: {
        fontFamily: fonts.body,
        fontSize: fontSizes.xs,
        fontStyle: 'italic',
    },
});

const PackingRow = ({
    article,
    colors,
}: {
    article: ClothingArticle;
    colors: ReturnType<typeof useTheme>['colors'];
}) => (
    <View style={[packStyles.row, { borderBottomColor: colors.glassBorder }]}>
        <Text style={[packStyles.name, { color: colors.textPrimary }]}>
            {article.name || article.clothingType}
        </Text>
        <Text style={[packStyles.meta, { color: colors.textMuted }]}>
            {[article.clothingType, article.color].filter(Boolean).join(' · ')}
        </Text>
    </View>
);

const packStyles = StyleSheet.create({
    row: {
        paddingVertical: 10,
        borderBottomWidth: StyleSheet.hairlineWidth,
        gap: 2,
    },
    name: {
        fontFamily: fonts.bodyMedium,
        fontSize: fontSizes.sm,
    },
    meta: {
        fontFamily: fonts.body,
        fontSize: fontSizes.xs,
    },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function TripFitScreen() {
    const { colors } = useTheme();
    const { goBack } = useAppNavigation();
    const { closets } = useClosets();
    const { settings } = useSettings();

    const [destination, setDestination] = useState('');
    const [days, setDays]               = useState(3);
    const [loading, setLoading]         = useState(false);
    const [plans, setPlans]             = useState<DayPlan[]>([]);
    const [error, setError]             = useState<string | null>(null);

    // Flat list of all articles across all preferred/first closet
    const articles: ClothingArticle[] = useMemo(() => {
        if (!closets.length) return [];
        const preferred = closets.find(c => c.isPreferred) ?? closets[0];
        return preferred.articles;
    }, [closets]);

    // Deduplicated packing list: unique articles by _id across all day outfits
    const packingList: ClothingArticle[] = useMemo(() => {
        const seen = new Set<string>();
        const result: ClothingArticle[] = [];
        for (const plan of plans) {
            for (const slot of plan.outfit.slots) {
                if (!seen.has(slot.article._id)) {
                    seen.add(slot.article._id);
                    result.push(slot.article);
                }
            }
        }
        return result;
    }, [plans]);

    const onPlan = useCallback(async () => {
        const query = destination.trim();
        if (!query) {
            Alert.alert('Enter a destination', 'Type a city name to plan your trip.');
            return;
        }
        setLoading(true);
        setError(null);
        setPlans([]);
        try {
            // 1. Look up city
            const cityRes = await api.get<{ Key: string; LocalizedName: string }>(
                '/api/weather/city',
                { params: { q: query }, ...authHeaders() },
            );
            const cityData = cityRes.data;
            if (!cityData?.Key) throw new Error(`City not found: "${query}"`);

            // 2. Fetch 5-day daily forecast
            const forecastRes = await api.get(
                `/api/weather/forecast/daily/${cityData.Key}`,
                authHeaders(),
            );
            const allDays = parseDailyForecasts(forecastRes.data);
            const slicedDays = allDays.slice(0, days);
            if (!slicedDays.length) throw new Error('No forecast data returned.');

            // 3. Generate outfit for each day
            const newPlans: DayPlan[] = slicedDays.map(day => {
                const weather = buildTripWeather(day);
                const { results } = generateOutfits(articles, weather, settings, new Set(), 1);
                return { day, outfit: results[0] };
            });

            // 5. Record gaps from notes (best-effort)
            for (const p of newPlans) {
                if (p.outfit.notes.length) {
                    recordGapsFromNotes(p.outfit.notes).catch(() => {});
                }
            }

            setPlans(newPlans);
        } catch (err: any) {
            const msg: string = err?.response?.data?.error ?? err?.message ?? 'Could not plan trip.';
            setError(msg);
        } finally {
            setLoading(false);
        }
    }, [destination, days, articles]);

    const st = useMemo(() => makeStyles(colors), [colors]);

    const DAY_OPTIONS = [1, 2, 3, 4, 5];

    return (
        <SafeAreaView style={st.root} edges={['top', 'bottom']}>
            {/* Header */}
            <View style={st.header}>
                <Pressable
                    onPress={goBack}
                    style={st.backBtn}
                    accessibilityLabel="Go back"
                    accessibilityRole="button"
                >
                    <Text style={[st.backArrow, { color: colors.textPrimary }]}>‹</Text>
                </Pressable>
                <Text style={st.title}>TripFit</Text>
            </View>

            <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={st.scroll}
                keyboardShouldPersistTaps="handled"
            >
                {/* Destination input */}
                <View style={st.inputSection}>
                    <Text style={st.label}>Destination</Text>
                    <TextInput
                        style={[st.textInput, { color: colors.textPrimary, borderColor: colors.glassBorder, backgroundColor: colors.glassBg }]}
                        placeholder="e.g. New York, Tokyo, London"
                        placeholderTextColor={colors.textMuted}
                        value={destination}
                        onChangeText={setDestination}
                        returnKeyType="done"
                        onSubmitEditing={onPlan}
                        autoCapitalize="words"
                        autoCorrect={false}
                    />
                </View>

                {/* Day count picker */}
                <View style={st.inputSection}>
                    <Text style={st.label}>Days</Text>
                    <View style={st.dayChips}>
                        {DAY_OPTIONS.map(n => (
                            <Pressable
                                key={n}
                                style={[
                                    st.dayChip,
                                    { borderColor: colors.glassBorder, backgroundColor: colors.glassBg },
                                    days === n && st.dayChipActive,
                                ]}
                                onPress={() => setDays(n)}
                                accessibilityRole="radio"
                                accessibilityState={{ checked: days === n }}
                            >
                                <Text
                                    style={[
                                        st.dayChipText,
                                        { color: days === n ? '#fff' : colors.textPrimary },
                                    ]}
                                >
                                    {n}
                                </Text>
                            </Pressable>
                        ))}
                    </View>
                </View>

                {/* Plan button */}
                <Pressable
                    style={[st.planBtn, { backgroundColor: colors.saveBtnBg }, loading && st.planBtnDisabled]}
                    onPress={onPlan}
                    disabled={loading}
                    accessibilityRole="button"
                    accessibilityLabel="Plan trip"
                >
                    {loading ? (
                        <ActivityIndicator color={colors.saveBtnText} />
                    ) : (
                        <Text style={[st.planBtnText, { color: colors.saveBtnText }]}>
                            Plan my trip ✈️
                        </Text>
                    )}
                </Pressable>

                {/* Error */}
                {error && (
                    <View style={st.errorBanner}>
                        <Text style={st.errorText}>{error}</Text>
                    </View>
                )}

                {/* Day-by-day outfit cards */}
                {plans.length > 0 && (
                    <>
                        <Text style={st.sectionHeader}>Day-by-Day Outfits</Text>
                        <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={st.dayScroll}
                        >
                            {plans.map((plan, i) => (
                                <DayCard key={i} plan={plan} colors={colors} />
                            ))}
                        </ScrollView>

                        {/* Packing list */}
                        <Text style={st.sectionHeader}>Packing List</Text>
                        <Text style={st.sectionSub}>
                            {packingList.length} unique {packingList.length === 1 ? 'item' : 'items'} across {plans.length} {plans.length === 1 ? 'day' : 'days'}
                        </Text>
                        <View style={[st.packCard, { backgroundColor: colors.glassBg, borderColor: colors.glassBorder }]}>
                            {packingList.map(a => (
                                <PackingRow key={a._id} article={a} colors={colors} />
                            ))}
                        </View>
                    </>
                )}
            </ScrollView>
        </SafeAreaView>
    );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

function makeStyles(colors: ReturnType<typeof useTheme>['colors']) {
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
        backBtn: {
            padding: 4,
        },
        backArrow: {
            fontSize: 28,
            lineHeight: 32,
        },
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
        inputSection: {
            gap: spacing.xs,
        },
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
        dayChips: {
            flexDirection: 'row',
            gap: spacing.xs,
        },
        dayChip: {
            width: 44,
            height: 44,
            borderRadius: radius.sm,
            borderWidth: 1,
            alignItems: 'center',
            justifyContent: 'center',
        },
        dayChipActive: {
            backgroundColor: '#6366f1',
            borderColor: '#6366f1',
        },
        dayChipText: {
            fontFamily: fonts.bodySemiBold,
            fontSize: fontSizes.base,
        },
        planBtn: {
            borderRadius: radius.sm,
            paddingVertical: 14,
            alignItems: 'center',
            justifyContent: 'center',
        },
        planBtnDisabled: {
            opacity: 0.6,
        },
        planBtnText: {
            fontFamily: fonts.bodySemiBold,
            fontSize: fontSizes.base,
        },
        errorBanner: {
            backgroundColor: 'rgba(239,68,68,0.15)',
            borderWidth: 1,
            borderColor: 'rgba(239,68,68,0.4)',
            borderRadius: radius.sm,
            padding: spacing.sm,
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
            marginTop: spacing.sm,
        },
        sectionSub: {
            fontFamily: fonts.body,
            fontSize: fontSizes.xs,
            color: colors.textMuted,
            marginBottom: 4,
        },
        dayScroll: {
            paddingVertical: spacing.xs,
        },
        packCard: {
            borderWidth: 1,
            borderRadius: radius.md,
            paddingHorizontal: spacing.sm,
        },
    });
}
