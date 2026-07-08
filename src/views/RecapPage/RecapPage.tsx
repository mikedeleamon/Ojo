/**
 * RecapPage — the Weekly Wardrobe Recap screen (/account/recap).
 * Renders the cards recapEngine builds from the last 7 days of outfit history.
 * Reached from Settings, the ojo://recap deep link, and the weekly recap
 * notification. Copy + selection rules live in WEEKLY_RECAP_TEMPLATES.md.
 */

import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, ScrollView, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { View, Text, Image, Pressable, GlassCard } from '../../components/primitives';
import Loading from '../../components/Loading/Loading';
import ShareToInstagramSheet from '../../components/ShareCard/ShareToInstagramSheet';
import RecapShareCard from '../../components/ShareCard/RecapShareCard';
import { useClosets } from '../../hooks/useClosets';
import { useTheme } from '../../theme/ThemeContext';
import { ColorTokens, spacing, radius, fonts, fontSizes, fontWeights } from '../../theme/tokens';
import { CSS_COLORS } from '../../lib/colors/cssColors';
import { METALLIC_GRADIENTS, METALLIC_START, METALLIC_END } from '../../lib/colors/metallicGradients';
import { hapticSelection } from '../../lib/haptics';
import { getUserId } from '../../lib/auth';
import { loadHistory } from '../../lib/outfitHistory';
import { loadPlans } from '../../lib/tripStorage';
import { getGapSuggestions, GapType } from '../../lib/wardrobeGaps';
import { buildWeeklyRecap, isoWeekKey, RecapCard, RecapSection } from '../../lib/recapEngine';
import { loadShownBeforeWeek, recordShownTemplates } from '../../lib/recapStorage';
import { recapShareLink } from '../../lib/share/deepLinks';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const SECTION_LABELS: Partial<Record<RecapSection, string>> = {
  color:   'Color story',
  items:   'In the closet',
  habits:  'Patterns',
  context: 'This week',
};

/** One accent hue per section — gives the list visual rhythm instead of six
 *  identical glass tiles. Opener gets its own dark hero treatment below. */
const SECTION_ACCENT: Record<RecapSection, string> = {
  opener:  '#818CF8',
  color:   '#F472B6',
  items:   '#34D399',
  habits:  '#FBBF24',
  context: '#38BDF8',
  closer:  '#A78BFA',
};

const HERO_GRADIENT = ['#1E293B', '#0F172A'] as const;

/** Mirrors the Wardrobe Gap Card's Google Shopping CTA. */
const GAP_QUERIES: Record<GapType, string> = {
  missing_coat:       'winter coat',
  missing_jacket:     'light jacket',
  missing_boots:      'boots',
  missing_mid_layer:  'sweater mid layer',
  missing_rain_layer: 'rain jacket',
  missing_footwear:   'weather resistant shoes',
};

const shopUrl = (gapType: GapType): string =>
  `https://www.google.com/search?tbm=shop&q=${encodeURIComponent(GAP_QUERIES[gapType])}`;

// ─── Small sub-components ──────────────────────────────────────────────────────

/** Metallic gradient or flat CSS color swatch — mirrors ClosetView's ColorSwatch. */
const ColorDot = ({ name, style }: { name: string; style: object }) => {
  if (METALLIC_GRADIENTS[name]) {
    return (
      <LinearGradient
        colors={METALLIC_GRADIENTS[name]}
        start={METALLIC_START}
        end={METALLIC_END}
        style={style}
      />
    );
  }
  if (CSS_COLORS[name]) return <View style={[style, { backgroundColor: CSS_COLORS[name] }]} />;
  return null;
};

/** Garment thumbnail that quietly disappears on a broken/expired URL. */
const Thumb = ({ uri, style }: { uri: string; style: object }) => {
  const [errored, setErrored] = useState(false);
  if (errored) return null;
  return (
    <Image
      source={{ uri }}
      style={style}
      resizeMode='cover'
      onError={() => setErrored(true)}
    />
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const makeStyles = (colors: ColorTokens) => StyleSheet.create({
  root:    { flex: 1, backgroundColor: colors.bgDefault },
  content: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xl },

  // Hero opener — always dark + gradient, independent of light/dark theme, so
  // it pops as the one "big" card the way a Wrapped opener slide does.
  hero: {
    borderRadius: radius.lg,
    overflow:     'hidden',
    padding:      spacing.lg,
    gap:          4,
  },
  heroEyebrow: {
    fontFamily:    fonts.bodySemiBold,
    fontSize:      fontSizes.xs,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    color:         'rgba(255,255,255,0.6)',
  },
  heroStatValue: {
    fontFamily: fonts.display,
    fontSize:   64,
    lineHeight: 68,
    color:      '#FFFFFF',
    marginTop:  4,
  },
  heroStatLabel: {
    fontFamily:    fonts.bodyMedium,
    fontSize:      fontSizes.sm,
    color:         'rgba(255,255,255,0.65)',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  heroHeadline: {
    fontFamily: fonts.display,
    fontSize:   fontSizes.xl,
    color:      '#FFFFFF',
    marginTop:  8,
  },
  heroBody: {
    fontFamily: fonts.body,
    fontSize:   fontSizes.base,
    color:      'rgba(255,255,255,0.75)',
    lineHeight: fontSizes.base * 1.5,
  },

  // Regular section cards
  card: {
    backgroundColor: colors.glassBg,
    borderWidth:     1,
    borderColor:     colors.glassBorder,
    borderRadius:    radius.md,
    paddingVertical:   spacing.md,
    paddingHorizontal: spacing.md,
    gap: 6,
  },
  accentBar: {
    position: 'absolute',
    left:     0,
    top:      0,
    bottom:   0,
    width:    4,
  },
  headerRow: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
  },
  thumbWrap: {
    width:           40,
    height:          40,
    borderRadius:    10,
    overflow:        'hidden',
    backgroundColor: colors.glassBgStrong,
  },
  thumbImg: { width: '100%', height: '100%' },
  statRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing.sm,
  },
  statBlock: {
    flexDirection: 'row',
    alignItems:    'baseline',
    gap:           6,
  },
  statValue: {
    fontFamily: fonts.display,
    fontSize:   40,
    lineHeight: 42,
  },
  statLabel: {
    fontFamily:    fonts.bodyMedium,
    fontSize:      fontSizes.xs,
    color:         colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    maxWidth:      110,
  },
  swatchRow: { flexDirection: 'row', gap: 6 },
  swatchDot: {
    width:        18,
    height:       18,
    borderRadius: 9,
    borderWidth:  1,
    borderColor:  colors.glassBorder,
  },
  eyebrow: {
    fontFamily:    fonts.bodySemiBold,
    fontSize:      fontSizes.xs,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    color:         colors.textMuted,
  },
  headline: {
    fontFamily: fonts.display,
    fontSize:   fontSizes.xl,
    color:      colors.textPrimary,
  },
  body: {
    fontFamily: fonts.body,
    fontSize:   fontSizes.base,
    color:      colors.textSecondary,
    lineHeight: fontSizes.base * 1.5,
  },
  ctaBtn: {
    alignSelf:         'flex-start',
    marginTop:         spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical:   10,
    borderRadius:      999,
    backgroundColor:   colors.saveBtnBg,
  },
  ctaBtnText: {
    fontFamily: fonts.bodyMedium,
    fontSize:   fontSizes.sm,
    fontWeight: fontWeights.medium,
    color:      colors.saveBtnText,
  },
  weekLabel: {
    fontFamily: fonts.body,
    fontSize:   fontSizes.xs,
    color:      colors.textMuted,
    textAlign:  'center',
  },
});

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function RecapPage() {
  const { colors } = useTheme();
  const st = useMemo(() => makeStyles(colors), [colors]);
  const { closets, loading: closetsLoading } = useClosets();

  const [cards,     setCards]     = useState<RecapCard[] | null>(null);
  const [showShare, setShowShare] = useState(false);

  useEffect(() => {
    if (closetsLoading) return;
    let cancelled = false;
    (async () => {
      const now = new Date();
      const [history, plans, gaps, previouslyShown] = await Promise.all([
        loadHistory(),
        loadPlans(),
        getGapSuggestions(),
        loadShownBeforeWeek(isoWeekKey(now)),
      ]);
      const built = buildWeeklyRecap({
        closets, history, plans, gaps, now,
        seed: getUserId() ?? '',
        previouslyShown,
      });
      if (cancelled) return;
      setCards(built);
      // Persist what this week's recap showed so next week's cooldowns apply.
      recordShownTemplates(built.map(c => c.templateId), now).catch(() => {});
    })();
    return () => { cancelled = true; };
  }, [closets, closetsLoading]);

  if (cards === null) return <Loading />;

  const handleShop = (gapType: GapType) => {
    hapticSelection();
    Linking.openURL(shopUrl(gapType)).catch(() => {});
  };

  const handleShare = () => {
    hapticSelection();
    setShowShare(true);
  };

  return (
    <SafeAreaView style={st.root} edges={['bottom']}>
      <ScrollView contentContainerStyle={st.content}>
        {cards.map(card => {
          if (card.section === 'opener') {
            return (
              <View key={card.templateId} style={st.hero}>
                <LinearGradient
                  colors={HERO_GRADIENT}
                  style={StyleSheet.absoluteFillObject}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                />
                <Text style={st.heroEyebrow}>Weekly Recap</Text>
                {card.stat && (
                  <>
                    <Text style={st.heroStatValue}>{card.stat.value}</Text>
                    <Text style={st.heroStatLabel}>{card.stat.label}</Text>
                  </>
                )}
                <Text style={st.heroHeadline}>{card.headline}</Text>
                <Text style={st.heroBody}>{card.body}</Text>
              </View>
            );
          }

          const accent = SECTION_ACCENT[card.section];
          const label  = SECTION_LABELS[card.section];

          return (
            <GlassCard key={card.templateId} style={st.card}>
              <View style={[st.accentBar, { backgroundColor: accent }]} pointerEvents='none' />

              {(label || card.imageUrl) && (
                <View style={st.headerRow}>
                  {label ? <Text style={[st.eyebrow, { color: accent }]}>{label}</Text> : <View />}
                  {card.imageUrl && (
                    <View style={st.thumbWrap}>
                      <Thumb uri={card.imageUrl} style={st.thumbImg} />
                    </View>
                  )}
                </View>
              )}

              {(card.stat || card.colorNames) && (
                <View style={st.statRow}>
                  {card.stat && (
                    <View style={st.statBlock}>
                      <Text style={[st.statValue, { color: accent }]}>{card.stat.value}</Text>
                      <Text style={st.statLabel}>{card.stat.label}</Text>
                    </View>
                  )}
                  {card.colorNames && (
                    <View style={st.swatchRow}>
                      {card.colorNames.map(name => (
                        <ColorDot key={name} name={name} style={st.swatchDot} />
                      ))}
                    </View>
                  )}
                </View>
              )}

              <Text style={st.headline}>{card.headline}</Text>
              <Text style={st.body}>{card.body}</Text>

              {card.cta === 'shop' && card.gapType && (
                <Pressable
                  style={st.ctaBtn}
                  onPress={() => handleShop(card.gapType!)}
                  accessibilityRole='button'
                  accessibilityLabel='Shop suggestions'
                >
                  <Text style={st.ctaBtnText}>Shop suggestions</Text>
                </Pressable>
              )}

              {card.cta === 'share' && (
                <Pressable
                  style={st.ctaBtn}
                  onPress={handleShare}
                  accessibilityRole='button'
                  accessibilityLabel='Share your recap'
                >
                  <Text style={st.ctaBtnText}>📸  Share your recap</Text>
                </Pressable>
              )}
            </GlassCard>
          );
        })}

        <Text style={st.weekLabel}>{isoWeekKey(new Date())}</Text>
      </ScrollView>

      <ShareToInstagramSheet
        visible={showShare}
        onClose={() => setShowShare(false)}
        renderCard={ref => <RecapShareCard ref={ref} cards={cards} />}
        attributionURL={recapShareLink()}
      />
    </SafeAreaView>
  );
}
