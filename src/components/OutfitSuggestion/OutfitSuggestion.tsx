import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useFocusEffect } from 'expo-router';
import {
    ScrollView,
    Image,
    Pressable,
    Linking,
    useWindowDimensions,
    Animated as RNAnimated,
    Easing as RNEasing,
} from 'react-native';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withTiming,
    interpolate,
    Easing,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { View, Text, GlassCard, GlassGroup } from '../primitives';
import { EmptyState } from '../shared';
import OccasionChips from '../OccasionChips';
import { useClosets } from '../../hooks/useClosets';
import { useReduceMotion } from '../../hooks/useReduceMotion';
import { useTripMode } from '../../hooks/useTripMode';
import { hapticSuccess } from '../../lib/haptics';
import { useAppNavigation } from '../../hooks/useAppNavigation';
import { buildWidgetInput } from '../../lib/widget/buildInput';
import { updateWidgetSnapshot } from '../../lib/widget/updateWidgetSnapshot';
import TripModeCard from '../TripMode/TripModeCard';
import ShareToInstagramSheet from '../ShareCard/ShareToInstagramSheet';
import TodayOutfitShareCard from '../ShareCard/TodayOutfitShareCard';
import { outfitShareLink } from '../../lib/share/deepLinks';
import {
    generateOutfits,
    personalizedScoreLevel,
    buildWearContext,
    ENGINE_VERSION,
    OutfitRole,
    OutfitSlot,
    OutfitResult,
    articleZoneLabel,
} from '../../lib/outfitEngine';
import { addHistoryEntry, recentlyWornWithAge, loadHistory } from '../../lib/outfitHistory';
import { recordSuccessfulOutfit, maybeRequestReview } from '../../services/reviewManager';
import { derivePreferenceProfile } from '../../lib/userPreferences';
import {
    recordGapsFromNotes,
    getGapSuggestions,
    GapSuggestion,
    GapType,
} from '../../lib/wardrobeGaps';
import {
    ClothingArticle,
    CurrentWeather,
    DailyForecast,
    Forecast,
    Settings,
    OutfitOccasion,
    OutfitHistoryEntry,
    WearContext,
    WearEngineMeta,
    WearNegative,
} from '../../types';
import { spacing, brandHeroTint } from '../../theme/tokens';
import { useTheme } from '../../theme/ThemeContext';
import {
    CSS_COLORS,
    ROLE_LABELS,
    BREAKDOWN_LABELS,
    REMOVABLE_ROLES,
} from './constants';
import {
    outfitTabSubtitle,
    whyThisOutfit,
    weatherAwareAddClothesBody,
    weatherAwareInsufficientBody,
} from './copy';
import { HangerIcon } from '../shared/HangerIcon';
import { LayeringSection } from './LayeringSection';
import { makeStyles } from './OutfitSuggestion.styles';

// ─── Sub-components ───────────────────────────────────────────────────────────

const ArticleThumb = ({
    article,
    role,
    onRemove,
}: {
    article: ClothingArticle;
    role: OutfitRole;
    onRemove?: () => void;
}) => {
    const { colors } = useTheme();
    const styles = useMemo(() => makeStyles(colors), [colors]);
    return (
        <GlassCard style={styles.articleCard}>
            <View style={styles.articleImg}>
                {article.imageUrl ? (
                    <Image
                        source={{ uri: article.imageUrl }}
                        style={styles.articleImgFill}
                        resizeMode='cover'
                    />
                ) : (
                    <HangerIcon
                        size={20}
                        color={colors.textMuted}
                    />
                )}
                {article.color && CSS_COLORS[article.color] && (
                    <View
                        style={[
                            styles.colorDot,
                            { backgroundColor: CSS_COLORS[article.color] },
                        ]}
                    />
                )}
            </View>
            <View style={styles.articleLabel}>
                <Text style={styles.roleLabel}>
                    {role === 'accessory'
                        ? articleZoneLabel(article)
                        : ROLE_LABELS[role]}
                </Text>
                <Text
                    style={styles.articleName}
                    numberOfLines={1}
                >
                    {article.name || article.clothingType}
                </Text>
                {article.fabricType ? (
                    <Text style={styles.articleMeta}>{article.fabricType}</Text>
                ) : null}
            </View>
            {onRemove && (
                <Pressable
                    style={styles.articleRemoveBtn}
                    onPress={onRemove}
                    hitSlop={8}
                    accessibilityLabel='Remove from outfit'
                >
                    <Text style={styles.articleRemoveText}>✕</Text>
                </Pressable>
            )}
        </GlassCard>
    );
};

const ScoreBadge = ({
    score,
    isPersonalized,
}: {
    score: number;
    isPersonalized?: boolean;
    isLearning?: boolean;
}) => {
    const { colors } = useTheme();
    const styles = useMemo(() => makeStyles(colors), [colors]);
    const color =
        score >= 80
            ? 'rgba(52,211,153,0.9)'
            : score >= 60
              ? 'rgba(251,191,36,0.9)'
              : 'rgba(148,163,184,0.9)';
    const label = isPersonalized ? 'Your Score' : 'Outfit Score';
    return (
        <View style={[styles.scoreBadge, { borderColor: color }]}>
            <Text style={[styles.scoreBadgeText, { color }]}>
                {label}: {score}
                {isPersonalized ? ' ★' : ''}
            </Text>
            {/* {isLearning && !isPersonalized && (
                <Text style={[styles.scoreBadgeText, { color, fontSize: 10, opacity: 0.7 }]}>
                    personalizing…
                </Text>
            )} */}
        </View>
    );
};

// ─── Gap card ────────────────────────────────────────────────────────────────

const GAP_SEARCH_TERMS: Record<GapType, string> = {
    missing_coat: 'winter coat',
    missing_jacket: 'light jacket',
    missing_boots: 'boots',
    missing_mid_layer: 'hoodie sweater',
    missing_rain_layer: 'waterproof jacket',
    missing_footwear: 'shoes',
};

const GapCard = ({
    suggestion,
    onDismiss,
}: {
    suggestion: GapSuggestion;
    onDismiss: () => void;
}) => {
    const { colors } = useTheme();
    const styles = useMemo(() => makeStyles(colors), [colors]);
    const searchTerm = GAP_SEARCH_TERMS[suggestion.type] ?? 'clothing';
    return (
        <View style={styles.gapCard}>
            <Pressable
                style={styles.gapDismiss}
                onPress={onDismiss}
                hitSlop={8}
            >
                <Text style={styles.gapDismissText}>✕</Text>
            </Pressable>
            <Text style={styles.gapMessage}>{suggestion.message}</Text>
            <Pressable
                style={styles.gapCTA}
                onPress={() =>
                    Linking.openURL(
                        `https://www.google.com/search?tbm=shop&q=${encodeURIComponent(searchTerm)}`,
                    )
                }
            >
                <Text style={styles.gapCTAText}>Browse {searchTerm} →</Text>
            </Pressable>
        </View>
    );
};

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
    weather: CurrentWeather;
    settings: Settings;
    forecasts: Forecast[];
    /** 10-day daily forecast — today's entry feeds the widget's H/L, rain % and sunset. */
    daily?: DailyForecast[];
}

const OutfitSuggestion = ({ weather, settings, forecasts, daily }: Props) => {
    const { colors, isDark } = useTheme();
    const styles = useMemo(() => makeStyles(colors), [colors]);
    const heroTint = isDark ? brandHeroTint.dark : brandHeroTint.light;
    const { closets, loading, preferred, setPreferred, refresh } =
        useClosets();
    const reduceMotion = useReduceMotion();

    // Re-fetch closets each time this screen gains focus so outfit suggestions
    // stay current after the user adds clothes or sets a preferred closet in
    // the Closet tab without needing to fully restart the app.
    useFocusEffect(
        useCallback(() => {
            refresh();
        }, [refresh]),
    );
    const [settingPref, setSettingPref] = useState(false);
    const [activeIdx, setActiveIdx] = useState(0);
    const [showBreakdown, setShowBreakdown] = useState(false);
    const [wornLogged, setWornLogged] = useState(false);
    const [showShareSheet, setShowShareSheet] = useState(false);
    // The outfit captured by the "Logged for today" confirmation — either the
    // active generated outfit or the Trip Mode outfit, so the confirmation card
    // always shows whatever the user actually logged.
    const [loggedOutfit, setLoggedOutfit] = useState<{
        slots: OutfitSlot[];
        score: number;
        // Full source outfit (headline/layering/accessoryAlerts) so the home-screen
        // widget can show the worn outfit's description + cues, not just its items.
        result: OutfitResult | null;
    } | null>(null);
    const [worn, setWorn] = useState<Map<string, number>>(new Map());
    const [removedByOutfit, setRemovedByOutfit] = useState<
        Map<number, Set<string>>
    >(new Map());
    const [occasionOverride, setOccasionOverride] = useState<OutfitOccasion>(
        settings.occasion ?? 'everyday',
    );
    const [gapSuggestion, setGapSuggestion] = useState<GapSuggestion | null>(
        null,
    );
    const [gapDismissed, setGapDismissed] = useState(false);
    // Outfit history drives the preference profile (the ranker's personalization
    // signal). The profile is derived from it + closets, never stored separately.
    const [history, setHistory] = useState<OutfitHistoryEntry[]>([]);
    const profile = useMemo(
        () => derivePreferenceProfile(closets, history),
        [closets, history],
    );
    const nav = useAppNavigation();

    // ─── Trip Mode ────────────────────────────────────────────────────────────
    // When the user is in (or scheduled for) a saved trip today, the outfit they
    // planned in TripFit becomes the primary suggestion. It renders as a banner
    // at the top of this component; the normal generated carousel is demoted
    // behind a "See other ideas" toggle so there's a single today's-outfit answer.
    const tripMode = useTripMode();
    const [tripDismissed, setTripDismissed] = useState(false);
    const [showOtherIdeas, setShowOtherIdeas] = useState(false);
    const showTrip = tripMode.active && !!tripMode.trip && !tripDismissed;

    const tripBanner =
        showTrip && tripMode.trip ? (
            <TripModeCard
                trip={tripMode.trip}
                outfit={tripMode.outfit}
                dayIndex={tripMode.dayIndex}
                total={tripMode.total}
                locationConfirmed={tripMode.locationConfirmed}
                source={tripMode.source}
                driftNote={tripMode.driftNote}
                onWoreThis={() => handleWoreTrip()}
                onOpenTrip={() =>
                    nav.push('/account/tripfit', { planId: tripMode.trip!.id })
                }
                onDismiss={() => setTripDismissed(true)}
            />
        ) : null;

    // ─── Wore-today crossfade (UI-thread only via shared value) ───────────────
    const confirmProgress = useSharedValue(0); // 0 = carousel, 1 = confirmation
    const [carouselHeight, setCarouselHeight] = useState(0);
    const [confirmHeight, setConfirmHeight]   = useState(0);

    useEffect(() => {
        confirmProgress.value = withTiming(wornLogged ? 1 : 0, {
            duration: reduceMotion ? 0 : 280,
            easing: Easing.inOut(Easing.ease),
        });
    }, [wornLogged, reduceMotion]);

    const containerAnimStyle = useAnimatedStyle(() => {
        const from = carouselHeight;
        const to   = confirmHeight;
        if (!from && !to) return {};
        return {
            height: interpolate(confirmProgress.value, [0, 1], [from, to]),
            overflow: 'hidden' as const,
        };
    });

    const carouselAnimStyle = useAnimatedStyle(() => ({
        opacity: interpolate(confirmProgress.value, [0, 0.45, 1], [1, 0, 0]),
        position: 'absolute' as const,
        top: 0, left: 0, right: 0,
    }));

    const confirmAnimStyle = useAnimatedStyle(() => ({
        opacity: interpolate(confirmProgress.value, [0, 0.55, 1], [0, 0, 1]),
        position: 'absolute' as const,
        top: 0, left: 0, right: 0,
    }));

    // ─── #5: Swipe hint bounce (first render only) ──────────────────────────
    const hintAnim = useRef(new RNAnimated.Value(0)).current;
    const hintFired = useRef(false);

    // ─── Pager ───────────────────────────────────────────────────────────────
    const { width: windowWidth } = useWindowDimensions();
    const cardWidth = windowWidth - spacing.md * 4.1;
    const pagerRef = useRef<ScrollView>(null);

    useEffect(() => {
        recentlyWornWithAge(7).then(setWorn);
        loadHistory()
            .then(setHistory)
            .catch(() => {});
    }, []);

    useEffect(() => {
        setActiveIdx(0);
        setShowBreakdown(false);
        setWornLogged(false);
        setRemovedByOutfit(new Map());
        setOccasionOverride(settings.occasion ?? 'everyday');
    }, [settings]);

    const effectiveSettings = useMemo(
        () => ({ ...settings, occasion: occasionOverride }),
        [settings, occasionOverride],
    );

    const setPreferredCloset = async (id: string) => {
        setSettingPref(true);
        try {
            await setPreferred(id);
        } catch {}
        setSettingPref(false);
    };

    const { outfits, status } = useMemo(() => {
        if (!preferred) return { outfits: [], status: 'no_preferred' as const };
        const { results, status } = generateOutfits(
            preferred.articles,
            weather,
            effectiveSettings,
            worn,
            3,
            profile,
            forecasts,
        );
        return { outfits: results, status };
    }, [preferred, weather, effectiveSettings, worn, forecasts, profile]);

    // Feeds the in-app review prompt's eligibility count. recordSuccessfulOutfit
    // caps itself at once per calendar day, since this memo above recomputes on
    // every weather/preference/worn-status change, not just once per "real"
    // generation. Never awaited/blocking — must not interrupt the outfit UI.
    useEffect(() => {
        if (status !== 'ok' || outfits.length === 0) return;
        recordSuccessfulOutfit()
            .then(() => maybeRequestReview())
            .catch(() => {});
    }, [status, outfits.length]);

    const safeIdx = Math.min(activeIdx, Math.max(0, outfits.length - 1));
    const activeOutfit: OutfitResult | null = outfits[safeIdx] ?? null;

    // The outfit the user logged as worn today, reshaped for the widget: the
    // actual worn slots (minus any removed items) but carrying the source
    // outfit's headline/layering/accessoryAlerts so the widget can still show
    // its description + cues. Takes precedence in buildWidgetInput.
    const wornOutfitForWidget = useMemo<OutfitResult | null>(() => {
        if (!wornLogged || !loggedOutfit?.result) return null;
        return {
            ...loggedOutfit.result,
            slots: loggedOutfit.slots,
            score: loggedOutfit.score,
        };
    }, [wornLogged, loggedOutfit]);

    // ─── Home-screen widget sync ──────────────────────────────────────────────
    // Mirror today's answer — the worn outfit if the user logged one, else the
    // Trip Mode outfit when active, else the top generated outfit — to the iOS
    // widget whenever the resolved state settles.
    // Uses outfits[0] (the primary recommendation), not the swiped card, so the
    // widget stays stable while the user browses. No-ops off-iOS / without the
    // native bridge; thumbnail caching + timeline reload happen natively.
    useEffect(() => {
        if (loading || tripMode.loading) return;
        void updateWidgetSnapshot(
            buildWidgetInput({
                todayOutfits: outfits,
                wornOutfit: wornOutfitForWidget,
                outfitStatus: status,
                closetCount: closets.length,
                weather,
                settings,
                daily,
                trip: {
                    active: tripMode.active,
                    plan: tripMode.trip,
                    outfit: tripMode.outfit,
                    dayIndex: tripMode.dayIndex,
                    total: tripMode.total,
                    driftNote: tripMode.driftNote,
                    locationConfirmed: tripMode.locationConfirmed,
                },
                upcoming: tripMode.upcoming,
            }),
        );
    }, [
        loading,
        outfits,
        status,
        closets.length,
        wornOutfitForWidget,
        weather,
        settings,
        daily,
        tripMode.upcoming,
        tripMode.loading,
        tripMode.active,
        tripMode.trip,
        tripMode.outfit,
        tripMode.dayIndex,
        tripMode.total,
        tripMode.driftNote,
        tripMode.locationConfirmed,
    ]);

    useEffect(() => {
        if (!activeOutfit || activeOutfit.notes.length === 0) return;
        recordGapsFromNotes(activeOutfit.notes)
            .then(() => getGapSuggestions())
            .then((suggestions) => setGapSuggestion(suggestions[0] ?? null))
            .catch(() => {});
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [safeIdx, outfits]);

    const handleRemoveSlot = (outfitIdx: number, articleId: string) => {
        setRemovedByOutfit((prev) => {
            const next = new Map(prev);
            const existing = new Set(next.get(outfitIdx) ?? []);
            existing.add(articleId);
            next.set(outfitIdx, existing);
            return next;
        });
        setWornLogged(false);
    };

    const removedIds = removedByOutfit.get(safeIdx) ?? new Set<string>();

    const activeSlots =
        activeOutfit?.slots.filter((s) => !removedIds.has(s.article._id)) ?? [];

    const filteredLayering = activeOutfit?.layering
        ? {
              ...activeOutfit.layering,
              layers: {
                  base: activeOutfit.layering.layers.base,
                  mid: removedIds.has(
                      activeOutfit.layering.layers.mid?.article._id ?? '',
                  )
                      ? null
                      : activeOutfit.layering.layers.mid,
                  outer: removedIds.has(
                      activeOutfit.layering.layers.outer?.article._id ?? '',
                  )
                      ? null
                      : activeOutfit.layering.layers.outer,
              },
          }
        : null;

    // Hide layering section once all removable layers have been stripped
    const showLayering =
        filteredLayering !== null &&
        (filteredLayering.layers.mid !== null ||
            filteredLayering.layers.outer !== null);

    // Shared logger so both the generated outfit and the Trip Mode outfit flow
    // into the same "Logged for today" confirmation.
    const logOutfitAsWorn = async (opts: {
        slots: OutfitSlot[];
        score: number;
        closetId: string;
        closetName: string;
        result: OutfitResult | null;
        context?: WearContext;
        engine?: WearEngineMeta;
        negatives?: WearNegative[];
    }) => {
        const articles = opts.slots.map((s) => s.article);
        if (articles.length === 0) return;
        hapticSuccess();
        const entry = await addHistoryEntry({
            closetId: opts.closetId,
            closetName: opts.closetName,
            articleIds: articles.map((a) => a._id),
            articleSummary: articles
                .map((a) => a.name || a.clothingType)
                .join(', '),
            context: opts.context,
            engine: opts.engine,
            negatives: opts.negatives,
        });
        setHistory((prev) => [entry, ...prev]);
        setLoggedOutfit({ slots: opts.slots, score: opts.score, result: opts.result });
        setWornLogged(true);
    };

    const handleWoreThis = () => {
        if (!preferred || !activeOutfit || activeOutfit.status !== 'ok') return;
        // The outfits shown alongside the worn one are ranker training negatives:
        // the user saw them and picked this one instead.
        const negatives: WearNegative[] = outfits
            .filter((o, i) => i !== safeIdx && o.status === 'ok' && o.slots.length > 0)
            .slice(0, 5)
            .map((o) => ({
                articleIds: o.slots.map((s) => s.article._id),
                score: o.score,
                source: 'shown_not_worn' as const,
            }));
        logOutfitAsWorn({
            slots: activeSlots,
            score: activeOutfit.score,
            closetId: preferred._id,
            closetName: preferred.name,
            result: activeOutfit,
            context: buildWearContext(weather, effectiveSettings, forecasts),
            engine: {
                score: activeOutfit.score,
                breakdown: activeOutfit.scoreBreakdown,
                rank: safeIdx,
                engineVersion: ENGINE_VERSION,
            },
            negatives: negatives.length > 0 ? negatives : undefined,
        });
    };

    const handleWoreTrip = () => {
        if (!tripMode.outfit || tripMode.outfit.slots.length === 0) return;
        logOutfitAsWorn({
            slots: tripMode.outfit.slots,
            score: tripMode.outfit.score,
            closetId: tripMode.closetId,
            closetName: tripMode.closetName,
            result: tripMode.outfit,
        });
    };

    const handleUndoLog = () => {
        setWornLogged(false);
    };

    // Scroll the pager programmatically when activeIdx changes via dot taps or resets
    useEffect(() => {
        pagerRef.current?.scrollTo({ x: safeIdx * cardWidth, animated: true });
    }, [safeIdx, cardWidth]);

    // #5 — Fire a subtle swipe-hint bounce once after outfits appear
    useEffect(() => {
        if (reduceMotion || hintFired.current || outfits.length <= 1) return;
        hintFired.current = true;
        const timer = setTimeout(() => {
            RNAnimated.sequence([
                RNAnimated.timing(hintAnim, {
                    toValue: 1,
                    duration: 350,
                    easing: RNEasing.out(RNEasing.cubic),
                    useNativeDriver: true,
                }),
                RNAnimated.timing(hintAnim, {
                    toValue: 0,
                    duration: 450,
                    easing: RNEasing.inOut(RNEasing.cubic),
                    useNativeDriver: true,
                }),
            ]).start();
        }, 800);
        return () => clearTimeout(timer);
    }, [outfits.length, reduceMotion]);

    if (loading) return null;

    if (closets.length === 0)
        return (
            <EmptyState
                icon={<HangerIcon size={32} />}
                title='No closet yet'
                body="Create a closet, photograph your clothes with the camera, and Ojo will suggest the best outfits for today's weather."
                action={
                    <Pressable
                        style={styles.ctaBtn}
                        onPress={() => nav.push('/(tabs)/closet')}
                    >
                        <Text style={styles.ctaBtnText}>Set up closet</Text>
                    </Pressable>
                }
            />
        );

    if (!preferred)
        return (
            <View style={styles.root}>
                <Text style={styles.sectionLabel}>Outfit</Text>
                <EmptyState
                    icon={<HangerIcon size={32} />}
                    title='Pick a preferred closet'
                    body='Select a closet to use for daily outfit suggestions.'
                />
                <View style={styles.closetPicker}>
                    {closets.map((c) => (
                        <Pressable
                            key={c._id}
                            style={styles.closetPickBtn}
                            onPress={() => setPreferredCloset(c._id)}
                            disabled={settingPref}
                        >
                            <HangerIcon
                                size={14}
                                color={colors.textSecondary}
                            />
                            <Text style={styles.closetPickName}>{c.name}</Text>
                            <Text style={styles.closetPickCount}>
                                {c.articles.length}
                            </Text>
                        </Pressable>
                    ))}
                </View>
            </View>
        );

    if (status === 'empty_closet' || status === 'insufficient')
        return (
            <View style={styles.root}>
                <PreferredBadge
                    name={preferred.name}
                    onPress={() => nav.push('/(tabs)/closet')}
                />
                <EmptyState
                    icon={<HangerIcon size={32} />}
                    title={
                        status === 'empty_closet'
                            ? 'This closet is empty'
                            : 'Not enough to build an outfit'
                    }
                    body={
                        status === 'empty_closet'
                            ? weatherAwareAddClothesBody(weather)
                            : weatherAwareInsufficientBody(weather)
                    }
                    action={
                        <Pressable
                            style={styles.ctaBtn}
                            onPress={() => nav.push('/(tabs)/closet')}
                        >
                            <Text style={styles.ctaBtnText}>Add clothes</Text>
                        </Pressable>
                    }
                />
            </View>
        );

    if (!activeOutfit)
        return tripBanner ? (
            <View style={styles.root}>{tripBanner}</View>
        ) : null;

    // ── Personalization level for badge ───────────────────────────────────────
    const scoreLevel = personalizedScoreLevel(profile.totalOutfits);

    // #5 — Swipe hint: translate the pager slightly left, then snap back
    const hintTranslateX = hintAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [0, -28],
    });

    // #10 — Why this outfit explanation
    const whyExplanation = activeOutfit
        ? whyThisOutfit(activeOutfit.scoreBreakdown)
        : null;

    // #4 — Reset outfit undo
    const handleResetOutfit = () => {
        setRemovedByOutfit((prev) => {
            const next = new Map(prev);
            next.delete(safeIdx);
            return next;
        });
    };

    // Confirmation reflects whatever was logged (generated outfit or trip outfit).
    const confirmSlots = loggedOutfit?.slots ?? activeSlots;
    const confirmScore = loggedOutfit?.score ?? activeOutfit.score;
    const confirmArticles = confirmSlots.map((s) => s.article);
    const repeatCount = history.filter((e) =>
        confirmArticles.every((a) => e.articleIds.includes(a._id)),
    ).length;

    // The generated suggestion's interactive content — hidden in Trip Mode until
    // the user opts into "other ideas".
    const showGenerated = !showTrip || showOtherIdeas;

    return (
        <View style={styles.root}>
            {/* ── Header (hidden while the trip outfit is the sole focus) ── */}
            {showGenerated && (
            <View style={styles.header}>
                <PreferredBadge
                    name={preferred.name}
                    onPress={() => nav.push('/(tabs)/closet')}
                />
                {!wornLogged && (
                    <View style={styles.scoreBadgeRow}>
                        <ScoreBadge
                            score={activeOutfit.score}
                            isPersonalized={scoreLevel === 'active'}
                            isLearning={scoreLevel === 'learning'}
                        />
                        <Pressable
                            onPress={() => setShowShareSheet(true)}
                            style={styles.overflowBtn}
                            accessibilityLabel='Share outfit'
                            accessibilityRole='button'
                            hitSlop={8}
                        >
                            <Text style={styles.overflowBtnText}>···</Text>
                        </Pressable>
                    </View>
                )}
            </View>
            )}

            {/* ── Crossfade container — both panels always mounted ── */}
            <Animated.View style={containerAnimStyle}>
                {/* ── Interactive panel: trip banner + generated suggestion ── */}
                <Animated.View
                    style={carouselAnimStyle}
                    pointerEvents={wornLogged ? 'none' : 'auto'}
                    onLayout={(e) =>
                        setCarouselHeight(e.nativeEvent.layout.height)
                    }
                >
                    {/* Trip banner and the generated suggestion are mutually
                        exclusive — opening "other ideas" hides the banner. */}
                    {!showOtherIdeas && tripBanner}

                    {/* Trip active → planned outfit is primary; the generated
                        suggestion is demoted behind this toggle. */}
                    {showTrip && (
                        <Pressable
                            style={styles.breakdownToggle}
                            onPress={() => setShowOtherIdeas((v) => !v)}
                            accessibilityRole='button'
                        >
                            <Text style={styles.breakdownToggleText}>
                                {showOtherIdeas
                                    ? 'Hide other ideas'
                                    : 'See other ideas for today'}
                            </Text>
                        </Pressable>
                    )}

                    {showGenerated && (
                      <>
                    {/* ── Occasion quick-switch ── */}
                    <OccasionChips
                        active={occasionOverride}
                        onChange={(o) => {
                            setOccasionOverride(o);
                            setActiveIdx(0);
                            setShowBreakdown(false);
                            setRemovedByOutfit(new Map());
                        }}
                    />

                    {/* #2 — Headline above pager. The block's bottom margin sits
                        under the subtext when present, else under the headline. */}
                    <Text
                        style={[
                            styles.headline,
                            !whyExplanation && styles.textBlockBottom,
                        ]}
                    >
                        {activeOutfit.headline}
                    </Text>

                    {/* #10 — Why this outfit explanation */}
                    {whyExplanation && (
                        <Text style={[styles.whyText, styles.textBlockBottom]}>
                            {whyExplanation}
                        </Text>
                    )}

                    {/* ── Outfit pager with #5 swipe hint bounce ── */}
                    <RNAnimated.View
                        style={{
                            transform: [{ translateX: hintTranslateX }],
                        }}
                    >
                        <ScrollView
                            ref={pagerRef}
                            horizontal
                            pagingEnabled
                            showsHorizontalScrollIndicator={false}
                            scrollEventThrottle={16}
                            decelerationRate='fast'
                            onMomentumScrollEnd={(e) => {
                                const page = Math.round(
                                    e.nativeEvent.contentOffset.x / cardWidth,
                                );
                                if (page !== activeIdx) {
                                    setActiveIdx(page);
                                    setShowBreakdown(false);
                                }
                            }}
                        >
                            {outfits.map((outfit, i) => {
                                const cardRemovedIds =
                                    removedByOutfit.get(i) ??
                                    new Set<string>();
                                return (
                                    <View
                                        key={i}
                                        style={[
                                            styles.pagerCard,
                                            { width: cardWidth },
                                        ]}
                                    >
                                        <GlassGroup
                                            spacing={12}
                                            style={styles.pagerCardArticles}
                                        >
                                            {outfit.slots
                                                .filter(
                                                    (s) =>
                                                        !cardRemovedIds.has(
                                                            s.article._id,
                                                        ),
                                                )
                                                .map((slot, j) => (
                                                    <ArticleThumb
                                                        key={j}
                                                        article={slot.article}
                                                        role={slot.role}
                                                        onRemove={
                                                            REMOVABLE_ROLES.includes(
                                                                slot.role,
                                                            )
                                                                ? () =>
                                                                      handleRemoveSlot(
                                                                          i,
                                                                          slot.article._id,
                                                                      )
                                                                : undefined
                                                        }
                                                    />
                                                ))}
                                        </GlassGroup>
                                        <View style={styles.pagerCardFooter}>
                                            <Text style={styles.pagerSubtitle}>
                                                {outfitTabSubtitle(outfit)}
                                            </Text>
                                        </View>
                                    </View>
                                );
                            })}
                        </ScrollView>
                    </RNAnimated.View>

                    {/* ── Page dots + reset ── */}
                    <View style={styles.dotsRow}>
                        {outfits.length > 1 && (
                            <View style={styles.dots}>
                                {outfits.map((_, i) => (
                                    <Pressable
                                        key={i}
                                        hitSlop={8}
                                        style={[
                                            styles.dot,
                                            i === safeIdx && styles.dotActive,
                                        ]}
                                        onPress={() => {
                                            setActiveIdx(i);
                                            setShowBreakdown(false);
                                        }}
                                    />
                                ))}
                            </View>
                        )}
                        {removedIds.size > 0 && (
                            <Pressable
                                onPress={handleResetOutfit}
                                style={styles.resetLink}
                            >
                                <Text style={styles.resetLinkText}>
                                    Reset outfit
                                </Text>
                            </Pressable>
                        )}
                    </View>

                    {/* ── Gap card ── */}
                    {gapSuggestion && !gapDismissed && (
                        <GapCard
                            suggestion={gapSuggestion}
                            onDismiss={() => setGapDismissed(true)}
                        />
                    )}

                    {/* ── Score breakdown ── */}
                    <Pressable
                        style={styles.breakdownToggle}
                        onPress={() => setShowBreakdown((v) => !v)}
                    >
                        <Text style={styles.breakdownToggleText}>
                            {showBreakdown ? 'Hide breakdown' : 'Score breakdown'}
                        </Text>
                    </Pressable>

                    {showBreakdown && (
                        <View style={styles.breakdownRow}>
                            {BREAKDOWN_LABELS.map(({ key, label }) => (
                                <View key={key} style={styles.breakdownItem}>
                                    <Text style={styles.breakdownLabel}>
                                        {label}
                                    </Text>
                                    <View style={styles.breakdownBarBg}>
                                        <View
                                            style={[
                                                styles.breakdownBarFill,
                                                {
                                                    width: `${activeOutfit.scoreBreakdown[key]}%` as any,
                                                },
                                            ]}
                                        />
                                    </View>
                                    <Text style={styles.breakdownValue}>
                                        {activeOutfit.scoreBreakdown[key]}
                                    </Text>
                                </View>
                            ))}
                        </View>
                    )}

                    {/* ── Notes ── */}
                    {activeOutfit.notes.length > 0 && (
                        <View style={styles.notesList}>
                            {activeOutfit.notes.map((n, i) => (
                                <Text key={i} style={styles.note}>
                                    · {n}
                                </Text>
                            ))}
                        </View>
                    )}

                    {/* ── Layering recommendation ── */}
                    {showLayering && filteredLayering && (
                        <View style={styles.layeringSpacer}>
                            <LayeringSection layering={filteredLayering} />
                        </View>
                    )}

                    {/* ── Wore this today (hero) ──
                        Glass button with a whisper of the brand gradient laid
                        over the glass — tinted glass, not a solid fill. */}
                    <Pressable
                        style={styles.woreThisBtn}
                        onPress={handleWoreThis}
                    >
                        <LinearGradient
                            colors={heroTint}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={styles.woreThisTint}
                            pointerEvents='none'
                        />
                        <Text style={styles.woreThisText}>
                            Wore this today
                        </Text>
                    </Pressable>
                      </>
                    )}
                </Animated.View>

                {/* ── Confirmation panel ── */}
                <Animated.View
                    style={confirmAnimStyle}
                    pointerEvents={wornLogged ? 'auto' : 'none'}
                    onLayout={(e) =>
                        setConfirmHeight(e.nativeEvent.layout.height)
                    }
                >
                    <View style={styles.confirmCard}>
                        <Text style={styles.confirmTitle}>
                            Logged for today
                        </Text>

                        <GlassGroup
                            spacing={12}
                            style={styles.pagerCardArticles}
                        >
                            {confirmSlots.map((slot, j) => (
                                <ArticleThumb
                                    key={j}
                                    article={slot.article}
                                    role={slot.role}
                                />
                            ))}
                        </GlassGroup>

                        <View style={styles.confirmStats}>
                            <View style={styles.confirmStat}>
                                <Text style={styles.confirmStatValue}>
                                    {history.length}
                                </Text>
                                <Text style={styles.confirmStatLabel}>
                                    outfits logged
                                </Text>
                            </View>
                            {confirmScore > 0 && (
                                <View style={styles.confirmStat}>
                                    <Text style={styles.confirmStatValue}>
                                        {confirmScore}
                                    </Text>
                                    <Text style={styles.confirmStatLabel}>
                                        outfit score
                                    </Text>
                                </View>
                            )}
                            {repeatCount > 1 && (
                                <View style={styles.confirmStat}>
                                    <Text style={styles.confirmStatValue}>
                                        {repeatCount}x
                                    </Text>
                                    <Text style={styles.confirmStatLabel}>
                                        worn this combo
                                    </Text>
                                </View>
                            )}
                        </View>
                    </View>

                    <Pressable onPress={handleUndoLog} style={styles.confirmUndo}>
                        <Text style={styles.confirmUndoText}>
                            Wore something else?
                        </Text>
                    </Pressable>
                </Animated.View>
            </Animated.View>

            <ShareToInstagramSheet
                visible={showShareSheet}
                onClose={() => setShowShareSheet(false)}
                renderCard={(cardRef) => (
                    <TodayOutfitShareCard
                        ref={cardRef}
                        slots={confirmSlots}
                        score={confirmScore}
                        isPersonalized={scoreLevel === 'active'}
                        weather={weather}
                    />
                )}
                attributionURL={outfitShareLink()}
            />
        </View>
    );
};

const PreferredBadge = ({
    name,
    onPress,
}: {
    name: string;
    onPress: () => void;
}) => {
    const { colors } = useTheme();
    const styles = useMemo(() => makeStyles(colors), [colors]);
    return (
        <Pressable
            style={styles.preferredBadge}
            onPress={onPress}
        >
            <HangerIcon
                size={11}
                color={colors.textSecondary}
            />
            <Text style={styles.preferredBadgeText}>{name}</Text>
        </Pressable>
    );
};

export default OutfitSuggestion;
