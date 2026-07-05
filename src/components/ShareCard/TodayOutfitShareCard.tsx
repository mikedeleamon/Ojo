import { forwardRef } from 'react';
import { Image } from 'react-native';
import { View, Text } from '../primitives';
import { OutfitSlot } from '../../lib/outfit/types';
import { CurrentWeather } from '../../types';
import { humanizeConditionShort } from '../../lib/weather/humanizeCondition';
import { phraseEmoji } from '../../views/TripFit/shared';
import ShareCardFrame from './ShareCardFrame';
import { CARD_WIDTH } from './ShareCardFrame.styles';
import cs from './shareCardCommon.styles';

interface TodayOutfitShareCardProps {
  slots: OutfitSlot[];
  score: number;
  isPersonalized?: boolean;
  weather: CurrentWeather;
}

const GRID_GAP = 8;
const GRID_PAD = 24 * 2; // safeArea paddingHorizontal, both sides

const scoreColor = (score: number) =>
  score >= 80 ? '#34D399' : score >= 60 ? '#FBBF24' : '#94A3B8';

/** Tile size for up to 4 photos, laid out 2-per-row inside the frame's width. */
function tileSize(count: number) {
  const perRow = count <= 1 ? 1 : 2;
  const width = (CARD_WIDTH - GRID_PAD - GRID_GAP * (perRow - 1)) / perRow;
  return { width, height: width * 1.15 };
}

const TodayOutfitShareCard = forwardRef<View, TodayOutfitShareCardProps>(
  ({ slots, score, isPersonalized, weather }, ref) => {
    const photos = slots.slice(0, 4);
    const { width, height } = tileSize(photos.length);
    const tempF = Math.round(weather.Temperature.Imperial.Value);
    const dateLabel = new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
    });

    return (
      <ShareCardFrame ref={ref}>
        <Text style={cs.eyebrow}>Today's Fit</Text>
        <Text style={cs.headline}>{dateLabel}</Text>

        <View style={cs.weatherChip}>
          <Text style={cs.weatherChipText}>
            {phraseEmoji(weather.WeatherText)} {tempF}°{' '}
            {humanizeConditionShort(weather.WeatherText)}
          </Text>
        </View>

        <View style={cs.photoGrid}>
          {photos.map((slot, i) => (
            <View key={slot.article._id ?? i} style={[cs.photoTile, { width, height }]}>
              <Image
                source={{ uri: slot.article.imageUrl }}
                style={cs.photoImage}
                resizeMode='cover'
              />
            </View>
          ))}
        </View>

        <View style={[cs.scorePill, { borderColor: scoreColor(score) }]}>
          <Text style={[cs.scorePillText, { color: scoreColor(score) }]}>
            {isPersonalized ? 'Your Score' : 'Outfit Score'}: {score}
            {isPersonalized ? ' ★' : ''}
          </Text>
        </View>
      </ShareCardFrame>
    );
  },
);

TodayOutfitShareCard.displayName = 'TodayOutfitShareCard';

export default TodayOutfitShareCard;
