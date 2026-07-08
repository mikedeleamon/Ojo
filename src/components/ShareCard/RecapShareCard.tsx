import { forwardRef } from 'react';
import { StyleSheet, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { View, Text } from '../primitives';
import { RecapCard } from '../../lib/recapEngine';
import { recapTint, resolveColorHex, brandWash, hexToRgba } from '../../lib/recapVisuals';
import ShareCardFrame from './ShareCardFrame';
import { CARD_WIDTH } from './ShareCardFrame.styles';
import { fonts, fontSizes } from '../../theme/tokens';
import cs from './shareCardCommon.styles';

interface RecapShareCardProps {
  /** The full week's cards; the opener leads, every other non-closer card
   *  becomes a stat chip in the grid below it. */
  cards: RecapCard[];
}

/** Navy → a hint of the brand leaf green → navy, echoing brandHeroTint instead
 *  of the plain dark gradient every other share template uses. */
const RECAP_GRADIENT = ['#0F172A', '#122C1E', '#0F172A'] as const;

const GRID_GAP = 10;
const PAD = 24 * 2;
const CHIP_WIDTH = (CARD_WIDTH - PAD - GRID_GAP) / 2;

const st = StyleSheet.create({
  headline: {
    lineHeight: 34,
  },
  subline: {
    lineHeight: 19,
  },
  heroStatValue: {
    fontFamily: fonts.display,
    fontSize:   48,
    lineHeight: 50,
    color:      '#FFFFFF',
    marginTop:  4,
  },
  heroStatLabel: {
    fontFamily:    fonts.bodyMedium,
    fontSize:      fontSizes.xs,
    color:         'rgba(255,255,255,0.65)',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop:     2,
  },
  grid: {
    marginTop:     16,
    flexDirection: 'row',
    flexWrap:      'wrap',
    gap:           GRID_GAP,
  },
  chip: {
    width:           CHIP_WIDTH,
    minHeight:       96,
    borderRadius:    16,
    padding:         12,
    gap:             6,
    justifyContent:  'flex-end',
    overflow:        'hidden',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth:     1,
    borderColor:     'rgba(255,255,255,0.14)',
  },
  chipWash: { ...StyleSheet.absoluteFillObject },
  chipTopRow: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
  },
  chipThumb: { width: 26, height: 26, borderRadius: 8 },
  chipDotRow: { flexDirection: 'row', gap: 4 },
  chipDot: {
    width: 9, height: 9, borderRadius: 4.5,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.4)',
  },
  chipValue: {
    fontFamily: fonts.display,
    fontSize:   26,
    lineHeight: 28,
    color:      '#FFFFFF',
  },
  chipLabel: {
    fontFamily:    fonts.bodyMedium,
    fontSize:      fontSizes.xs,
    color:         'rgba(255,255,255,0.7)',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  chipHeadline: {
    fontFamily: fonts.display,
    fontSize:   fontSizes.sm,
    lineHeight: fontSizes.sm * 1.3,
    color:      '#FFFFFF',
  },
});

const RecapShareCard = forwardRef<View, RecapShareCardProps>(({ cards }, ref) => {
  const opener  = cards.find(c => c.section === 'opener');
  const middles = cards.filter(c => c.section !== 'opener' && c.section !== 'closer').slice(0, 4);

  return (
    <ShareCardFrame gradientColors={RECAP_GRADIENT} ref={ref}>
      <Text style={cs.eyebrow}>Weekly Recap</Text>
      {opener?.stat && (
        <>
          <Text
            style={st.heroStatValue}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.5}
          >
            {opener.stat.value}
          </Text>
          <Text
            style={st.heroStatLabel}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.7}
          >
            {opener.stat.label}
          </Text>
        </>
      )}
      <Text
        style={[cs.headline, st.headline]}
        numberOfLines={2}
        adjustsFontSizeToFit
        minimumFontScale={0.6}
      >
        {opener?.headline ?? 'My week in outfits'}
      </Text>
      {opener?.body ? (
        <Text
          style={[cs.subline, st.subline]}
          numberOfLines={2}
          adjustsFontSizeToFit
          minimumFontScale={0.7}
        >
          {opener.body}
        </Text>
      ) : null}

      <View style={st.grid}>
        {middles.map(card => {
          const tint = recapTint(card);
          return (
            <View key={card.templateId} style={st.chip}>
              {tint.kind === 'flat' && (
                <View style={[st.chipWash, { backgroundColor: hexToRgba(tint.hex, 0.30) }]} />
              )}
              {tint.kind === 'gradient' && (
                <LinearGradient
                  colors={[hexToRgba(tint.colors[0], 0.32), hexToRgba(tint.colors[1], 0.32)]}
                  style={st.chipWash}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                />
              )}
              {tint.kind === 'brand' && (
                <LinearGradient
                  colors={brandWash(true)}
                  style={st.chipWash}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                />
              )}

              {(card.imageUrl || card.colorNames) && (
                <View style={st.chipTopRow}>
                  {card.imageUrl && (
                    <Image source={{ uri: card.imageUrl }} style={st.chipThumb} resizeMode='cover' />
                  )}
                  {card.colorNames && (
                    <View style={st.chipDotRow}>
                      {card.colorNames.map(name => {
                        const hex = resolveColorHex(name);
                        return hex ? <View key={name} style={[st.chipDot, { backgroundColor: hex }]} /> : null;
                      })}
                    </View>
                  )}
                </View>
              )}

              {card.stat ? (
                <View>
                  <Text
                    style={st.chipValue}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.6}
                  >
                    {card.stat.value}
                  </Text>
                  <Text
                    style={st.chipLabel}
                    numberOfLines={2}
                    adjustsFontSizeToFit
                    minimumFontScale={0.7}
                  >
                    {card.stat.label}
                  </Text>
                </View>
              ) : (
                <Text
                  style={st.chipHeadline}
                  numberOfLines={3}
                  adjustsFontSizeToFit
                  minimumFontScale={0.75}
                >
                  {card.headline}
                </Text>
              )}
            </View>
          );
        })}
      </View>
    </ShareCardFrame>
  );
});

RecapShareCard.displayName = 'RecapShareCard';

export default RecapShareCard;
