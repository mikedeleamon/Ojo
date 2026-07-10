/**
 * RecapColorBar — the week's color spread as a rounded segmented bar (segments
 * sized by per-outfit count) with an optional dot legend. Shared by RecapPage's
 * Color Story card and the exported StoryCard so both render identically.
 */

import { StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { View, Text } from '../primitives';
import { RecapPaletteEntry } from '../../lib/recapEngine';
import { RECAP_PALETTE, recapSwatchHex } from '../../lib/recapVisuals';
import { fonts } from '../../theme/tokens';

interface RecapColorBarProps {
  palette: RecapPaletteEntry[];
  height?: number;
  showLegend?: boolean;
  /** Legend text color (defaults to the dark-surface muted tone). */
  legendColor?: string;
  style?: StyleProp<ViewStyle>;
}

const RecapColorBar = ({
  palette,
  height = 34,
  showLegend = true,
  legendColor = RECAP_PALETTE.muted,
  style,
}: RecapColorBarProps) => {
  if (!palette.length) return null;
  return (
    <View style={style}>
      <View style={[styles.bar, { height }]}>
        {palette.map(p => (
          <View
            key={p.name}
            style={{ flex: Math.max(1, p.count), backgroundColor: recapSwatchHex(p.name), borderRadius: 6 }}
          />
        ))}
      </View>
      {showLegend && (
        <View style={styles.legend}>
          {palette.map(p => (
            <View key={p.name} style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: recapSwatchHex(p.name) }]} />
              <Text style={[styles.legendText, { color: legendColor }]}>
                {p.name} {p.count}
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    gap: 3,
  },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 10,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 10,
    letterSpacing: 0.4,
  },
});

export default RecapColorBar;
