import { useState, useMemo, memo } from 'react';
import { ActivityIndicator, StyleSheet, Pressable, type StyleProp, type TextStyle } from 'react-native';
import { Svg, Path } from 'react-native-svg';
import { View, Text, GlassCard, GlassGroup } from '../primitives';
import OutfitSuggestion from '../OutfitSuggestion/OutfitSuggestion';
import { useDeferredMount } from '../../hooks/useDeferredMount';
import { CurrentWeather, DailyForecast, Forecast, LocationCoords, Settings } from '../../types';
import { type ColorTokens, fonts, fontSizes, fontWeights, spacing, radius } from '../../theme/tokens';
import { useTheme } from '../../theme/ThemeContext';

interface Props { weather: CurrentWeather; settings: Settings; forecasts: Forecast[]; daily?: DailyForecast[]; city?: string; coords?: LocationCoords; showStats?: boolean; }

const makeStyles = (colors: ColorTokens) => StyleSheet.create({
  root:       { gap: spacing.md },
  // Reserves vertical space while the outfit engine mounts a beat after the HUD
  // paints, so the content below (share button, attribution) doesn't jump. Matched
  // to OutfitSuggestion's own generatingBox (its first-generation loading state)
  // so mounting doesn't itself cause a second jump right after this one.
  outfitPlaceholder: { minHeight: 220, alignItems: 'center', justifyContent: 'center' },
  toggle:     { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingVertical: 6 },
  toggleText: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.textSecondary },
  grid:       { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  stat: {
    flex: 1, minWidth: 120,
    backgroundColor: colors.glassBg,
    borderRadius: radius.sm, borderWidth: 1, borderColor: colors.glassBorder,
    padding: spacing.sm, gap: 4,
  },
  statLabel: { fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.textLabel, textTransform: 'uppercase', letterSpacing: 0.5 },
  statValue: { fontFamily: fonts.body, fontSize: fontSizes.base, color: colors.textPrimary, fontWeight: fontWeights.medium },
  pillRow:   { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  pill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingVertical: 4, paddingHorizontal: 10,
    borderRadius: radius.pill, borderWidth: 1,
  },
  pillLabel: { fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
  pillValue: { fontFamily: fonts.body, fontSize: fontSizes.xs, fontWeight: fontWeights.semibold },
  line:      { flexDirection: 'row', paddingHorizontal: spacing.md },
  lineCell:  { flex: 1, alignItems: 'center' },
  lineCellDivided: { borderLeftWidth: StyleSheet.hairlineWidth * 2, borderLeftColor: 'rgba(255,255,255,0.22)' },
  lineLabel: { fontFamily: fonts.body, fontSize: fontSizes.xs, lineHeight: 14, letterSpacing: 1.4, textTransform: 'uppercase', color: 'rgba(255,255,255,0.85)' },
  lineValue: { fontFamily: fonts.body, fontSize: 17, lineHeight: 22, color: colors.textPrimary, fontWeight: fontWeights.medium },
});

const windText = (weather: CurrentWeather, isMetric: boolean) =>
  isMetric
    ? `${weather.Wind.Speed.Metric.Value} km/h`
    : `${weather.Wind.Speed.Imperial.Value} mph`;

const visibilityText = (weather: CurrentWeather, isMetric: boolean) =>
  weather.Visibility
    ? isMetric
      ? `${Math.round(weather.Visibility.Metric.Value)} km`
      : `${Math.round(weather.Visibility.Imperial.Value)} mi`
    : null;

interface StatsProps {
  weather: CurrentWeather;
  settings: Settings;
  /** Show every stat with no "More details" toggle (the two-pane Home, which has
   *  the room). Feels like is in that layout's hero, so Visibility takes its slot. */
  showAll?: boolean;
}

/**
 * Wind, humidity and the expandable details. Its own component because the
 * two-pane Home shows these in the weather pane, apart from the outfit.
 */
export const WeatherStats = memo(({ weather, settings, showAll = false }: StatsProps) => {
  const { colors, innerGlassTint } = useTheme();
  const st = useMemo(() => makeStyles(colors), [colors]);
  const [expanded, setExpanded] = useState(false);
  const isMetric = settings.temperatureScale === 'Metric';

  const Stat = ({ label, value }: { label: string; value: string }) => (
    <GlassCard style={st.stat} glassTint={innerGlassTint}>
      <Text style={st.statLabel}>{label}</Text>
      <Text style={st.statValue}>{value}</Text>
    </GlassCard>
  );

  // ── Pill badge helper ────────────────────────────────────────────────────
  const BAD_LABELS = new Set(['High', 'Very High', 'Extreme', 'Unhealthy for Sensitive Groups', 'Unhealthy', 'Very Unhealthy', 'Hazardous']);
  const MID_LABELS = new Set(['Moderate', 'Medium']);

  const pillColor = (value?: string) => {
    if (!value) return { border: colors.glassBorder, text: colors.textMuted };
    if (BAD_LABELS.has(value)) return { border: 'rgba(239,68,68,0.40)', text: colors.ratingPoor };
    if (MID_LABELS.has(value)) return { border: 'rgba(251,191,36,0.40)', text: colors.ratingMid };
    return { border: 'rgba(52,211,153,0.35)', text: colors.ratingHigh };
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
  const visibility = visibilityText(weather, isMetric);

  return (
    <View style={st.root}>
      {/* Always-visible wind + humidity */}
      <GlassGroup spacing={spacing.sm} style={st.grid}>
        <Stat label="Wind"     value={windText(weather, isMetric)} />
        <Stat label="Humidity" value={`${weather.RelativeHumidity}%`} />
      </GlassGroup>

      {!showAll && <Pressable
        style={st.toggle}
        onPress={() => setExpanded(v => !v)}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
      >
        <Text style={st.toggleText}>{expanded ? 'Less' : 'More details'}</Text>
        <Svg width={16} height={16} viewBox="0 0 16 16" fill="none"
          style={{ transform: [{ rotate: expanded ? '180deg' : '0deg' }] }}
          accessibilityElementsHidden
          importantForAccessibility="no">
          <Path d="M4 6l4 4 4-4" stroke={colors.textSecondary} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"/>
        </Svg>
      </Pressable>}

      {(expanded || showAll) && (
        <>
          <GlassGroup spacing={spacing.sm} style={st.grid}>
            <Stat label="UV Index"   value={weather.UVIndexText} />
            {showAll && visibility ? (
              <Stat label="Visibility" value={visibility} />
            ) : (
              <Stat label="Feels like" value={`${isMetric
                ? weather.RealFeelTemperature.Metric.Value
                : weather.RealFeelTemperature.Imperial.Value}°`} />
            )}
          </GlassGroup>

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
});
WeatherStats.displayName = 'WeatherStats';

interface StatsLineProps {
  weather: CurrentWeather;
  settings: Settings;
  /** Merged onto the text, for a pale sky behind it. */
  textStyle?: StyleProp<TextStyle>;
}

/**
 * The four stats as one line straight on the sky, with hairlines and no boxes.
 * For Home above the fold on the rotated Duo, where the hourly chips already sit
 * right above it and four more boxes would crowd them.
 */
export const WeatherStatsLine = memo(({ weather, settings, textStyle }: StatsLineProps) => {
  const { colors } = useTheme();
  const st = useMemo(() => makeStyles(colors), [colors]);
  const isMetric = settings.temperatureScale === 'Metric';
  const visibility = visibilityText(weather, isMetric);
  const stats = [
    { label: 'Wind', value: windText(weather, isMetric) },
    { label: 'Humidity', value: `${weather.RelativeHumidity}%` },
    { label: 'UV Index', value: weather.UVIndexText },
    ...(visibility ? [{ label: 'Visibility', value: visibility }] : []),
  ];

  return (
    <View style={st.line}>
      {stats.map(({ label, value }, i) => (
        <View
          key={label}
          style={[st.lineCell, i > 0 && st.lineCellDivided]}
          accessible
          accessibilityLabel={`${label}: ${value}`}
        >
          <Text style={[st.lineLabel, textStyle]} numberOfLines={1}>{label}</Text>
          <Text style={[st.lineValue, textStyle]} numberOfLines={1}>{value}</Text>
        </View>
      ))}
    </View>
  );
});
WeatherStatsLine.displayName = 'WeatherStatsLine';

const WeatherDetails = ({ weather, settings, forecasts, daily, city, coords, showStats = true }: Props) => {
  const { colors } = useTheme();
  const st = useMemo(() => makeStyles(colors), [colors]);
  // Defer the (heavy, below-the-fold) outfit engine until the HUD has painted.
  const showOutfit = useDeferredMount();

  return (
    <View style={st.root}>
      {showOutfit ? (
        <OutfitSuggestion weather={weather} settings={settings} forecasts={forecasts} daily={daily} city={city} coords={coords} />
      ) : (
        <View style={st.outfitPlaceholder}>
          <ActivityIndicator color={colors.textMuted} />
        </View>
      )}

      {showStats && <WeatherStats weather={weather} settings={settings} />}
    </View>
  );
};

// Memoised: WeatherHUD re-renders whenever `miniVisible` flips (which happens
// mid-scroll, driven from the scroll worklet via runOnJS) and whenever the 60s
// solar tick produces a new `sun` object. Without this, each of those
// re-rendered this entire subtree — including OutfitSuggestion's pager and
// thumbnails — so the cost of a scroll-threshold crossing scaled with however
// much content the outfit card happened to be showing.
//
// Every prop below is referentially stable between fetches (`settings` is a
// useState value from SettingsContext; `coords` is WeatherHUD's `place` state),
// so the default shallow compare is enough.
export default memo(WeatherDetails);
