import { forwardRef } from 'react';
import { Image } from 'react-native';
import { View, Text } from '../primitives';
import { OutfitSlot } from '../../lib/outfit/types';
import { DailyForecast } from '../../types';
import { phraseEmoji, fmtDate } from '../../views/TripFit/shared';
import ShareCardFrame from './ShareCardFrame';
import { contentWidth, type ShareCardVariant } from './ShareCardFrame.styles';
import cs from './shareCardCommon.styles';

interface TripFitShareCardProps {
  destination: string;
  day: DailyForecast;
  slots: OutfitSlot[];
  /** e.g. "Day 2 of 5" */
  dayLabel?: string;
  /** 'sticker' for a video Story; see ShareCardFrame. */
  variant?: ShareCardVariant;
}

const GRID_GAP = 8;

/** As in TodayOutfitShareCard: 2 per row on the poster, one row on the sticker. */
function tileSize(count: number, variant: ShareCardVariant) {
  const perRow = variant === 'sticker' ? Math.max(1, count) : count <= 1 ? 1 : 2;
  const width = (contentWidth(variant) - GRID_GAP * (perRow - 1)) / perRow;
  return { width, height: width * 1.15 };
}

const TripFitShareCard = forwardRef<View, TripFitShareCardProps>(
  ({ destination, day, slots, dayLabel, variant = 'poster' }, ref) => {
    const photos = slots.slice(0, 4);
    const { width, height } = tileSize(photos.length, variant);

    return (
      <ShareCardFrame gradientColors={['#1E293B', '#334155', '#0F172A']} variant={variant} ref={ref}>
        <Text style={cs.eyebrow}>{dayLabel ?? 'TripFit'}</Text>
        <Text style={cs.headline}>{destination}</Text>
        <Text style={cs.subline}>{fmtDate(day.date)}</Text>

        <View style={cs.weatherChip}>
          <Text style={cs.weatherChipText}>
            {phraseEmoji(day.dayPhrase)} {Math.round(day.minTempF)}°–
            {Math.round(day.maxTempF)}°
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
      </ShareCardFrame>
    );
  },
);

TripFitShareCard.displayName = 'TripFitShareCard';

export default TripFitShareCard;
