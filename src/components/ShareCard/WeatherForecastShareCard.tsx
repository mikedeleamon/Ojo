import { forwardRef } from 'react';
import { View, Text } from '../primitives';
import { CurrentWeather, Forecast } from '../../types';
import { humanizeConditionShort } from '../../lib/weather/humanizeCondition';
import { fToC } from '../../lib/units';
import WeatherIconDisplay from '../WeatherIconDisplay/WeatherIconDisplay';
import ShareCardFrame from './ShareCardFrame';
import cs from './shareCardCommon.styles';
import { fonts, fontSizes } from '../../theme/tokens';
import { StyleSheet } from 'react-native';

interface WeatherForecastShareCardProps {
  place: string;
  weather: CurrentWeather;
  /** Next few hours, soonest first — typically WeatherSnapshot.forecasts.slice(0, 5). */
  hourly: Forecast[];
  /** Render temperatures in °C rather than °F. */
  isMetric?: boolean;
}

const styles = StyleSheet.create({
  conditionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
  },
  hourRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 28,
    gap: 6,
  },
  hourTile: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    gap: 6,
  },
  hourLabel: {
    fontFamily: fonts.bodySemiBold,
    fontSize: fontSizes.xs,
    color: 'rgba(255,255,255,0.7)',
  },
  hourTemp: {
    fontFamily: fonts.bodyMedium,
    fontSize: fontSizes.xs,
    color: '#FFFFFF',
  },
});

// e.g. "3 PM" → "3PM" — compact enough for the narrow hour tiles.
const hourLabel = (iso: string) =>
  new Date(iso)
    .toLocaleTimeString('en-US', { hour: 'numeric' })
    .replace(/\s+/g, '');

const WeatherForecastShareCard = forwardRef<View, WeatherForecastShareCardProps>(
  ({ place, weather, hourly, isMetric = false }, ref) => {
    // Hourly forecast temps are always Fahrenheit; convert per the unit setting.
    const currentTemp = Math.round(
      isMetric
        ? weather.Temperature.Metric.Value
        : weather.Temperature.Imperial.Value,
    );
    const upcoming = hourly.slice(0, 5);

    return (
      <ShareCardFrame gradientColors={['#0C4A6E', '#0F172A', '#0F172A']} ref={ref}>
        <Text style={cs.eyebrow}>{place}</Text>
        <Text style={cs.headline}>{currentTemp}°</Text>
        <View style={styles.conditionRow}>
          <WeatherIconDisplay
            condition={weather.WeatherText}
            isDay={weather.IsDayTime}
            size='small'
          />
          <Text style={cs.subline}>
            {humanizeConditionShort(weather.WeatherText)}
          </Text>
        </View>

        <View style={styles.hourRow}>
          {upcoming.map((h, i) => (
            <View key={h.DateTime} style={styles.hourTile}>
              <Text style={styles.hourLabel}>
                {i === 0 ? 'Now' : hourLabel(h.DateTime)}
              </Text>
              <WeatherIconDisplay
                condition={h.IconPhrase}
                isDay={h.IsDaylight}
                size='small'
              />
              <Text style={styles.hourTemp}>
                {isMetric
                  ? fToC(h.Temperature.Value)
                  : Math.round(h.Temperature.Value)}
                °
              </Text>
            </View>
          ))}
        </View>
      </ShareCardFrame>
    );
  },
);

WeatherForecastShareCard.displayName = 'WeatherForecastShareCard';

export default WeatherForecastShareCard;
