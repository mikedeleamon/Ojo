import { useState, useMemo } from 'react';
import { StyleSheet, Pressable } from 'react-native';
import { Svg, Path } from 'react-native-svg';
import { View, Text } from '../primitives';
import OutfitSuggestion from '../OutfitSuggestion/OutfitSuggestion';
import { CurrentWeather, Forecast, Settings } from '../../types';
import { ColorTokens, fonts, fontSizes, fontWeights, spacing, radius } from '../../theme/tokens';
import { useTheme } from '../../theme/ThemeContext';

interface Props { weather: CurrentWeather; settings: Settings; forecasts: Forecast[]; }

const makeStyles = (colors: ColorTokens) => StyleSheet.create({
  root:       { gap: spacing.md },
  toggle:     { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingVertical: 6 },
  toggleText: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.textSecondary },
  grid:       { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  stat: {
    flex: 1, minWidth: 120,
    backgroundColor: colors.glassBg,
    borderRadius: radius.sm, borderWidth: 1, borderColor: colors.glassBorder,
    padding: spacing.sm, gap: 4,
  },
  statLabel: { fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
  statValue: { fontFamily: fonts.body, fontSize: fontSizes.base, color: colors.textPrimary, fontWeight: fontWeights.medium },
  pillRow:   { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  pill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingVertical: 4, paddingHorizontal: 10,
    borderRadius: radius.pill, borderWidth: 1,
  },
  pillLabel: { fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
  pillValue: { fontFamily: fonts.body, fontSize: fontSizes.xs, fontWeight: fontWeights.semibold },
});

const WeatherDetails = ({ weather, settings, forecasts }: Props) => {
  const { colors } = useTheme();
  const st = useMemo(() => makeStyles(colors), [colors]);
  const [expanded, setExpanded] = useState(false);
  const isMetric = settings.temperatureScale === 'Metric';

  const Stat = ({ label, value }: { label: string; value: string }) => (
    <View style={st.stat}>
      <Text style={st.statLabel}>{label}</Text>
      <Text style={st.statValue}>{value}</Text>
    </View>
  );

  // ── Pill badge helper ────────────────────────────────────────────────────
  const BAD_LABELS = new Set(['High', 'Very High', 'Extreme', 'Unhealthy for Sensitive Groups', 'Unhealthy', 'Very Unhealthy', 'Hazardous']);
  const MID_LABELS = new Set(['Moderate', 'Medium']);

  const pillColor = (value?: string) => {
    if (!value) return { border: colors.glassBorder, text: colors.textMuted };
    if (BAD_LABELS.has(value)) return { border: 'rgba(239,68,68,0.40)', text: 'rgba(252,165,165,0.9)' };
    if (MID_LABELS.has(value)) return { border: 'rgba(251,191,36,0.40)', text: 'rgba(251,191,36,0.9)' };
    return { border: 'rgba(52,211,153,0.35)', text: 'rgba(52,211,153,0.9)' };
  };

  const ConditionPill = ({ label, value }: { label: string; value?: string }) => {
    if (!value) return null;
    const c = pillColor(value);
    return (
      <View style={[st.pill, { borderColor: c.border, backgroundColor: 'rgba(255,255,255,0.04)' }]}>
        <Text style={st.pillLabel}>{label}</Text>
        <Text style={[st.pillValue, { color: c.text }]}>{value}</Text>
      </View>
    );
  };

  const hasConditionData = weather.AirQualityText || weather.PollenCategory;

  return (
    <View style={st.root}>
      <OutfitSuggestion weather={weather} settings={settings} forecasts={forecasts} />

      {/* Always-visible wind + humidity */}
      <View style={st.grid}>
        <Stat label="Wind"     value={`${weather.Wind.Speed.Imperial.Value} mph`} />
        <Stat label="Humidity" value={`${weather.RelativeHumidity}%`} />
      </View>

      <Pressable style={st.toggle} onPress={() => setExpanded(v => !v)}>
        <Text style={st.toggleText}>{expanded ? 'Less' : 'More details'}</Text>
        <Svg width={16} height={16} viewBox="0 0 16 16" fill="none"
          style={{ transform: [{ rotate: expanded ? '180deg' : '0deg' }] }}>
          <Path d="M4 6l4 4 4-4" stroke={colors.textSecondary} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"/>
        </Svg>
      </Pressable>

      {expanded && (
        <>
          <View style={st.grid}>
            <Stat label="UV Index"   value={weather.UVIndexText} />
            <Stat label="Feels like" value={`${isMetric
              ? weather.RealFeelTemperature.Metric.Value
              : weather.RealFeelTemperature.Imperial.Value}°`} />
          </View>

          {hasConditionData && (
            <View style={st.pillRow}>
              <ConditionPill label="Air Quality" value={weather.AirQualityText} />
              <ConditionPill label="Pollen"      value={weather.PollenCategory} />
            </View>
          )}
        </>
      )}
    </View>
  );
};

export default WeatherDetails;
