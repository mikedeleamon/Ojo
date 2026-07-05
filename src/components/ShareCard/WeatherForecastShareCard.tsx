import { forwardRef } from 'react';
import { View, Text } from '../primitives';
import { CurrentWeather, DailyForecast } from '../../types';
import { humanizeConditionShort } from '../../lib/weather/humanizeCondition';
import { phraseEmoji } from '../../views/TripFit/shared';
import ShareCardFrame from './ShareCardFrame';
import cs from './shareCardCommon.styles';
import { fonts, fontSizes } from '../../theme/tokens';
import { StyleSheet } from 'react-native';

interface WeatherForecastShareCardProps {
  place: string;
  weather: CurrentWeather;
  /** Next few days, soonest first — typically WeatherSnapshot.daily.slice(0, 5). */
  daily: DailyForecast[];
}

const styles = StyleSheet.create({
  dayRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 28,
    gap: 6,
  },
  dayTile: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    gap: 4,
  },
  dayLabel: {
    fontFamily: fonts.bodySemiBold,
    fontSize: fontSizes.xs,
    color: 'rgba(255,255,255,0.7)',
  },
  dayEmoji: {
    fontSize: 18,
  },
  dayTemp: {
    fontFamily: fonts.bodyMedium,
    fontSize: fontSizes.xs,
    color: '#FFFFFF',
  },
});

const dayAbbrev = (iso: string) =>
  new Date(iso + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short' });

const WeatherForecastShareCard = forwardRef<View, WeatherForecastShareCardProps>(
  ({ place, weather, daily }, ref) => {
    const tempF = Math.round(weather.Temperature.Imperial.Value);
    const upcoming = daily.slice(0, 5);

    return (
      <ShareCardFrame gradientColors={['#0C4A6E', '#0F172A', '#0F172A']} ref={ref}>
        <Text style={cs.eyebrow}>{place}</Text>
        <Text style={cs.headline}>{tempF}°</Text>
        <Text style={cs.subline}>
          {phraseEmoji(weather.WeatherText)} {humanizeConditionShort(weather.WeatherText)}
        </Text>

        <View style={styles.dayRow}>
          {upcoming.map((d) => (
            <View key={d.date} style={styles.dayTile}>
              <Text style={styles.dayLabel}>{dayAbbrev(d.date)}</Text>
              <Text style={styles.dayEmoji}>{phraseEmoji(d.dayPhrase)}</Text>
              <Text style={styles.dayTemp}>
                {Math.round(d.maxTempF)}°/{Math.round(d.minTempF)}°
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
