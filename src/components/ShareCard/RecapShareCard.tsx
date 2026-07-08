import { forwardRef } from 'react';
import { StyleSheet } from 'react-native';
import { View, Text } from '../primitives';
import { RecapCard } from '../../lib/recapEngine';
import ShareCardFrame from './ShareCardFrame';
import { CARD_WIDTH } from './ShareCardFrame.styles';
import { fonts, fontSizes } from '../../theme/tokens';
import cs from './shareCardCommon.styles';

interface RecapShareCardProps {
  /** The full week's cards; the opener leads and up to 3 middles become lines. */
  cards: RecapCard[];
}

const MAX_LINES = 3;
const PAD = 24 * 2;

const st = StyleSheet.create({
  lines: { marginTop: 22, gap: 14, maxWidth: CARD_WIDTH - PAD },
  line:  { gap: 2 },
  lineHeadline: {
    fontFamily: fonts.display,
    fontSize: fontSizes.lg,
    color: '#FFFFFF',
  },
  lineBody: {
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    color: 'rgba(255,255,255,0.7)',
    lineHeight: fontSizes.sm * 1.5,
  },
});

const RecapShareCard = forwardRef<View, RecapShareCardProps>(({ cards }, ref) => {
  const opener = cards.find(c => c.section === 'opener');
  const middles = cards
    .filter(c => c.section !== 'opener' && c.section !== 'closer' && c.cta !== 'shop')
    .slice(0, MAX_LINES);

  return (
    <ShareCardFrame gradientColors={['#1E293B', '#0F172A', '#0F172A']} ref={ref}>
      <Text style={cs.eyebrow}>Weekly Recap</Text>
      <Text style={cs.headline}>{opener?.headline ?? 'My week in outfits'}</Text>
      {opener?.body ? <Text style={cs.subline}>{opener.body}</Text> : null}

      <View style={st.lines}>
        {middles.map(card => (
          <View key={card.templateId} style={st.line}>
            <Text style={st.lineHeadline}>{card.headline}</Text>
            <Text style={st.lineBody} numberOfLines={2}>
              {card.body}
            </Text>
          </View>
        ))}
      </View>
    </ShareCardFrame>
  );
});

RecapShareCard.displayName = 'RecapShareCard';

export default RecapShareCard;
