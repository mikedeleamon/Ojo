/**
 * RecapPage — the Weekly Wardrobe Recap screen (/account/recap).
 * Renders the cards recapEngine builds from the last 7 days of outfit history.
 * Reached from Settings, the ojo://recap deep link, and the weekly recap
 * notification. Copy + selection rules live in WEEKLY_RECAP_TEMPLATES.md.
 */

import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, ScrollView, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { View, Text, Pressable, GlassCard } from '../../components/primitives';
import Loading from '../../components/Loading/Loading';
import ShareToInstagramSheet from '../../components/ShareCard/ShareToInstagramSheet';
import RecapShareCard from '../../components/ShareCard/RecapShareCard';
import { useClosets } from '../../hooks/useClosets';
import { useTheme } from '../../theme/ThemeContext';
import { ColorTokens, spacing, radius, fonts, fontSizes, fontWeights } from '../../theme/tokens';
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

// ─── Styles ───────────────────────────────────────────────────────────────────

const makeStyles = (colors: ColorTokens) => StyleSheet.create({
  root:    { flex: 1, backgroundColor: colors.bgDefault },
  content: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xl },
  card: {
    backgroundColor: colors.glassBg,
    borderWidth:     1,
    borderColor:     colors.glassBorder,
    borderRadius:    radius.md,
    paddingVertical:   spacing.md,
    paddingHorizontal: spacing.md,
    gap: 6,
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
        {cards.map(card => (
          <GlassCard key={card.templateId} style={st.card}>
            {SECTION_LABELS[card.section] && (
              <Text style={st.eyebrow}>{SECTION_LABELS[card.section]}</Text>
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
        ))}

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
