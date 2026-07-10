/**
 * RecapPage — the Weekly Wardrobe Recap screen (/account/recap), redesigned
 * (2026-07) as a Spotify-Wrapped-style vertical report on its own always-dark
 * surface. recapEngine picks the deck from the last 7 days; this screen maps
 * each template to a section renderer (Hero, Color Story, cream MVP, All-time,
 * Travel, Wrapped) and falls back to a generic dark card for the rest.
 *
 * Reached from Settings, the ojo://recap deep link, and the weekly recap
 * notification. Copy + selection rules live in WEEKLY_RECAP_TEMPLATES.md.
 *
 * Dev-only: /account/recap?demo=1 renders the spec's sample week (recapDemo).
 */

import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Linking, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path } from 'react-native-svg';
import { View, Text, Image, Pressable } from '../../components/primitives';
import OjoLogo from '../../components/OjoLogo';
import ShareToInstagramSheet from '../../components/ShareCard/ShareToInstagramSheet';
import RecapShareCard from '../../components/ShareCard/RecapShareCard';
import RecapGradientBackground, { useRecapGradientCycle } from '../../components/recap/RecapGradientBackground';
import RecapColorBar from '../../components/recap/RecapColorBar';
import { RhythmStrip, MilestoneMeter, MvpCard } from './RecapParts';
import st from './RecapPage.styles';
import { useClosets } from '../../hooks/useClosets';
import { RECAP_PALETTE as P, RECAP_ACCENT, recapSwatchHex } from '../../lib/recapVisuals';
import { hapticSelection } from '../../lib/haptics';
import { getUserId } from '../../lib/auth';
import { loadHistory } from '../../lib/outfitHistory';
import { loadPlans } from '../../lib/tripStorage';
import { getGapSuggestions, GapType } from '../../lib/wardrobeGaps';
import { buildRecap, isoWeekKey, RecapCard, RecapWeekMeta, RecapSection } from '../../lib/recapEngine';
import { loadShownBeforeWeek, recordShownTemplates } from '../../lib/recapStorage';
import { recapShareLink } from '../../lib/share/deepLinks';
import { DEMO_RECAP } from './recapDemo';

// ─── Shop CTA (unchanged from the prior recap) ─────────────────────────────────

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

/** Eyebrow label per section for the generic dark card. */
const SECTION_LABELS: Partial<Record<RecapSection, string>> = {
  color:   'Color story',
  items:   'In the closet',
  habits:  'Patterns',
  context: 'This week',
};

type Data = { cards: RecapCard[]; meta: RecapWeekMeta };

// ─── Nav icons ────────────────────────────────────────────────────────────────

const BackIcon = () => (
  <Svg width={17} height={17} viewBox='0 0 18 18' fill='none'>
    <Path d='M11 14l-5-5 5-5' stroke={P.text} strokeWidth={1.6} strokeLinecap='round' strokeLinejoin='round' />
  </Svg>
);
const ShareIcon = () => (
  <Svg width={16} height={16} viewBox='0 0 18 18' fill='none'>
    <Path d='M9 12V3M9 3L6 6M9 3l3 3M4 11v3a1 1 0 001 1h8a1 1 0 001-1v-3'
      stroke={P.text} strokeWidth={1.5} strokeLinecap='round' strokeLinejoin='round' />
  </Svg>
);

// ─── Section renderers ────────────────────────────────────────────────────────

const HeroCard = ({ card, meta }: { card: RecapCard; meta: RecapWeekMeta }) => (
  <View style={sx.hero}>
    {meta.outfitsThisWeek > 0 && (
      <View style={st.heroNumberRow}>
        <Text style={st.heroNumber} maxFontSizeMultiplier={1.1} numberOfLines={1}>
          {meta.outfitsThisWeek}
        </Text>
        <Text style={[st.serifItalic, { marginBottom: 12 }]}>{'outfits\nlogged'}</Text>
      </View>
    )}
    <Text style={st.heroHeadline}>{card.headline}</Text>
    <Text style={[st.body, { marginTop: 6 }]}>{card.body}</Text>
    {meta.outfitsThisWeek > 0 && <RhythmStrip daily={meta.daily} />}
  </View>
);

const ColorStoryCard = ({ card, meta }: { card: RecapCard; meta: RecapWeekMeta }) => (
  <View style={st.card}>
    <Text style={[st.eyebrow, { color: P.blue }]}>COLOR STORY</Text>
    <Text style={st.headline}>{card.headline}</Text>
    <Text style={st.body}>{card.body}</Text>
    <RecapColorBar palette={meta.palette} style={{ marginTop: 16 }} />
  </View>
);

const AllTimeCard = ({ card, meta }: { card: RecapCard; meta: RecapWeekMeta }) => {
  const max = Number(card.stat?.value) || meta.allTime.milestone;
  return (
    <View style={st.card}>
      <Text style={[st.eyebrow, { color: P.mint }]}>ALL-TIME</Text>
      <View style={st.heroNumberRow}>
        <Text style={[st.statNumber, { color: P.mint }]} maxFontSizeMultiplier={1.15} numberOfLines={1}>
          {meta.allTime.count}
        </Text>
        <Text style={[st.serifItalic, { marginBottom: 6 }]}>{'outfits\nlogged'}</Text>
      </View>
      <Text style={[st.headline, { marginTop: 4 }]}>{card.headline}</Text>
      <Text style={st.body}>{card.body}</Text>
      <MilestoneMeter value={meta.allTime.count} max={max} />
    </View>
  );
};

const TravelCard = ({ card }: { card: RecapCard }) => (
  <View style={[st.card, { borderWidth: 0 }]}>
    <LinearGradient colors={P.cardBlue} start={{ x: 0.1, y: 0 }} end={{ x: 0.9, y: 1 }} style={st.cardGradient} />
    <Text style={[st.eyebrow, { color: P.blueText }]}>THE TRIP</Text>
    {card.stat && (
      <View style={st.heroNumberRow}>
        <Text style={[st.statNumber, { color: P.text }]} maxFontSizeMultiplier={1.15} numberOfLines={1}>
          {card.stat.value}
        </Text>
        <Text style={[st.serifItalic, { color: 'rgba(242,240,234,0.72)', marginBottom: 6 }]}>
          {card.stat.label}
        </Text>
      </View>
    )}
    <Text style={[st.headline, { marginTop: 4 }]}>{card.headline}</Text>
    <Text style={[st.body, { color: 'rgba(242,240,234,0.82)' }]}>{card.body}</Text>
  </View>
);

const WrappedCard = ({ card, onShare }: { card: RecapCard; onShare: () => void }) => (
  <View style={[st.card, { borderWidth: 0 }]}>
    <LinearGradient colors={P.outro} start={{ x: 0.1, y: 0 }} end={{ x: 0.9, y: 1 }} style={st.cardGradient} />
    <Text style={[st.eyebrow, { color: '#BDF2D2' }]}>THAT’S A WRAP</Text>
    <Text style={[st.headline, { marginTop: 2 }]}>{card.headline}</Text>
    <Text style={[st.body, { color: 'rgba(242,240,234,0.85)' }]}>{card.body}</Text>
    <Pressable
      style={sx.shareBtn}
      onPress={onShare}
      accessibilityRole='button'
      accessibilityLabel='Share your recap'
    >
      <Text style={sx.shareBtnText}>Share your recap</Text>
    </Pressable>
  </View>
);

const GenericCard = ({ card, onShop }: { card: RecapCard; onShop: (g: GapType) => void }) => {
  const accent = RECAP_ACCENT[card.section];
  const label = SECTION_LABELS[card.section];
  return (
    <View style={st.card}>
      <View style={st.headerRow}>
        {label ? <Text style={[st.eyebrow, { color: accent }]}>{label}</Text> : <View />}
        {card.imageUrl && <ThumbTile uri={card.imageUrl} />}
      </View>

      {(card.stat || card.colorNames) && (
        <View style={st.heroNumberRow}>
          {card.stat && (
            <>
              <Text style={[st.statNumber, { color: accent, fontSize: 52, lineHeight: 52 }]}
                maxFontSizeMultiplier={1.15} numberOfLines={1}>
                {card.stat.value}
              </Text>
              <Text style={[st.serifItalic, { marginBottom: 4 }]}>{card.stat.label}</Text>
            </>
          )}
          {card.colorNames && (
            <View style={[st.swatchRow, { marginBottom: 8, marginLeft: 'auto' }]}>
              {card.colorNames.map(n => (
                <View key={n} style={[st.swatchDot, { backgroundColor: recapSwatchHex(n) }]} />
              ))}
            </View>
          )}
        </View>
      )}

      <Text style={[st.headline, { marginTop: 4 }]}>{card.headline}</Text>
      <Text style={st.body}>{card.body}</Text>

      {card.cta === 'shop' && card.gapType && (
        <Pressable
          style={st.ctaBtn}
          onPress={() => onShop(card.gapType!)}
          accessibilityRole='button'
          accessibilityLabel='Shop suggestions'
        >
          <Text style={st.ctaBtnText}>Shop suggestions</Text>
        </Pressable>
      )}
    </View>
  );
};

/** Small garment thumbnail that hides itself on a broken/expired URL. */
const ThumbTile = ({ uri }: { uri: string }) => {
  const [errored, setErrored] = useState(false);
  if (errored) return null;
  return (
    <View style={sx.thumb}>
      <Image source={{ uri }} style={sx.thumbImg} resizeMode='cover' onError={() => setErrored(true)} />
    </View>
  );
};

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function RecapPage() {
  const router = useRouter();
  const params = useLocalSearchParams<{ demo?: string }>();
  const isDemo = __DEV__ && params.demo === '1';
  const { closets, loading: closetsLoading } = useClosets();
  const gradient = useRecapGradientCycle();

  const [data, setData] = useState<Data | null>(isDemo ? DEMO_RECAP : null);
  const [showShare, setShowShare] = useState(false);

  useEffect(() => {
    if (isDemo || closetsLoading) return;
    let cancelled = false;
    (async () => {
      const now = new Date();
      const [history, plans, gaps, previouslyShown] = await Promise.all([
        loadHistory(),
        loadPlans(),
        getGapSuggestions(),
        loadShownBeforeWeek(isoWeekKey(now)),
      ]);
      const built = buildRecap({
        closets, history, plans, gaps, now,
        seed: getUserId() ?? '',
        previouslyShown,
      });
      if (cancelled) return;
      setData(built);
      recordShownTemplates(built.cards.map(c => c.templateId), now).catch(() => {});
    })();
    return () => { cancelled = true; };
  }, [closets, closetsLoading, isDemo]);

  // Opened cold from the ojo://recap notification there's no stack to pop, so
  // fall back to Settings rather than stranding the user on a dead back button.
  const handleBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/account');
  };

  const handleShop = (gapType: GapType) => {
    hapticSelection();
    Linking.openURL(shopUrl(gapType)).catch(() => {});
  };
  const handleShare = () => {
    hapticSelection();
    setShowShare(true);
  };

  // The shared <Loading /> paints the themed background, which would flash white
  // over this always-dark screen in light appearance — use an ink-safe spinner.
  if (data === null) {
    return (
      <View style={[st.root, sx.loading]}>
        <StatusBar style='light' />
        <RecapGradientBackground {...gradient} />
        <ActivityIndicator color={P.mint} />
      </View>
    );
  }

  const { cards, meta } = data;

  return (
    <View style={st.root}>
      <StatusBar style='light' />
      <RecapGradientBackground {...gradient} />
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        {/* Nav row */}
        <View style={st.navRow}>
          <Pressable style={st.navBtn} onPress={handleBack} accessibilityLabel='Back' accessibilityRole='button'>
            <BackIcon />
          </Pressable>
          <Text style={st.navStamp}>{meta.weekLabel}</Text>
          {/* Nothing worth posting when the week is empty — keep the row balanced. */}
          {meta.outfitsThisWeek > 0 ? (
            <Pressable style={st.navBtn} onPress={handleShare} accessibilityLabel='Share your recap' accessibilityRole='button'>
              <ShareIcon />
            </Pressable>
          ) : (
            <View style={sx.navSpacer} />
          )}
        </View>

        <ScrollView contentContainerStyle={st.content} showsVerticalScrollIndicator={false}>
          {/* Masthead */}
          <View style={st.masthead}>
            <OjoLogo size={40} />
            <Text style={st.mastheadKicker}>The Week in Wear</Text>
          </View>
          <View style={st.hairline} />

          {cards.map(card => {
            switch (card.templateId) {
              case 'hero_week':
              case 'hero_light':
              case 'empty_week':
                return <HeroCard key={card.templateId} card={card} meta={meta} />;
              case 'color_story':
                return <ColorStoryCard key={card.templateId} card={card} meta={meta} />;
              case 'mvp_item':
                return <MvpCard key={card.templateId} card={card} />;
              case 'milestone':
                return <AllTimeCard key={card.templateId} card={card} meta={meta} />;
              case 'trip_week':
                return <TravelCard key={card.templateId} card={card} />;
              case 'share_cta':
                return <WrappedCard key={card.templateId} card={card} onShare={handleShare} />;
              default:
                return <GenericCard key={card.templateId} card={card} onShop={handleShop} />;
            }
          })}

          <Text style={[st.stamp, { textAlign: 'center', marginTop: 6 }]}>{meta.weekStamp}</Text>
        </ScrollView>
      </SafeAreaView>

      <ShareToInstagramSheet
        visible={showShare}
        onClose={() => setShowShare(false)}
        renderCard={ref => (
          <RecapShareCard
            ref={ref}
            cards={cards}
            meta={meta}
            gradientColors={gradient.currentColors}
          />
        )}
        attributionURL={recapShareLink()}
      />
    </View>
  );
}

// Styles local to the screen shell (the shared card/type roles live in RecapPage.styles).
const sx = StyleSheet.create({
  loading: { alignItems: 'center', justifyContent: 'center' },
  navSpacer: { width: 38, height: 38 },
  hero: { paddingHorizontal: 2, paddingTop: 6, gap: 2 },
  shareBtn: {
    alignSelf: 'flex-start',
    marginTop: 14,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
  },
  shareBtnText: { fontFamily: 'Outfit-SemiBold', fontSize: 14, color: '#0D3A28' },
  thumb: {
    width: 44, height: 44, borderRadius: 12, overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  thumbImg: { width: '100%', height: '100%' },
});
