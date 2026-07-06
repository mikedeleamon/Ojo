import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  ScrollView,
  Image,
  Pressable,
  Linking,
  Animated,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Svg, Circle, Path } from 'react-native-svg';
import { useFocusEffect } from 'expo-router';
import { View, Text, GlassCard, GlassGroup } from '../../components/primitives';
import { HangerIcon } from '../../components/shared/HangerIcon';
import Loading from '../../components/Loading/Loading';
import { useClosets } from '../../hooks/useClosets';
import { useTabBarPadding } from '../../hooks/useTabBarPadding';
import { useReduceMotion } from '../../hooks/useReduceMotion';
import { useAppNavigation } from '../../hooks/useAppNavigation';
import { useConfirm } from '../../components/ConfirmDialog';
import { hapticSelection, hapticSuccess } from '../../lib/haptics';
import { useTheme } from '../../theme/ThemeContext';
import { spacing, fonts, fontSizes, weatherGradients } from '../../theme/tokens';
import { loadHistory } from '../../lib/outfitHistory';
import {
  computeInsights,
  InsightsData,
  ArticleInsight,
  formatCPW,
  formatValue,
  dormantLabel,
} from '../../lib/insightsEngine';
import {
  loadDonationQueue,
  addToDonationQueue,
  removeFromDonationQueue,
} from '../../lib/donationQueue';
import { makeStyles } from './InsightsPage.styles';
import { CSS_COLORS } from '../../lib/colors/cssColors';
import {
  METALLIC_GRADIENTS,
  METALLIC_START,
  METALLIC_END,
} from '../../lib/colors/metallicGradients';
import { SWATCH } from './swatches';
import { ColorChord } from './ColorChord';
import { ColorPalette } from './ColorPalette';
import ShareToInstagramSheet from '../../components/ShareCard/ShareToInstagramSheet';
import DonationListShareCard from '../../components/ShareCard/DonationListShareCard';
import { donationShareLink } from '../../lib/share/deepLinks';

// ─── Constants ────────────────────────────────────────────────────────────────

const RING_R  = 58;
const RING_CIRC = 2 * Math.PI * RING_R;
const RING_SIZE = 140;

const SLEEPING_PREVIEW = 4;
const DONATION_PREVIEW = 4;

// ─── Helpers ──────────────────────────────────────────────────────────────────

const articleLabel = (insight: ArticleInsight): string =>
  insight.article.name ||
  insight.article.clothingType ||
  'Item';

const shopUrl = (message: string): string => {
  const query = encodeURIComponent(message.split('—')[0].trim());
  return `https://www.google.com/search?tbm=shop&q=${query}`;
};

// ─── Sub-components ───────────────────────────────────────────────────────────

const PlaceholderThumb = ({
  size,
  colors,
}: {
  size: number;
  colors: ReturnType<typeof useTheme>['colors'];
}) => (
  <View
    style={{
      width: size,
      height: size,
      alignItems: 'center',
      justifyContent: 'center',
    }}
  >
    <HangerIcon size={size * 0.5} color={colors.textMuted} decorative />
  </View>
);

// Cost-per-wear status glyphs — replace ✅/⚠️ emoji with on-brand tinted marks
// that match the app's green/amber semantic palette.
const BestGlyph = () => (
  <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
    <Circle cx={12} cy={12} r={10} stroke="#34d399" strokeWidth={1.6} />
    <Path
      d="M7.5 12.5l3 3 6-6.5"
      stroke="#34d399"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

const WarnGlyph = () => (
  <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
    <Path
      d="M12 3.5 2.5 20.5h19L12 3.5Z"
      stroke="#fbbf24"
      strokeWidth={1.6}
      strokeLinejoin="round"
    />
    <Path
      d="M12 10v4.5M12 17.6v.01"
      stroke="#fbbf24"
      strokeWidth={1.8}
      strokeLinecap="round"
    />
  </Svg>
);

// ─── Main component ───────────────────────────────────────────────────────────

const WINDOW_OPTIONS = [30, 90, 365] as const;
const windowLabel = (d: number): string =>
  d === 30 ? 'Last 30 days' : d === 90 ? 'Last 90 days' : 'Last year';
const activeStatLabel = (d: number): string =>
  d === 30 ? 'worn this month' : d === 90 ? 'worn this quarter' : 'worn this year';

export default function InsightsPage() {
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { closets, loading: closetsLoading, removeArticle } = useClosets();
  const tabPad = useTabBarPadding();
  const reduceMotion = useReduceMotion();
  const nav = useAppNavigation();
  const confirm = useConfirm();

  const [data,          setData]          = useState<InsightsData | null>(null);
  const [loading,       setLoading]       = useState(true);
  const [donationQueue, setDonationQueue] = useState<string[]>([]);
  const [sleepExpanded, setSleepExpanded] = useState(false);
  const [donateExpanded, setDonateExpanded] = useState(false);
  const [windowDays,    setWindowDays]    = useState<number>(90);
  const [showDonationShare, setShowDonationShare] = useState(false);

  // Animated ring value (0 → utilizationRate)
  const ringAnim = useRef(new Animated.Value(0)).current;
  // Tracks whether we've painted at least once, so refreshes stay silent.
  const hasLoaded = useRef(false);

  const load = useCallback(async () => {
    if (closetsLoading) return;
    // Only show the blocking spinner on the very first load; refreshes (focus,
    // donating an item, changing the time range) recompute silently in place.
    if (!hasLoaded.current) setLoading(true);
    try {
      // Empty wardrobe: skip the heavy compute and surface an empty state.
      if (closets.length === 0) {
        setData(null);
        hasLoaded.current = true;
        return;
      }
      const [history, queue] = await Promise.all([
        loadHistory(),
        loadDonationQueue(),
      ]);
      const insights = await computeInsights(closets, history, windowDays);
      setData(insights);
      setDonationQueue(queue);
      hasLoaded.current = true;

      // Animate the ring in — snap straight to the value under Reduce Motion.
      if (reduceMotion) {
        ringAnim.setValue(insights.health.utilizationRate);
      } else {
        ringAnim.setValue(0);
        Animated.timing(ringAnim, {
          toValue: insights.health.utilizationRate,
          duration: 900,
          useNativeDriver: false,
        }).start();
      }
    } finally {
      setLoading(false);
    }
  }, [closets, closetsLoading, windowDays, reduceMotion]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const cycleWindow = () => {
    hapticSelection();
    setWindowDays(d => {
      const idx = WINDOW_OPTIONS.indexOf(d as typeof WINDOW_OPTIONS[number]);
      return WINDOW_OPTIONS[(idx + 1) % WINDOW_OPTIONS.length];
    });
  };

  // ── Donation helpers ──
  const handleAddDonation = async (articleId: string) => {
    hapticSelection();
    await addToDonationQueue(articleId);
    setDonationQueue(q => q.includes(articleId) ? q : [...q, articleId]);
  };

  const handleRemoveDonation = async (articleId: string) => {
    await removeFromDonationQueue(articleId);
    setDonationQueue(q => q.filter(id => id !== articleId));
  };

  const handleMarkDonated = async (insight: ArticleInsight) => {
    const ok = await confirm({
      title: 'Mark as donated?',
      message: `This permanently removes "${articleLabel(insight)}" from your closet.`,
      confirmLabel: 'Remove from closet',
      destructive: true,
    });
    if (!ok) return;
    try {
      // Actually delete the garment from its closet, then clear the queue entry.
      // Mutating closets re-runs load() via the focus effect, so the item drops
      // out of every Insights list and the health counts update — no dead end.
      await removeArticle(insight.closetId, insight.article._id);
      await removeFromDonationQueue(insight.article._id);
      setDonationQueue(q => q.filter(id => id !== insight.article._id));
      hapticSuccess();
    } catch {
      // Leave the queue entry in place so the user can retry.
    }
  };

  const handleShareDonationList = () => {
    setShowDonationShare(true);
  };

  // ─────────────────────────────────────────────────────────────────────────
  if (loading || closetsLoading) return <Loading />;

  // Empty state — new user with no closet or zero articles
  if (!data || data.health.totalArticles === 0) {
    return (
      <SafeAreaView style={styles.root} edges={['top']}>
        <LinearGradient
          colors={[colors.bgDefault, weatherGradients.default[1], colors.bgDefault]}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
        />
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: tabPad }]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Insights</Text>
          </View>
          <GlassCard style={styles.healthCard}>
            <View style={{ alignItems: 'center', padding: spacing.lg, gap: spacing.md }}>
              <HangerIcon size={40} color={colors.textMuted} decorative />
              <Text style={[styles.ringPct, { fontSize: 18, textAlign: 'center' }]}>
                Your insights are waiting
              </Text>
              <Text style={{
                fontFamily: fonts.body,
                fontSize: fontSizes.base,
                color: colors.textSecondary,
                textAlign: 'center',
                lineHeight: fontSizes.base * 1.6,
              }}>
                {closets.length === 0
                  ? 'Create a closet and photograph your clothes to unlock wardrobe utilization, cost-per-wear, sleeping items, and colour palette analysis.'
                  : 'Add items to your closet to unlock wardrobe utilization, cost-per-wear, sleeping items, and colour palette analysis.'}
              </Text>
              <Pressable
                style={styles.ctaBtn}
                onPress={() => nav.push('/(tabs)/closet')}
              >
                <Text style={styles.ctaBtnText}>
                  {closets.length === 0 ? 'Create a closet' : 'Go to Closet'}
                </Text>
              </Pressable>
            </View>
          </GlassCard>
        </ScrollView>
      </SafeAreaView>
    );
  }

  const { health, styleDNA, topWorn, sleeping, colorPairs, gaps } = data;

  // Ring color based on utilization
  const ringColor =
    health.utilizationRate >= 0.7
      ? '#34d399'   // green
      : health.utilizationRate >= 0.4
      ? '#fbbf24'   // amber
      : '#f87171';  // red

  // Articles in the donation queue (with full insight data for display)
  const queuedInsights = data.articles.filter(i =>
    donationQueue.includes(i.article._id),
  );

  const sleepingVisible = sleepExpanded
    ? sleeping
    : sleeping.slice(0, SLEEPING_PREVIEW);

  const donationVisible = donateExpanded
    ? queuedInsights
    : queuedInsights.slice(0, DONATION_PREVIEW);

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      {/* Subtle gradient background — same approach as MainPage */}
      <LinearGradient
        colors={[colors.bgDefault, weatherGradients.default[1], colors.bgDefault]}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: tabPad }]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header ── */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Insights</Text>
          <Pressable
            style={styles.rangeChip}
            onPress={cycleWindow}
            accessibilityRole="button"
            accessibilityLabel={`Time range: ${windowLabel(windowDays)}. Tap to change.`}
          >
            <Text style={styles.rangeChipText}>{windowLabel(windowDays)}  ⌄</Text>
          </Pressable>
        </View>

        {/* ── Price backfill nudge — turns the silent CPW gate into an action ── */}
        {health.pricedCount < health.totalArticles && (
          <Pressable
            style={styles.priceNudge}
            onPress={() => nav.push('/account/price-backfill')}
            accessibilityRole="button"
            accessibilityLabel="Add prices to unlock cost-per-wear"
          >
            <Text style={styles.priceNudgeText}>
              {health.pricedCount === 0
                ? 'Add prices to unlock cost-per-wear analytics'
                : `${health.pricedCount} of ${health.totalArticles} items priced — add more`}
            </Text>
            <Text style={styles.priceNudgeCta}>Add →</Text>
          </Pressable>
        )}

        {/* ── Wardrobe Health ── */}
        <GlassCard style={styles.healthCard}>
          {/* Donut ring */}
          <View style={styles.ringWrap}>
            <Svg width={RING_SIZE} height={RING_SIZE}>
              {/* Track */}
              <Circle
                cx={RING_SIZE / 2}
                cy={RING_SIZE / 2}
                r={RING_R}
                stroke={colors.glassBorder}
                strokeWidth={10}
                fill="none"
              />
              {/* Progress — driven by Animated value via inline stroke calc */}
              <AnimatedRingArc
                cx={RING_SIZE / 2}
                cy={RING_SIZE / 2}
                r={RING_R}
                color={ringColor}
                animValue={ringAnim}
                circumference={RING_CIRC}
              />
            </Svg>
            <View style={styles.ringCenter}>
              <Text style={styles.ringPct}>
                {Math.round(health.utilizationRate * 100)}%
              </Text>
              <Text style={styles.ringLabel}>active</Text>
            </View>
          </View>

          {/* Stats column */}
          <View style={styles.healthStats}>
            <View style={styles.statRow}>
              <Text style={styles.statValue}>{health.totalArticles}</Text>
              <Text style={styles.statLabel}>total items</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statRow}>
              <Text style={styles.statValue}>{health.activeArticles}</Text>
              <Text style={styles.statLabel}>{activeStatLabel(windowDays)}</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statRow}>
              <Text style={styles.statValue}>{health.sleepingArticles}</Text>
              <Text style={styles.statLabel}>sleeping</Text>
            </View>
            {health.totalValue !== null && (
              <>
                <View style={styles.statDivider} />
                <View style={styles.statRow}>
                  <Text style={styles.statValue}>{formatValue(health.totalValue)}</Text>
                  <Text style={styles.statLabel}>wardrobe value</Text>
                </View>
              </>
            )}
          </View>
        </GlassCard>

        {/* ── Style DNA ── */}
        {styleDNA.level !== 'none' && (
          <GlassCard style={styles.dnaCard}>
            <View style={styles.dnaHeader}>
              <Text style={styles.dnaTitle}>Style DNA</Text>
              <View
                style={[
                  styles.dnaBadge,
                  styleDNA.level === 'learning' && styles.dnaBadgeLearning,
                ]}
              >
                <Text
                  style={[
                    styles.dnaBadgeText,
                    styleDNA.level === 'learning' && styles.dnaBadgeTextLearning,
                  ]}
                >
                  {styleDNA.level === 'active' ? '✦ Personalized' : 'Still learning'}
                </Text>
              </View>
            </View>

            {/* Top colors */}
            {styleDNA.topColors.length > 0 && (
              <View style={styles.colorRow}>
                {styleDNA.topColors.map(colorName => {
                  const hex = SWATCH[colorName];
                  const pct =
                    data.health.totalArticles > 0
                      ? Math.round(
                          ((data.articles.filter(
                            i => i.article.color === colorName,
                          ).length) /
                            data.health.totalArticles) *
                            100,
                        )
                      : 0;
                  return (
                    <View key={colorName} style={styles.colorItem}>
                      {METALLIC_GRADIENTS[colorName] ? (
                        <LinearGradient
                          colors={METALLIC_GRADIENTS[colorName]}
                          start={METALLIC_START}
                          end={METALLIC_END}
                          style={styles.colorSwatch}
                        />
                      ) : (
                        <View
                          style={[
                            styles.colorSwatch,
                            { backgroundColor: hex ?? colors.glassBg },
                          ]}
                        />
                      )}
                      <Text style={styles.colorName}>{colorName}</Text>
                      <Text style={styles.colorPct}>{pct}%</Text>
                    </View>
                  );
                })}
              </View>
            )}

            {/* Top fabric + category chips */}
            <View style={styles.tagRow}>
              {styleDNA.topFabric && (
                <View style={styles.tag}>
                  <Text style={styles.tagText}>{styleDNA.topFabric}</Text>
                </View>
              )}
              {styleDNA.topCategory && (
                <View style={styles.tag}>
                  <Text style={styles.tagText}>{styleDNA.topCategory}</Text>
                </View>
              )}
            </View>

            {/* Color pairings — chord diagram of most-worn combinations */}
            {colorPairs.length > 0 && (
              <View style={styles.chordSection}>
                <Text style={styles.sectionLabel}>Color Pairings</Text>
                <ColorChord
                  pairs={colorPairs}
                  colors={colors}
                  reduceMotion={reduceMotion}
                />
              </View>
            )}
          </GlassCard>
        )}

        {/* ── Color Palette — circle-pack of wardrobe colours ── */}
        {data.articles.length > 0 && (
          <GlassCard style={styles.paletteCard}>
            <Text style={styles.sectionLabel}>Color Palette</Text>
            <ColorPalette
              articles={data.articles}
              colors={colors}
              reduceMotion={reduceMotion}
            />
          </GlassCard>
        )}

        {/* ── Top Performers ── */}
        {topWorn.length > 0 && (
          <GlassCard style={styles.topWornCard}>
            <Text style={styles.sectionLabel}>Most Worn</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.topWornList}
            >
              {topWorn.map(insight => (
                <View key={insight.article._id} style={styles.topWornTile}>
                  <View style={styles.topWornImgWrap}>
                    {insight.article.imageUrl ? (
                      <Image
                        source={{ uri: insight.article.imageUrl }}
                        style={styles.topWornImg}
                        resizeMode="cover"
                      />
                    ) : (
                      <PlaceholderThumb size={80} colors={colors} />
                    )}
                    <View style={styles.topWornBadge}>
                      <Text style={styles.topWornBadgeText}>
                        ×{insight.totalWears}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.topWornName} numberOfLines={2}>
                    {articleLabel(insight)}
                  </Text>
                </View>
              ))}
            </ScrollView>
          </GlassCard>
        )}

        {/* ── Cost Per Wear ── */}
        {health.pricedCount > 0 && (
          <GlassCard style={styles.cpwCard}>
            <Text style={styles.sectionLabel}>Cost Per Wear</Text>

            {health.bestCPW && (
              <View style={styles.cpwRow}>
                <BestGlyph />
                <View style={styles.cpwThumb}>
                  {health.bestCPW.article.imageUrl ? (
                    <Image
                      source={{ uri: health.bestCPW.article.imageUrl }}
                      style={styles.cpwThumbImg}
                      resizeMode="cover"
                    />
                  ) : (
                    <PlaceholderThumb size={48} colors={colors} />
                  )}
                </View>
                <View style={styles.cpwInfo}>
                  <Text style={styles.cpwName} numberOfLines={1}>
                    {articleLabel(health.bestCPW)}
                  </Text>
                  <Text style={styles.cpwValue}>
                    {formatCPW(health.bestCPW.costPerWear!)} · best value
                  </Text>
                </View>
              </View>
            )}

            {health.worstCPW &&
              health.worstCPW.article._id !== health.bestCPW?.article._id && (
                <View style={styles.cpwRow}>
                  <WarnGlyph />
                  <View style={styles.cpwThumb}>
                    {health.worstCPW.article.imageUrl ? (
                      <Image
                        source={{ uri: health.worstCPW.article.imageUrl }}
                        style={styles.cpwThumbImg}
                        resizeMode="cover"
                      />
                    ) : (
                      <PlaceholderThumb size={48} colors={colors} />
                    )}
                  </View>
                  <View style={styles.cpwInfo}>
                    <Text style={styles.cpwName} numberOfLines={1}>
                      {articleLabel(health.worstCPW)}
                    </Text>
                    <Text style={styles.cpwValue}>
                      {formatCPW(health.worstCPW.costPerWear!)} · least worn
                    </Text>
                  </View>
                </View>
              )}

          </GlassCard>
        )}

        {/* ── Sleeping Items + Donation Queue — merged GlassGroup ── */}
        <GlassGroup spacing={8}>
          {/* Sleeping Items */}
          {sleeping.length > 0 && (
            <GlassCard style={styles.itemCard}>
              <View style={styles.itemCardHeader}>
                <Text style={styles.itemCardTitle}>Sleeping Items</Text>
                <View style={styles.countBadge}>
                  <Text style={styles.countBadgeText}>{sleeping.length}</Text>
                </View>
              </View>

              {sleepingVisible.map((insight, idx) => {
                const inQueue = donationQueue.includes(insight.article._id);
                return (
                  <View key={insight.article._id}>
                    {idx > 0 && <View style={styles.divider} />}
                    <View style={styles.itemRow}>
                      <View style={styles.itemThumb}>
                        {insight.article.imageUrl ? (
                          <Image
                            source={{ uri: insight.article.imageUrl }}
                            style={styles.itemThumbImg}
                            resizeMode="cover"
                          />
                        ) : (
                          <PlaceholderThumb size={52} colors={colors} />
                        )}
                      </View>
                      <View style={styles.itemInfo}>
                        <Text style={styles.itemName} numberOfLines={1}>
                          {articleLabel(insight)}
                        </Text>
                        <Text style={styles.itemSub}>
                          {dormantLabel(insight.daysSinceWorn)}
                          {insight.article.clothingType
                            ? ` · ${insight.article.clothingType}`
                            : ''}
                        </Text>
                      </View>
                      <View style={styles.itemActions}>
                        {!inQueue ? (
                          <Pressable
                            style={styles.actionChip}
                            onPress={() => handleAddDonation(insight.article._id)}
                            accessibilityLabel={`Add ${articleLabel(insight)} to donation queue`}
                          >
                            <Text style={styles.actionChipText}>Donate</Text>
                          </Pressable>
                        ) : (
                          <View style={[styles.actionChip, styles.actionChipSuccess]}>
                            <Text style={[styles.actionChipText, styles.actionChipSuccessText]}>
                              Queued
                            </Text>
                          </View>
                        )}
                      </View>
                    </View>
                  </View>
                );
              })}

              {sleeping.length > SLEEPING_PREVIEW && (
                <Pressable
                  style={styles.showMoreBtn}
                  onPress={() => setSleepExpanded(e => !e)}
                >
                  <Text style={styles.showMoreText}>
                    {sleepExpanded
                      ? 'Show less'
                      : `Show ${sleeping.length - SLEEPING_PREVIEW} more`}
                  </Text>
                </Pressable>
              )}
            </GlassCard>
          )}

          {/* Donation Queue */}
          <GlassCard style={styles.itemCard}>
            <View style={styles.itemCardHeader}>
              <Text style={styles.itemCardTitle}>Donation Queue</Text>
              {queuedInsights.length > 0 && (
                <View style={styles.countBadge}>
                  <Text style={styles.countBadgeText}>{queuedInsights.length}</Text>
                </View>
              )}
            </View>

            {queuedInsights.length === 0 ? (
              <Text style={styles.emptyText}>
                Items you mark for donation appear here.
              </Text>
            ) : (
              <>
                {donationVisible.map((insight, idx) => (
                  <View key={insight.article._id}>
                    {idx > 0 && <View style={styles.divider} />}
                    <View style={styles.itemRow}>
                      <View style={styles.itemThumb}>
                        {insight.article.imageUrl ? (
                          <Image
                            source={{ uri: insight.article.imageUrl }}
                            style={styles.itemThumbImg}
                            resizeMode="cover"
                          />
                        ) : (
                          <PlaceholderThumb size={52} colors={colors} />
                        )}
                      </View>
                      <View style={styles.itemInfo}>
                        <Text style={styles.itemName} numberOfLines={1}>
                          {articleLabel(insight)}
                        </Text>
                        <Text style={styles.itemSub}>
                          {dormantLabel(insight.daysSinceWorn)}
                        </Text>
                      </View>
                      <View style={styles.itemActions}>
                        <Pressable
                          style={styles.actionChip}
                          onPress={() => handleRemoveDonation(insight.article._id)}
                          accessibilityLabel={`Remove ${articleLabel(insight)} from donation queue`}
                        >
                          <Text style={styles.actionChipText}>Remove</Text>
                        </Pressable>
                        <Pressable
                          style={[styles.actionChip, styles.actionChipDanger]}
                          onPress={() => handleMarkDonated(insight)}
                          accessibilityLabel={`Mark ${articleLabel(insight)} as donated`}
                        >
                          <Text style={[styles.actionChipText, styles.actionChipDangerText]}>
                            Donated
                          </Text>
                        </Pressable>
                      </View>
                    </View>
                  </View>
                ))}

                {queuedInsights.length > DONATION_PREVIEW && (
                  <Pressable
                    style={styles.showMoreBtn}
                    onPress={() => setDonateExpanded(e => !e)}
                  >
                    <Text style={styles.showMoreText}>
                      {donateExpanded
                        ? 'Show less'
                        : `Show ${queuedInsights.length - DONATION_PREVIEW} more`}
                    </Text>
                  </Pressable>
                )}

                <Pressable
                  style={styles.shareBtn}
                  onPress={handleShareDonationList}
                  accessibilityLabel="Share donation list"
                >
                  <Text style={styles.shareBtnText}>Share donation list</Text>
                </Pressable>
              </>
            )}
          </GlassCard>
        </GlassGroup>

        {/* ── Wardrobe Gaps ── */}
        {gaps.length > 0 && (
          <GlassCard style={styles.gapsCard}>
            <Text style={styles.sectionLabel}>Wardrobe Gaps</Text>
            {gaps.map((gap, idx) => (
              <View key={gap.type}>
                {idx > 0 && <View style={styles.divider} />}
                <View style={styles.gapRow}>
                  <Text style={styles.gapMsg}>{gap.message}</Text>
                  <Pressable
                    style={styles.gapShopBtn}
                    onPress={() => Linking.openURL(shopUrl(gap.message))}
                    accessibilityLabel={`Shop for ${gap.type.replace(/_/g, ' ')}`}
                  >
                    <Text style={styles.gapShopBtnText}>Shop →</Text>
                  </Pressable>
                </View>
              </View>
            ))}
          </GlassCard>
        )}
      </ScrollView>

      {showDonationShare && (
        <ShareToInstagramSheet
          visible
          onClose={() => setShowDonationShare(false)}
          renderCard={(cardRef) => (
            <DonationListShareCard ref={cardRef} items={queuedInsights} />
          )}
          attributionURL={donationShareLink()}
        />
      )}
    </SafeAreaView>
  );
}

// ─── Animated ring arc ────────────────────────────────────────────────────────
// Wraps the SVG Circle in a JS-driven animation so strokeDashoffset transitions
// smoothly on load without needing Reanimated SVG bindings.

interface ArcProps {
  cx: number;
  cy: number;
  r: number;
  color: string;
  animValue: Animated.Value;
  circumference: number;
}

function AnimatedRingArc({ cx, cy, r, color, animValue, circumference }: ArcProps) {
  const [offset, setOffset] = useState(circumference);

  useEffect(() => {
    const id = animValue.addListener(({ value }) => {
      setOffset(circumference * (1 - value));
    });
    return () => animValue.removeListener(id);
  }, [animValue, circumference]);

  return (
    <Circle
      cx={cx}
      cy={cy}
      r={r}
      stroke={color}
      strokeWidth={10}
      fill="none"
      strokeDasharray={circumference}
      strokeDashoffset={offset}
      strokeLinecap="round"
      rotation={-90}
      origin={`${cx}, ${cy}`}
    />
  );
}
