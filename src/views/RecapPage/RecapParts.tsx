/**
 * RecapParts — the small visualizations unique to the in-app RecapPage:
 * the hero RhythmStrip, the All-time MilestoneMeter, and the cream MvpCard.
 * (RecapColorBar and RecapGradientBackground live in components/recap since the
 * StoryCard shares them.)
 */

import { useState } from 'react';
import { StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { View, Text, Image } from '../../components/primitives';
import { RecapDay, RecapCard } from '../../lib/recapEngine';
import { RECAP_PALETTE as P, recapSwatchHex } from '../../lib/recapVisuals';
import { fonts } from '../../theme/tokens';

// ─── RhythmStrip ──────────────────────────────────────────────────────────────

const BLOCK_H = 13;
const BLOCK_GAP = 3;

/** 7 columns, one rounded block per outfit that day, colored by its dominant
 *  color. Blocks bottom-anchor so the day initials line up beneath. The strip
 *  grows to fit the busiest day rather than clipping it. */
export const RhythmStrip = ({ daily }: { daily: RecapDay[] }) => {
  const busiest = daily.reduce((max, d) => Math.max(max, d.colors.length), 0);
  const rows = Math.max(3, busiest);
  const barsHeight = rows * BLOCK_H + (rows - 1) * BLOCK_GAP;

  return (
    <View style={rs.wrap}>
      <View style={[rs.bars, { height: barsHeight }]}>
        {daily.map((d, i) => (
          <View key={i} style={rs.col}>
            {d.colors.length === 0 ? (
              <View style={rs.empty} />
            ) : (
              d.colors.map((c, j) => (
                <View key={j} style={[rs.block, { backgroundColor: recapSwatchHex(c) }]} />
              ))
            )}
          </View>
        ))}
      </View>
      <View style={rs.labels}>
        {daily.map((d, i) => (
          <Text key={i} style={rs.day}>{d.initial}</Text>
        ))}
      </View>
    </View>
  );
};

const rs = StyleSheet.create({
  wrap: { marginTop: 20, gap: 8 },
  bars: { flexDirection: 'row', alignItems: 'flex-end' },
  col: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', gap: BLOCK_GAP },
  block: { width: 18, height: BLOCK_H, borderRadius: 4 },
  empty: { width: 18, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.10)' },
  labels: { flexDirection: 'row' },
  day: {
    flex: 1,
    textAlign: 'center',
    fontFamily: fonts.bodyMedium,
    fontSize: 10,
    letterSpacing: 0.5,
    color: P.muted,
  },
});

// ─── MilestoneMeter ─────────────────────────────────────────────────────────

/** 6px rounded track with a mint gradient fill at value/max. */
export const MilestoneMeter = ({ value, max }: { value: number; max: number }) => {
  const pct = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0;
  return (
    <View style={mm.wrap}>
      <View style={mm.track}>
        <LinearGradient
          colors={[P.mintDeep, P.mint]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[mm.fill, { width: `${pct * 100}%` }]}
        />
      </View>
      <View style={mm.labels}>
        <Text style={mm.label}>0</Text>
        <Text style={mm.label}>{max} — milestone</Text>
      </View>
    </View>
  );
};

const mm = StyleSheet.create({
  wrap: { marginTop: 16, gap: 8 },
  track: { height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.08)', overflow: 'hidden' },
  fill: { height: 6, borderRadius: 3 },
  labels: { flexDirection: 'row', justifyContent: 'space-between' },
  label: { fontFamily: fonts.bodyMedium, fontSize: 10, letterSpacing: 0.4, color: P.muted },
});

// ─── MvpCard ────────────────────────────────────────────────────────────────

/** The one light surface: cream gradient, coral eyebrow, big "{wears}×", and a
 *  118px image tile that degrades gracefully when the garment has no photo. */
export const MvpCard = ({ card }: { card: RecapCard }) => {
  const [errored, setErrored] = useState(false);
  const wears = card.stat?.value ?? '';
  const showImage = !!card.imageUrl && !errored;

  return (
    <View style={[mv.card]}>
      <LinearGradient
        colors={P.cream}
        start={{ x: 0.15, y: 0 }}
        end={{ x: 0.85, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />
      <View style={mv.headerRow}>
        <Text style={mv.eyebrow}>THE MVP</Text>
        {!!wears && <Text style={mv.stamp}>{wears} wears</Text>}
      </View>

      <View style={mv.body}>
        <View style={mv.left}>
          {!!wears && (
            <Text style={mv.big} maxFontSizeMultiplier={1.15} numberOfLines={1}>
              {wears}×
            </Text>
          )}
          <Text style={mv.headline}>{card.headline}</Text>
          <Text style={mv.sub}>{card.body}</Text>
        </View>

        <View style={mv.tile}>
          {showImage ? (
            <Image
              source={{ uri: card.imageUrl! }}
              style={mv.tileImg}
              resizeMode='contain'
              onError={() => setErrored(true)}
            />
          ) : (
            <Text style={mv.tilePlaceholder}>👕</Text>
          )}
        </View>
      </View>
    </View>
  );
};

const mv = StyleSheet.create({
  card: {
    borderRadius: 26,
    paddingVertical: 22,
    paddingHorizontal: 20,
    overflow: 'hidden',
    gap: 14,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  eyebrow: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 11,
    letterSpacing: 2.2,
    textTransform: 'uppercase',
    color: P.coral,
  },
  stamp: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 9,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: P.mutedOnCream,
  },
  body: { flexDirection: 'row', gap: 16, alignItems: 'center' },
  left: { flex: 1, gap: 4 },
  big: {
    fontFamily: fonts.display,
    fontSize: 60,
    lineHeight: 70,
    includeFontPadding: false,
    letterSpacing: -2,
    color: P.textOnCream,
    marginBottom: -8,
  },
  headline: {
    fontFamily: fonts.display,
    fontSize: 24,
    lineHeight: 29,
    letterSpacing: -0.3,
    color: P.textOnCream,
    marginTop: 2,
  },
  sub: { fontFamily: fonts.body, fontSize: 13.5, lineHeight: 19, color: P.mutedOnCream, marginTop: 2 },
  tile: {
    width: 118,
    height: 118,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
  },
  tileImg: { width: '86%', height: '86%' },
  tilePlaceholder: { fontSize: 40, opacity: 0.5 },
});
