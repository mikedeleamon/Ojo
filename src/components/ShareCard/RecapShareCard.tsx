/**
 * RecapShareCard — the 9:16 Weekly Recap poster exported to Instagram Stories.
 * Self-contained (no device chrome): the Ojo mark + week label up top, a
 * centered hero block (eyebrow, giant outfit count, tagline, color bar) and a
 * 3-up stat row, then the Ojo footer.
 *
 * The background freezes whatever weather gradient the page's cycling
 * background was showing when the user tapped share (`gradientColors`), under
 * the same ink scrim — so the poster reads as a still frame of the live screen.
 *
 * Rendered on-screen at CARD_WIDTH×CARD_HEIGHT (9:16) and captured by
 * useShareCapture at a fixed 1080×1920, so the exported PNG matches this
 * preview 1:1. Deliberately theme-independent — a shared card is brand surface.
 */

import { forwardRef } from 'react';
import { StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { View, Text } from '../primitives';
import { RecapCard, RecapWeekMeta } from '../../lib/recapEngine';
import {
  RECAP_PALETTE as P,
  RECAP_BRAND_GRADIENT,
  RECAP_GRADIENT_START,
  RECAP_GRADIENT_END,
  RECAP_SCRIM,
  RecapGradient,
} from '../../lib/recapVisuals';
import OjoLogo from '../OjoLogo';
import RecapColorBar from '../recap/RecapColorBar';
import { CARD_WIDTH, CARD_HEIGHT } from './ShareCardFrame.styles';
import { fonts } from '../../theme/tokens';

interface RecapShareCardProps {
  cards: RecapCard[];
  meta: RecapWeekMeta;
  /** The gradient showing on the page at share time; falls back to the brand. */
  gradientColors?: RecapGradient;
}

interface Stat { value: string; label: string; color: string }

/** The 3 headline stats, assembled from whichever cards fired, with fallbacks
 *  so the row is always full. */
const pickStats = (cards: RecapCard[], meta: RecapWeekMeta): Stat[] => {
  const byId = (id: string) => cards.find(c => c.templateId === id);
  const color = byId('color_story');
  const mvp = byId('mvp_item');
  const milestone = byId('milestone');
  const top = meta.palette[0];

  return [
    color?.stat
      ? { value: color.stat.value, label: (color.colorNames?.[0] ?? top?.name ?? 'Color').toUpperCase(), color: P.blueText }
      : { value: `${top?.count ?? meta.outfitsThisWeek}`, label: (top?.name ?? 'Looks').toUpperCase(), color: P.blueText },
    mvp?.stat
      ? { value: `${mvp.stat.value}×`, label: 'MVP', color: P.mint }
      : { value: `${meta.daysLogged}`, label: 'DAYS LOGGED', color: P.mint },
    { value: milestone?.stat?.value ?? `${meta.allTime.count}`, label: 'ALL-TIME', color: P.text },
  ];
};

const RecapShareCard = forwardRef<View, RecapShareCardProps>(
  ({ cards, meta, gradientColors = RECAP_BRAND_GRADIENT }, ref) => {
  const opener = cards.find(c => c.section === 'opener');
  const stats = pickStats(cards, meta);

  return (
    <View ref={ref} style={styles.frame} collapsable={false}>
      <LinearGradient
        colors={gradientColors}
        start={RECAP_GRADIENT_START}
        end={RECAP_GRADIENT_END}
        style={StyleSheet.absoluteFill}
      />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: RECAP_SCRIM }]} />

      <View style={styles.safe}>
        {/* Top row */}
        <View style={styles.topRow}>
          <OjoLogo size={34} />
          <Text style={styles.weekStamp}>{meta.weekLabel}</Text>
        </View>

        {/* Centered hero block */}
        <View style={styles.middle}>
          <Text style={styles.eyebrow}>THE WEEK IN WEAR</Text>
          <Text style={styles.heroNumber} numberOfLines={1} allowFontScaling={false}>
            {meta.outfitsThisWeek}
          </Text>
          <Text style={styles.tagline}>{opener?.headline ?? 'Your week, worn well.'}</Text>
          <RecapColorBar
            palette={meta.palette}
            height={28}
            showLegend={false}
            style={styles.bar}
          />
        </View>

        {/* 3-up stats */}
        <View style={styles.statRow}>
          {stats.map((s, i) => (
            <View key={i} style={styles.statCol}>
              <Text style={[styles.statValue, { color: s.color }]} numberOfLines={1} allowFontScaling={false}>
                {s.value}
              </Text>
              <Text style={styles.statLabel} numberOfLines={1}>{s.label}</Text>
            </View>
          ))}
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>STYLED BY</Text>
          <OjoLogo size={22} />
        </View>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  frame: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    overflow: 'hidden',
    backgroundColor: P.ink,
  },
  safe: {
    flex: 1,
    paddingTop: 84,
    paddingBottom: 84,
    paddingHorizontal: 30,
    justifyContent: 'space-between',
  },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  weekStamp: {
    fontFamily: fonts.bodySemiBold, fontSize: 10, letterSpacing: 1.4,
    textTransform: 'uppercase', color: P.muted,
  },

  middle: { flex: 1, justifyContent: 'center', gap: 10 },
  eyebrow: {
    fontFamily: fonts.bodySemiBold, fontSize: 11, letterSpacing: 2.4,
    textTransform: 'uppercase', color: P.mint,
  },
  // lineHeight must clear the serif's full ascent+descent or RN shears the
  // numerals off at the top (see RecapPage.styles).
  heroNumber: {
    fontFamily: fonts.display, fontSize: 116, lineHeight: 132,
    includeFontPadding: false,
    letterSpacing: -4, color: P.text, marginTop: -10, marginBottom: -12,
  },
  tagline: { fontFamily: fonts.display, fontSize: 30, lineHeight: 36, letterSpacing: -0.4, color: P.text },
  bar: { marginTop: 12 },

  statRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  statCol: { flex: 1, alignItems: 'flex-start' },
  statValue: { fontFamily: fonts.display, fontSize: 30, lineHeight: 38, includeFontPadding: false, letterSpacing: -1 },
  statLabel: {
    fontFamily: fonts.bodySemiBold, fontSize: 9, letterSpacing: 1.2,
    textTransform: 'uppercase', color: P.muted, marginTop: 3,
  },

  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  footerText: { fontFamily: fonts.bodySemiBold, fontSize: 11, letterSpacing: 1.4, color: 'rgba(242,240,234,0.85)' },
});

RecapShareCard.displayName = 'RecapShareCard';

export default RecapShareCard;
