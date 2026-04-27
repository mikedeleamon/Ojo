import { useState } from 'react';
import { StyleSheet, Pressable } from 'react-native';
import { Svg, Path } from 'react-native-svg';
import { View, Text } from '../primitives';
import OutfitSuggestion from '../OutfitSuggestion/OutfitSuggestion';
import { CurrentWeather, Forecast, Settings } from '../../types';
import { colors, fonts, fontSizes, fontWeights, spacing, radius } from '../../theme/tokens';

interface Props { weather: CurrentWeather; settings: Settings; forecasts: Forecast[]; }

const Stat = ({ label, value }: { label: string; value: string }) => (
  <View style={st.stat}>
    <Text style={st.statLabel}>{label}</Text>
    <Text style={st.statValue}>{value}</Text>
  </View>
);

const WeatherDetails = ({ weather, settings, forecasts }: Props) => {
  const [expanded, setExpanded] = useState(false);
  const isMetric = settings.temperatureScale === 'Metric';

  return (
    <View style={st.root}>
      <OutfitSuggestion weather={weather} settings={settings} forecasts={forecasts} />

      <Pressable style={st.toggle} onPress={() => setExpanded(v => !v)}>
        <Text style={st.toggleText}>{expanded ? 'Less' : 'More details'}</Text>
        <Svg width={16} height={16} viewBox="0 0 16 16" fill="none"
          style={{ transform: [{ rotate: expanded ? '180deg' : '0deg' }] }}>
          <Path d="M4 6l4 4 4-4" stroke={colors.textSecondary} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"/>
        </Svg>
      </Pressable>

      {expanded && (
        <View style={st.grid}>
          <Stat label="Wind"       value={`${weather.Wind.Speed.Imperial.Value} mph`} />
          <Stat label="Humidity"   value={`${weather.RelativeHumidity}%`} />
          <Stat label="UV Index"   value={weather.UVIndexText} />
          <Stat label="Feels like" value={`${isMetric
            ? weather.RealFeelTemperature.Metric.Value
            : weather.RealFeelTemperature.Imperial.Value}°`} />
        </View>
      )}
    </View>
  );
};

export default WeatherDetails;

const st = StyleSheet.create({
  root:       { gap: spacing.md },
  toggle:     { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingVertical: 6 },
  toggleText: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.textSecondary },
  grid:       { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  stat: {
    flex: 1, minWidth: 120,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: radius.sm, borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)',
    padding: spacing.sm, gap: 4,
  },
  statLabel: { fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
  statValue: { fontFamily: fonts.body, fontSize: fontSizes.base, color: colors.textPrimary, fontWeight: fontWeights.medium },
});
