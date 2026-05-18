import { useState, useMemo, useEffect, useRef } from 'react';
import {
    StyleSheet,
    ScrollView,
    Image,
    Pressable,
    useWindowDimensions,
} from 'react-native';
import { Svg, Path, Circle } from 'react-native-svg';
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
import { LayeringResult } from '../../lib/layeringEngine';
import { addHistoryEntry, recentlyWornWithAge } from '../../lib/outfitHistory';
import { updatePreferences } from '../../lib/userPreferences';
import {
    ClothingArticle,
    CurrentWeather,
    Forecast,
    Settings,
} from '../../types';
import {
    colors,
    fonts,
    fontSizes,
    fontWeights,
    spacing,
    radius,
} from '../../theme/tokens';

// ─── Constants ────────────────────────────────────────────────────────────────

const CSS_COLORS: Record<string, string> = {
    Black: '#1a1a1a',
    White: '#f5f5f5',
    Grey: '#9ca3af',
    Brown: '#92400e',
    Beige: '#d4b896',
    Cream: '#fef3c7',
    Silver: '#c0c0c0',
    Gold: '#d4af37',
    Bronze: '#a0785a',
    'Rose Gold': '#c9776a',
    Champagne: '#f4e4c1',
    Navy: '#1e3a5f',
    Indigo: '#4338ca',
    Cobalt: '#2563eb',
    Blue: '#3b82f6',
    'Electric Blue': '#0ea5e9',
    'Sky Blue': '#38bdf8',
    Periwinkle: '#a5b4fc',
    Teal: '#0d9488',
    Cyan: '#06b6d4',
    'Baby Blue': '#bae6fd',
    Green: '#22c55e',
    Mint: '#34d399',
    Lime: '#a3e635',
    Sage: '#86efac',
    Olive: '#65a30d',
    Khaki: '#a16207',
    Red: '#ef4444',
    Scarlet: '#f43f5e',
    Crimson: '#dc2626',
    Burgundy: '#9b1c1c',
    Orange: '#f97316',
    Coral: '#fb923c',
    Peach: '#fdba74',
    Rust: '#c2410c',
    Yellow: '#fbbf24',
    Purple: '#a855f7',
    Plum: '#7c3aed',
    Lilac: '#d8b4fe',
    Lavender: '#c4b5fd',
    Pink: '#f9a8d4',
    Rose: '#fb7185',
    'Dusty Rose': '#fda4af',
    Blush: '#fecdd3',
    Magenta: '#e879f9',
    'Hot Pink': '#ec4899',
    Fuchsia: '#d946ef',
};

const ROLE_LABELS: Record<OutfitRole, string> = {
    top: 'Top',
    bottom: 'Bottom',
    fullBody: 'Outfit',
    midLayer: 'Mid Layer',
    outerwear: 'Outerwear',
    footwear: 'Footwear',
    accessory: 'Extra',
};

const BREAKDOWN_LABELS: { key: keyof ScoreBreakdown; label: string }[] = [
    { key: 'fabric', label: 'Weather' },
    { key: 'color', label: 'Color' },
    { key: 'style', label: 'Style' },
    { key: 'simplicity', label: 'Simple' },
    { key: 'preference', label: 'You' },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

const HangerIcon = ({
    size = 24,
    color = colors.textSecondary,
}: {
    size?: number;
    color?: string;
}) => (
    <Svg
        width={size}
        height={size}
        viewBox='0 0 24 24'
        fill='none'
    >
        <Path
            d='M12 4a2 2 0 0 1 2 2c0 .74-.4 1.38-1 1.73V9l8 5.5A1 1 0 0 1 20 16H4a1 1 0 0 1-.99-1.5L11 9V7.73A2 2 0 0 1 12 4Z'
            stroke={color}
            strokeWidth={1.5}
            strokeLinecap='round'
            strokeLinejoin='round'
        />
    </Svg>
);

const REMOVABLE_ROLES: OutfitRole[] = ['midLayer', 'outerwear'];

const ArticleThumb = ({
    article,
    role,
    onRemove,
}: {
    article: ClothingArticle;
    role: OutfitRole;
    onRemove?: () => void;
}) => (
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

const ScoreBadge = ({ score }: { score: number }) => {
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

// ─── Layering section ─────────────────────────────────────────────────────────

const ConfidencePip = ({ value }: { value: number }) => {
    const pct = Math.round(value * 100);
    const col =
        pct >= 80
            ? 'rgba(52,211,153,0.85)'
            : pct >= 60
              ? 'rgba(251,191,36,0.85)'
              : 'rgba(148,163,184,0.75)';
    return (
        <View style={[layerStyles.confidencePip, { borderColor: col }]}>
            <Text style={[layerStyles.confidenceText, { color: col }]}>
                Confidence Score: {pct}%
            </Text>
        </View>
    );
};

const LAYER_TIERS: { key: keyof LayeringResult['layers']; label: string }[] = [
    { key: 'base', label: 'Base' },
    { key: 'mid', label: 'Mid' },
    { key: 'outer', label: 'Outer' },
];

const LayerRow = ({
    label,
    slot,
}: {
    label: string;
    slot: OutfitSlot | null;
}) => {
    if (!slot) return null;
    const name = slot.article.name || slot.article.clothingType;
    const dotColor = slot.article.color ? CSS_COLORS[slot.article.color] : null;
    return (
        <View style={layerStyles.layerRow}>
            <Text style={layerStyles.layerTierLabel}>{label}</Text>
            <View style={layerStyles.layerRowDivider} />
            {dotColor && (
                <View
                    style={[
                        layerStyles.layerDot,
                        { backgroundColor: dotColor },
                    ]}
                />
            )}
            <Text
                style={layerStyles.layerName}
                numberOfLines={1}
            >
                {name}
            </Text>
            {slot.article.fabricType ? (
                <Text style={layerStyles.layerFabric}>
                    {slot.article.fabricType}
                </Text>
            ) : null}
        </View>
    );
};

const LayeringSection = ({ layering }: { layering: LayeringResult }) => {
    const hasLayers =
        layering.layers.base || layering.layers.mid || layering.layers.outer;
    return (
        <View style={layerStyles.root}>
            <View style={layerStyles.header}>
                <Text style={layerStyles.title}>Layering</Text>
                <ConfidencePip value={layering.confidence} />
            </View>

            {hasLayers && (
                <View style={layerStyles.layerStack}>
                    {LAYER_TIERS.map(({ key, label }) => (
                        <LayerRow
                            key={key}
                            label={label}
                            slot={layering.layers[key]}
                        />
                    ))}
                </View>
            )}

            <Text style={layerStyles.recommendation}>
                {layering.recommendation}
            </Text>

            {layering.timeline && layering.timeline.length > 0 && (
                <View style={layerStyles.timeline}>
                    {layering.timeline.map((step, i) => (
                        <View
                            key={i}
                            style={layerStyles.timelineRow}
                        >
                            <Text style={layerStyles.timelineTime}>
                                {step.time}
                            </Text>
                            <View style={layerStyles.timelineDivider} />
                            <Text style={layerStyles.timelineAction}>
                                {step.action}
                            </Text>
                        </View>
                    ))}
                </View>
            )}
        </View>
    );
};

// ─── Outfit tab subtitle ──────────────────────────────────────────────────────

const outfitTabSubtitle = (outfit: OutfitResult): string => {
    const roles = outfit.slots.map((s) => s.role);
    if (roles.includes('outerwear')) return 'Layered up';
    if (roles.includes('midLayer')) return 'Mid layer';
    if (outfit.scoreBreakdown.preference >= 75) return 'Your style';
    if (outfit.scoreBreakdown.color >= 80) return 'Color match';
    if (outfit.scoreBreakdown.fabric >= 80) return 'Weather-perfect';
    return 'Light & clean';
};

// ─── Weather-aware copy helpers ───────────────────────────────────────────────

const weatherAwareAddClothesBody = (weather: CurrentWeather): string => {
    const tempF = weather.Temperature.Imperial.Value;
    const cond = weather.WeatherText.toLowerCase();
    if (
        cond.includes('rain') ||
        cond.includes('shower') ||
        cond.includes('drizzle')
    )
        return 'Add a rain jacket or waterproof layer to get started.';
    if (
        cond.includes('snow') ||
        cond.includes('blizzard') ||
        cond.includes('flurr')
    )
        return 'Add a winter coat or warm layers to get started.';
    if (cond.includes('thunder') || cond.includes('storm'))
        return 'Add a sturdy outer layer to get started.';
    if (tempF <= 40) return 'Add a coat or sweater to get started.';
    if (tempF >= 85) return 'Add some light, breathable pieces to get started.';
    return 'Add clothing articles to get outfit suggestions.';
};

const weatherAwareInsufficientBody = (weather: CurrentWeather): string => {
    const tempF = weather.Temperature.Imperial.Value;
    const cond = weather.WeatherText.toLowerCase();
    if (
        cond.includes('rain') ||
        cond.includes('shower') ||
        cond.includes('drizzle')
    )
        return 'Add a top, bottom, and a rain jacket to build an outfit.';
    if (cond.includes('snow') || cond.includes('blizzard'))
        return 'Add a top, bottom, and a warm coat to build a cold-weather outfit.';
    if (tempF <= 40)
        return 'Add a top and a bottom — a warm outer layer would help too.';
    return 'Add a top and a bottom (or a full-body piece) to get a suggestion.';
};

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
    weather: CurrentWeather;
    settings: Settings;
    forecasts: Forecast[];
}

const OutfitSuggestion = ({ weather, settings, forecasts }: Props) => {
    const { closets, loading, preferred, setPreferred, setClosets } =
        useClosets();
    const [settingPref, setSettingPref] = useState(false);
    const [activeIdx, setActiveIdx] = useState(0);
    const [showBreakdown, setShowBreakdown] = useState(false);
    const [wornLogged, setWornLogged] = useState(false);
    const [worn, setWorn] = useState<Map<string, number>>(new Map());
    const [removedByOutfit, setRemovedByOutfit] = useState<Map<number, Set<string>>>(new Map());
    const nav = useAppNavigation();

    // ─── Pager ───────────────────────────────────────────────────────────────
    // cardWidth = content area width.
    // The details card in WeatherHUD applies marginHorizontal + padding = spacing.md
    // on each side (×2 sides ×2 properties = spacing.md * 4.1 total horizontal space).
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
        const articles = activeSlots.map((s) => s.article);
        await addHistoryEntry({
            closetId: preferred._id,
            closetName: preferred.name,
            articleIds: articles.map((a) => a._id),
            articleSummary: articles.map((a) => a.name || a.clothingType).join(', '),
        });
        await updatePreferences(articles);
        setWornLogged(true);
        setTimeout(() => setWornLogged(false), 3000);
    };

    // Scroll the pager programmatically when activeIdx changes via dot taps or resets
    useEffect(() => {
        pagerRef.current?.scrollTo({ x: safeIdx * cardWidth, animated: true });
    }, [safeIdx, cardWidth]);

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

            {/* ── Outfit pager: swipe left/right to browse options ── */}
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

            {/* ── Page dots (also tappable) ── */}
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

            {/* ── Headline ── */}
            <Text style={styles.headline}>{activeOutfit.headline}</Text>

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

            {/* ── Wore this today ── */}
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
        </View>
    );
};

const PreferredBadge = ({
    name,
    onPress,
}: {
    name: string;
    onPress: () => void;
}) => (
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

export default OutfitSuggestion;

const styles = StyleSheet.create({
    root: { gap: spacing.sm },
    sectionLabel: {
        fontFamily: fonts.body,
        fontSize: fontSizes.xs,
        color: colors.textMuted,
        fontWeight: fontWeights.medium,
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    preferredBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingVertical: 5,
        paddingHorizontal: 10,
        backgroundColor: 'rgba(255,255,255,0.08)',
        borderRadius: radius.pill,
        borderWidth: 1,
        borderColor: colors.glassBorder,
    },
    preferredBadgeText: {
        fontFamily: fonts.body,
        fontSize: fontSizes.xs,
        color: colors.textSecondary,
    },
    scoreBadge: {
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: radius.pill,
        borderWidth: 1,
    },
    scoreBadgeText: {
        fontFamily: fonts.body,
        fontSize: fontSizes.sm,
        fontWeight: fontWeights.semibold,
    },
    // ─── Outfit pager ──────────────────────────────────────────────────────────
    pagerCard: {
        gap: spacing.sm,
        paddingBottom: 4,
    },
    pagerCardArticles: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing.sm,
        padding: spacing.sm,
        backgroundColor: 'rgba(255,255,255,0.04)',
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: colors.glassBorder,
    },
    pagerCardFooter: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 2,
    },
    pagerSubtitle: {
        fontFamily: fonts.body,
        fontSize: fontSizes.xs,
        color: colors.textMuted,
        fontStyle: 'italic',
    },
    // ─── Page dots ─────────────────────────────────────────────────────────────
    dots: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 6,
        paddingVertical: 2,
    },
    dot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: 'rgba(255,255,255,0.22)',
    },
    dotActive: {
        width: 18,
        height: 6,
        borderRadius: 3,
        backgroundColor: colors.textPrimary,
    },
    headline: {
        fontFamily: fonts.body,
        fontSize: fontSizes.sm,
        color: colors.textSecondary,
        lineHeight: fontSizes.sm * 1.5,
    },
    articleGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    articleCard: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        backgroundColor: 'rgba(255,255,255,0.06)',
        borderRadius: radius.sm,
        borderWidth: 1,
        borderColor: colors.glassBorder,
        padding: 8,
        flex: 1,
        minWidth: 140,
    },
    articleImg: {
        width: 44,
        height: 44,
        borderRadius: 8,
        backgroundColor: 'rgba(255,255,255,0.05)',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
    },
    articleImgFill: { width: 44, height: 44 },
    colorDot: {
        position: 'absolute',
        bottom: 2,
        right: 2,
        width: 8,
        height: 8,
        borderRadius: 4,
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.2)',
    },
    articleRemoveBtn: {
        padding: 4,
        marginLeft: 2,
    },
    articleRemoveText: {
        fontSize: 11,
        color: colors.textMuted,
        lineHeight: 14,
    },
    articleLabel: { flex: 1, gap: 2 },
    roleLabel: {
        fontFamily: fonts.body,
        fontSize: 10,
        color: colors.textMuted,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    articleName: {
        fontFamily: fonts.body,
        fontSize: fontSizes.xs,
        color: colors.textPrimary,
        fontWeight: fontWeights.medium,
    },
    articleMeta: {
        fontFamily: fonts.body,
        fontSize: 10,
        color: colors.textMuted,
    },
    breakdownToggle: { paddingVertical: 6, alignSelf: 'flex-start' },
    breakdownToggleText: {
        fontFamily: fonts.body,
        fontSize: fontSizes.xs,
        color: colors.textSecondary,
        textDecorationLine: 'underline',
    },
    breakdownRow: { gap: 6 },
    breakdownItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    breakdownLabel: {
        fontFamily: fonts.body,
        fontSize: 10,
        color: colors.textMuted,
        width: 46,
    },
    breakdownBarBg: {
        flex: 1,
        height: 4,
        backgroundColor: 'rgba(255,255,255,0.08)',
        borderRadius: 2,
        overflow: 'hidden',
    },
    breakdownBarFill: {
        height: 4,
        backgroundColor: colors.textSecondary,
        borderRadius: 2,
    },
    breakdownValue: {
        fontFamily: fonts.body,
        fontSize: 10,
        color: colors.textMuted,
        width: 24,
        textAlign: 'right',
    },
    notesList: { gap: 4 },
    note: {
        fontFamily: fonts.body,
        fontSize: fontSizes.xs,
        color: colors.textSecondary,
        lineHeight: fontSizes.xs * 1.5,
    },
    woreThisBtn: {
        marginTop: 4,
        paddingVertical: 10,
        paddingHorizontal: spacing.md,
        borderRadius: radius.sm,
        borderWidth: 1,
        borderColor: colors.glassBorder,
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.05)',
    },
    woreThisLogged: {
        borderColor: 'rgba(52,211,153,0.4)',
        backgroundColor: 'rgba(52,211,153,0.08)',
    },
    woreThisText: {
        fontFamily: fonts.body,
        fontSize: fontSizes.sm,
        color: colors.textSecondary,
    },
    woreThisTextLogged: { color: colors.successText },
    ctaBtn: {
        paddingVertical: 10,
        paddingHorizontal: spacing.md,
        backgroundColor: colors.saveBtnBg,
        borderRadius: radius.sm,
        alignItems: 'center',
        marginTop: 4,
    },
    ctaBtnText: {
        fontFamily: fonts.body,
        fontSize: fontSizes.sm,
        fontWeight: fontWeights.semibold,
        color: colors.saveBtnText,
    },
    closetPicker: { gap: 8, marginTop: 4 },
    closetPickBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        padding: spacing.sm,
        backgroundColor: colors.glassBg,
        borderRadius: radius.sm,
        borderWidth: 1,
        borderColor: colors.glassBorder,
    },
    closetPickName: {
        flex: 1,
        fontFamily: fonts.body,
        fontSize: fontSizes.base,
        color: colors.textPrimary,
    },
    closetPickCount: {
        fontFamily: fonts.body,
        fontSize: fontSizes.xs,
        color: colors.textMuted,
    },
});

// ─── Layering section styles ──────────────────────────────────────────────────

const layerStyles = StyleSheet.create({
    root: {
        gap: 8,
        paddingTop: 4,
        borderTopWidth: 1,
        borderTopColor: colors.glassBorder,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    title: {
        fontFamily: fonts.body,
        fontSize: fontSizes.xs,
        color: colors.textMuted,
        textTransform: 'uppercase',
        letterSpacing: 1,
        fontWeight: fontWeights.medium,
    },
    confidencePip: {
        paddingHorizontal: 7,
        paddingVertical: 2,
        borderRadius: radius.pill,
        borderWidth: 1,
    },
    confidenceText: {
        fontFamily: fonts.body,
        fontSize: 10,
        fontWeight: fontWeights.semibold,
    },
    layerStack: {
        gap: 4,
        paddingVertical: 4,
        paddingHorizontal: 10,
        backgroundColor: 'rgba(255,255,255,0.04)',
        borderRadius: radius.sm,
        borderWidth: 1,
        borderColor: colors.glassBorder,
    },
    layerRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    layerTierLabel: {
        fontFamily: fonts.body,
        fontSize: 10,
        color: colors.textMuted,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        width: 36,
    },
    layerRowDivider: {
        width: 1,
        height: 10,
        backgroundColor: colors.glassBorder,
    },
    layerDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.2)',
    },
    layerName: {
        fontFamily: fonts.body,
        fontSize: fontSizes.xs,
        color: colors.textPrimary,
        flex: 1,
    },
    layerFabric: {
        fontFamily: fonts.body,
        fontSize: 10,
        color: colors.textMuted,
    },
    recommendation: {
        fontFamily: fonts.body,
        fontSize: fontSizes.xs,
        color: colors.textSecondary,
        lineHeight: fontSizes.xs * 1.6,
    },
    timeline: { gap: 5, marginTop: 2 },
    timelineRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    timelineTime: {
        fontFamily: fonts.body,
        fontSize: 10,
        color: colors.textMuted,
        width: 68,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    timelineDivider: {
        width: 1,
        height: 10,
        backgroundColor: colors.glassBorder,
    },
    timelineAction: {
        fontFamily: fonts.body,
        fontSize: fontSizes.xs,
        color: colors.textSecondary,
        flex: 1,
    },
});
