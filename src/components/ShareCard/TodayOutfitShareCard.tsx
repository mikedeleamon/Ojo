import { forwardRef } from 'react';
import { Image } from 'react-native';
import { View, Text } from '../primitives';
import { OutfitSlot } from '../../lib/outfit/types';
import { CurrentWeather } from '../../types';
import { humanizeConditionShort } from '../../lib/weather/humanizeCondition';
import { phraseEmoji } from '../../views/TripFit/shared';
import ShareCardFrame from './ShareCardFrame';
import { contentWidth, type ShareCardVariant } from './ShareCardFrame.styles';
import cs from './shareCardCommon.styles';
import type { ViewRef } from '../../types/nativeRefs';
import { degreesIn, type TempScale } from '../../lib/units';

interface TodayOutfitShareCardProps {
  slots: OutfitSlot[];
  score: number;
  isPersonalized?: boolean;
  weather: CurrentWeather;
  /** The user's temperature scale. */
  tempScale: TempScale;
  /** 'sticker' for a video Story; see ShareCardFrame. */
  variant?: ShareCardVariant;
}

const GRID_GAP = 8;

const scoreColor = (score: number) =>
  score >= 80 ? '#34D399' : score >= 60 ? '#FBBF24' : '#94A3B8';

/**
 * Tile size for up to 4 photos inside the frame's content width: 2 per row on
 * the poster, all in one row on the sticker so it stays short over the video.
 */
function tileSize(count: number, variant: ShareCardVariant) {
  const perRow = variant === 'sticker' ? Math.max(1, count) : count <= 1 ? 1 : 2;
  const width = (contentWidth(variant) - GRID_GAP * (perRow - 1)) / perRow;
  return { width, height: width * 1.15 };
}

const TodayOutfitShareCard = forwardRef<ViewRef, TodayOutfitShareCardProps>(
  ({ slots, score, isPersonalized, weather, tempScale, variant = 'poster' }, ref) => {
    const photos = slots.slice(0, 4);
    const { width, height } = tileSize(photos.length, variant);
    const temp = degreesIn(weather.Temperature.Imperial.Value, tempScale);
    // The phone's own locale, not a fixed US format.
    const dateLabel = new Date().toLocaleDateString(undefined, {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
    });

    return (
      <ShareCardFrame ref={ref} variant={variant}>
        <Text style={cs.eyebrow}>Today's Fit</Text>
        <Text style={cs.headline}>{dateLabel}</Text>

        <View style={cs.weatherChip}>
          <Text style={cs.weatherChipText}>
            {phraseEmoji(weather.WeatherText)} {temp}°{' '}
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
