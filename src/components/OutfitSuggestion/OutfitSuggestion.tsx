import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import {
    ScrollView,
    Image,
    Pressable,
    useWindowDimensions,
    Animated as RNAnimated,
    Easing as RNEasing,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { Svg, Circle } from 'react-native-svg';
import { View, Text } from '../primitives';
import { EmptyState } from '../shared';
import { useClosets } from '../../hooks/useClosets';
import { useAppNavigation } from '../../hooks/useAppNavigation';
import {
    generateOutfits,
    OutfitRole,
    OutfitSlot,
    OutfitResult,
    ScoreBreakdown,
    articleZoneLabel,
} from '../../lib/outfitEngine';
import { addHistoryEntry, recentlyWornWithAge } from '../../lib/outfitHistory';
import { updatePreferences } from '../../lib/userPreferences';
import {
    ClothingArticle,
    CurrentWeather,
    Forecast,
    Settings,
} from '../../types';
import { spacing } from '../../theme/tokens';
import { useTheme } from '../../theme/ThemeContext';
import { CSS_COLORS, ROLE_LABELS, BREAKDOWN_LABELS, REMOVABLE_ROLES } from './constants';
import {
    outfitTabSubtitle,
    whyThisOutfit,
    weatherAwareAddClothesBody,
    weatherAwareInsufficientBody,
} from './copy';
import { HangerIcon } from './HangerIcon';
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
        <View style={styles.articleCard}>
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
        </View>
    );
};

const ScoreBadge = ({ score }: { score: number }) => {
    const { colors } = useTheme();
    const styles = useMemo(() => makeStyles(colors), [colors]);
    const color =
        score >= 80
            ? 'rgba(52,211,153,0.9)'
            : score >= 60
              ? 'rgba(251,191,36,0.9)'
              : 'rgba(148,163,184,0.9)';
    return (
        <View style={[styles.scoreBadge, { borderColor: color }]}>
            <Text style={[styles.scoreBadgeText, { color }]}>
                Outfit Score: {score}
            </Text>
        </View>
    );
};

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
    weather: CurrentWeather;
    settings: Settings;
    forecasts: Forecast[];
}

const OutfitSuggestion = ({ weather, settings, forecasts }: Props) => {
    const { colors } = useTheme();
    const styles = useMemo(() => makeStyles(colors), [colors]);
    const { closets, loading, preferred, setPreferred, setClosets } =
        useClosets();
    const [settingPref, setSettingPref] = useState(false);
    const [activeIdx, setActiveIdx] = useState(0);
    const [showBreakdown, setShowBreakdown] = useState(false);
    const [wornLogged, setWornLogged] = useState(false);
    const [worn, setWorn] = useState<Map<string, number>>(new Map());
    const [removedByOutfit, setRemovedByOutfit] = useState<Map<number, Set<string>>>(new Map());
    const nav = useAppNavigation();

    // ─── #5: Swipe hint bounce (first render only) ──────────────────────────
    const hintAnim = useRef(new RNAnimated.Value(0)).current;
    const hintFired = useRef(false);

    // ─── #8: Haptic + green glow on "Wore this today" ──────────────────────
    const glowAnim = useRef(new RNAnimated.Value(0)).current;

    // ─── Pager ───────────────────────────────────────────────────────────────
    const { width: windowWidth } = useWindowDimensions();
    const cardWidth = windowWidth - spacing.md * 4.1;
    const pagerRef = useRef<ScrollView>(null);

    useEffect(() => {
        recentlyWornWithAge(7).then(setWorn);
    }, []);

    useEffect(() => {
        setActiveIdx(0);
        setShowBreakdown(false);
        setWornLogged(false);
        setRemovedByOutfit(new Map());
    }, [settings]);

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
            settings,
            worn,
            3,
            undefined,
            forecasts,
        );
        return { outfits: results, status };
    }, [preferred, weather, settings, worn, forecasts]);

    const safeIdx = Math.min(activeIdx, Math.max(0, outfits.length - 1));
    const activeOutfit: OutfitResult | null = outfits[safeIdx] ?? null;

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

    const activeSlots = activeOutfit?.slots.filter(
        (s) => !removedIds.has(s.article._id),
    ) ?? [];

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

    const handleWoreThis = async () => {
        if (!preferred || !activeOutfit || activeOutfit.status !== 'ok') return;
        // #8 — haptic pulse
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
        const articles = activeSlots.map((s) => s.article);
        await addHistoryEntry({
            closetId: preferred._id,
            closetName: preferred.name,
            articleIds: articles.map((a) => a._id),
            articleSummary: articles.map((a) => a.name || a.clothingType).join(', '),
        });
        await updatePreferences(articles);
        setWornLogged(true);
        // #8 — green glow animation
        glowAnim.setValue(0);
        RNAnimated.sequence([
            RNAnimated.timing(glowAnim, { toValue: 1, duration: 300, useNativeDriver: false }),
            RNAnimated.timing(glowAnim, { toValue: 0, duration: 800, useNativeDriver: false }),
        ]).start();
        setTimeout(() => setWornLogged(false), 3000);
    };

    // Scroll the pager programmatically when activeIdx changes via dot taps or resets
    useEffect(() => {
        pagerRef.current?.scrollTo({ x: safeIdx * cardWidth, animated: true });
    }, [safeIdx, cardWidth]);

    // #5 — Fire a subtle swipe-hint bounce once after outfits appear
    useEffect(() => {
        if (hintFired.current || outfits.length <= 1) return;
        hintFired.current = true;
        const timer = setTimeout(() => {
            RNAnimated.sequence([
                RNAnimated.timing(hintAnim, { toValue: 1, duration: 350, easing: RNEasing.out(RNEasing.cubic), useNativeDriver: true }),
                RNAnimated.timing(hintAnim, { toValue: 0, duration: 450, easing: RNEasing.inOut(RNEasing.cubic), useNativeDriver: true }),
            ]).start();
        }, 800);
        return () => clearTimeout(timer);
    }, [outfits.length]);

    if (loading) return null;

    if (closets.length === 0)
        return (
            <EmptyState
                icon={<HangerIcon size={32} />}
                title='No closet yet'
                body='Create a closet and add your clothes to get outfit suggestions.'
                action={
                    <Pressable
                        style={styles.ctaBtn}
                        onPress={() => nav.push('Closet')}
                    >
                        <Text style={styles.ctaBtnText}>Create closet</Text>
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
                    onPress={() => nav.push('Closet')}
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
                            onPress={() => nav.push('Closet')}
                        >
                            <Text style={styles.ctaBtnText}>Add clothes</Text>
                        </Pressable>
                    }
                />
            </View>
        );

    if (!activeOutfit) return null;

    // #5 — Swipe hint: translate the pager slightly left, then snap back
    const hintTranslateX = hintAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [0, -28],
    });

    // #8 — Green glow interpolation for "Wore this today"
    const glowBorderColor = glowAnim.interpolate({
        inputRange: [0, 1],
        outputRange: ['rgba(52,211,153,0)', 'rgba(52,211,153,0.65)'],
    });
    const glowShadowOpacity = glowAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [0, 0.35],
    });

    // #10 — Why this outfit explanation
    const whyExplanation = activeOutfit ? whyThisOutfit(activeOutfit.scoreBreakdown) : null;

    // #4 — Reset outfit undo
    const handleResetOutfit = () => {
        setRemovedByOutfit((prev) => {
            const next = new Map(prev);
            next.delete(safeIdx);
            return next;
        });
    };

    return (
        <View style={styles.root}>
            {/* ── Header ── */}
            <View style={styles.header}>
                <PreferredBadge
                    name={preferred.name}
                    onPress={() => nav.push('Closet')}
                />
                <ScoreBadge score={activeOutfit.score} />
            </View>

            {/* #2 — Headline above pager */}
            <Text style={styles.headline}>{activeOutfit.headline}</Text>

            {/* #10 — Why this outfit explanation */}
            {whyExplanation && (
                <Text style={styles.whyText}>{whyExplanation}</Text>
            )}

            {/* ── Outfit pager with #5 swipe hint bounce ── */}
            <RNAnimated.View style={{ transform: [{ translateX: hintTranslateX }] }}>
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
                            setWornLogged(false);
                            setShowBreakdown(false);
                        }
                    }}
                >
                    {outfits.map((outfit, i) => {
                        const cardRemovedIds = removedByOutfit.get(i) ?? new Set<string>();
                        return (
                            <View
                                key={i}
                                style={[styles.pagerCard, { width: cardWidth }]}
                            >
                                <View style={styles.pagerCardArticles}>
                                    {outfit.slots
                                        .filter((s) => !cardRemovedIds.has(s.article._id))
                                        .map((slot, j) => (
                                            <ArticleThumb
                                                key={j}
                                                article={slot.article}
                                                role={slot.role}
                                                onRemove={
                                                    REMOVABLE_ROLES.includes(slot.role)
                                                        ? () => handleRemoveSlot(i, slot.article._id)
                                                        : undefined
                                                }
                                            />
                                        ))}
                                </View>
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

            {/* ── Page dots (also tappable) + #4 reset undo ── */}
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
                                    setWornLogged(false);
                                    setShowBreakdown(false);
                                }}
                            />
                        ))}
                    </View>
                )}
                {removedIds.size > 0 && (
                    <Pressable onPress={handleResetOutfit} style={styles.resetLink}>
                        <Text style={styles.resetLinkText}>Reset outfit</Text>
                    </Pressable>
                )}
            </View>

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
                        <View
                            key={key}
                            style={styles.breakdownItem}
                        >
                            <Text style={styles.breakdownLabel}>{label}</Text>
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
                        <Text
                            key={i}
                            style={styles.note}
                        >
                            · {n}
                        </Text>
                    ))}
                </View>
            )}

            {/* ── Layering recommendation ── */}
            {showLayering && filteredLayering && (
                <LayeringSection layering={filteredLayering} />
            )}

            {/* ── #8: Wore this today with haptic + green glow ── */}
            <RNAnimated.View style={[
                styles.woreThisGlow,
                {
                    borderColor: glowBorderColor,
                    shadowColor: 'rgba(52,211,153,1)',
                    shadowOpacity: glowShadowOpacity as any,
                },
            ]}>
                <Pressable
                    style={[
                        styles.woreThisBtn,
                        wornLogged && styles.woreThisLogged,
                    ]}
                    onPress={handleWoreThis}
                    disabled={wornLogged}
                >
                    <Text
                        style={[
                            styles.woreThisText,
                            wornLogged && styles.woreThisTextLogged,
                        ]}
                    >
                        {wornLogged ? '✓ Logged!' : '⏱ Wore this today'}
                    </Text>
                </Pressable>
            </RNAnimated.View>
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
