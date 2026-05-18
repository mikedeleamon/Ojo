import { StyleSheet } from 'react-native';
import { View, Text } from '../primitives';
import WeatherIconDisplay from '../WeatherIconDisplay/WeatherIconDisplay';
import { colors, fonts, fontSizes, radius, spacing } from '../../theme/tokens';

interface Props {
  weather:     string;
  temperature: number;
  time:        string;
  tempUnit:    string;
  isDay:       boolean;
  isNow?:      boolean;
}

const formatTime = (iso: string) =>
  new Date(iso).toLocaleString('en-US', { hour: 'numeric', hour12: true });

const MinimizedWeatherDisplay = ({ weather, temperature, time, tempUnit, isDay, isNow }: Props) => (
  <View style={[styles.card, isNow && styles.cardNow]}>
    <Text style={[styles.time, isNow && styles.timeNow]}>{isNow ? 'Now' : formatTime(time)}</Text>
    <WeatherIconDisplay condition={weather} isDay={isDay} size="small" />
    <Text style={styles.temp}>{temperature}° {tempUnit}</Text>
  </View>
);

export default MinimizedWeatherDisplay;

const styles = StyleSheet.create({
  card: {
    alignItems:      'center',
    gap:             6,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius:    radius.md,
    borderWidth:     1,
    borderColor:     'rgba(255,255,255,0.12)',
    minWidth:        64,
  },
  cardNow: {
    borderColor: 'rgba(255,255,255,0.28)',
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  time: { fontFamily: fonts.body, fontSize: 11, color: colors.textSecondary },
  timeNow: { color: colors.textPrimary, fontWeight: '600' as const },
  temp: { fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.textPrimary },
});
