import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  ScrollView,
  Image,
  Pressable,
  Alert,
  Share,
  Linking,
  Animated,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Svg, Circle } from 'react-native-svg';
import { useFocusEffect } from 'expo-router';
import { View, Text, GlassCard, GlassGroup } from '../../components/primitives';
import Loading from '../../components/Loading/Loading';
import { useClosets } from '../../hooks/useClosets';
import { useTabBarPadding } from '../../hooks/useTabBarPadding';
import { useTheme } from '../../theme/ThemeContext';
import { spacing, fonts, fontSizes, weatherGradients } from '../../theme/tokens';
import { loadHistory } from '../../lib/outfitHistory';
import { loadPreferences } from '../../lib/userPreferences';
import {
  computeInsights,
  InsightsData,
  ArticleInsight,
  formatCPW,
  formatValue,
  dormantLabel,
  SLEEPING_THRESHOLD,
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

// ─── Constants ────────────────────────────────────────────────────────────────

const SWATCH: Record<string, string> = {
  Black: '#1a1a1a', White: '#f0f0f0', Grey: '#9ca3af', Brown: '#92400e',
  Beige: '#d4b896', Cream: '#fef3c7', Silver: '#c0c0c0', Gold: '#d4af37',
  'Rose Gold': '#c9776a', Champagne: '#f4e4c1', Navy: '#1e3a5f',
  Indigo: '#4338ca', Cobalt: '#2563eb', Blue: '#3b82f6', Teal: '#0d9488',
  Cyan: '#06b6d4', Green: '#22c55e', Mint: '#34d399', Lime: '#a3e635',
  Sage: '#86efac', Olive: '#65a30d', Khaki: '#a16207', Red: '#ef4444',
  Scarlet: '#f43f5e', Crimson: '#dc2626', Burgundy: '#9b1c1c',
  Orange: '#f97316', Coral: '#fb923c', Peach: '#fdba74', Rust: '#c2410c',
  Yellow: '#fbbf24', Purple: '#a855f7', Plum: '#7c3aed', Lilac: '#d8b4fe',
  Lavender: '#c4b5fd', Pink: '#f9a8d4', Rose: '#fb7185', Blush: '#fecdd3',
  Magenta: '#e879f9', 'Hot Pink': '#ec4899', Fuchsia: '#d946ef', Multi: '#888',
};

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
    <Text style={{ fontSize: size * 0.45 }}>👕</Text>
  </View>
);

// ─── Main component ───────────────────────────────────────────────────────────

export default function InsightsPage() {
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { closets, loading: closetsLoading } = useClosets();
  const tabPad = useTabBarPadding();

  const [data,          setData]          = useState<InsightsData | null>(null);
  const [loading,       setLoading]       = useState(true);
  const [donationQueue, setDonationQueue] = useState<string[]>([]);
  const [sleepExpanded, setSleepExpanded] = useState(false);
  const [donateExpanded, setDonateExpanded] = useState(false);

  // Animated ring value (0 → utilizationRate)
  const ringAnim = useRef(new Animated.Value(0)).current;

  const load = useCallback(async () => {
    if (closetsLoading) return;
    setLoading(true);
    try {
      // Empty wardrobe: skip the heavy compute and surface an empty state.
      if (closets.length === 0) {
        setData(null);
        return;
      }
      const [history, prefs, queue] = await Promise.all([
        loadHistory(),
        loadPreferences(),
        loadDonationQueue(),
      ]);
      const insights = await computeInsights(closets, history, prefs);
      setData(insights);
      setDonationQueue(queue);

      // Animate the ring in
      ringAnim.setValue(0);
      Animated.timing(ringAnim, {
        toValue: insights.health.utilizationRate,
        duration: 900,
        useNativeDriver: false,
      }).start();
    } finally {
      setLoading(false);
    }
  }, [closets, closetsLoading]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  // ── Donation helpers ──
  const handleAddDonation = async (articleId: string) => {
    await addToDonationQueue(articleId);
    setDonationQueue(q => q.includes(articleId) ? q : [...q, articleId]);
  };

  const handleRemoveDonation = async (articleId: string) => {
    await removeFromDonationQueue(articleId);
    setDonationQueue(q => q.filter(id => id !== articleId));
  };

  const handleMarkDonated = (insight: ArticleInsight) => {
    Alert.alert(
      'Mark as donated?',
      `This will remove "${articleLabel(insight)}" from your closet permanently.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove from closet',
          style: 'destructive',
          onPress: async () => {
            await removeFromDonationQueue(insight.article._id);
            setDonationQueue(q => q.filter(id => id !== insight.article._id));
            // Note: removeArticle is called from the closet hook —
            // navigate to Closet to complete, or wire useClosets here.
            // For now: notify user to remove from Closet tab.
            Alert.alert(
              'Removed from queue',
              'Open the Closet tab to delete the item from your wardrobe.',
            );
          },
        },
      ],
    );
  };

  const handleShareDonationList = async () => {
    if (!data) return;
    const items = data.sleeping.filter(i => donationQueue.includes(i.article._id));
    if (items.length === 0) return;
    const list = items
      .map((i, n) => `${n + 1}. ${articleLabel(i)}`)
      .join('\n');
    Share.share({ message: `My donation list:\n${list}` });
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
            <View style={{ alignItems: 'center', padding: spacing.lg, gap: spacing.sm }}>
              <Text style={{ fontSize: 36 }}>👕</Text>
              <Text style={[styles.ringPct, { fontSize: 18 }]}>Your insights are waiting</Text>
              <Text style={{
                fontFamily: fonts.body,
                fontSize: fontSizes.sm,
                color: colors.textSecondary,
                textAlign: 'center',
              }}>
                {closets.length === 0
                  ? 'Create a closet and add a few items to start seeing wardrobe utilization, cost-per-wear, and style patterns.'
                  : 'Add a few items to your closet to start seeing wardrobe utilization, cost-per-wear, and style patterns.'}
              </Text>
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
          <View style={styles.rangeChip}>
            <Text style={styles.rangeChipText}>Last 90 days</Text>
          </View>
        </View>

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
              <Text style={styles.statLabel}>worn this quarter</Text>
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

            {/* Top color pairs */}
            {colorPairs.slice(0, 3).map(({ pair, count }) => {
              const [a, b] = pair.split('|');
              return (
                <View key={pair} style={styles.pairRow}>
                  <View style={styles.pairSwatches}>
                    <View
                      style={[
                        styles.pairSwatch,
                        { backgroundColor: SWATCH[a] ?? colors.glassBg },
                      ]}
                    />
                    <View
                      style={[
                        styles.pairSwatch,
                        styles.pairSwatchRight,
                        { backgroundColor: SWATCH[b] ?? colors.glassBg },
                      ]}
                    />
                  </View>
                  <Text style={styles.pairLabel}>
                    {a} + {b}
                  </Text>
                  <Text style={styles.pairCount}>×{count}</Text>
                </View>
              );
            })}
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
                <Text style={styles.cpwEmoji}>✅</Text>
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
                  <Text style={styles.cpwEmoji}>⚠️</Text>
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

            {health.pricedCount < health.totalArticles && (
              <Text style={styles.cpwNudge}>
                {health.pricedCount} of {health.totalArticles} items have prices.
                Add prices when editing items to unlock more.
              </Text>
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
