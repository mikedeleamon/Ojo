import { forwardRef } from 'react';
import { Image } from 'react-native';
import { View, Text } from '../primitives';
import { OutfitSlot } from '../../lib/outfit/types';
import { DailyForecast } from '../../types';
import { phraseEmoji, fmtDate } from '../../views/TripFit/shared';
import ShareCardFrame from './ShareCardFrame';
import { CARD_WIDTH } from './ShareCardFrame.styles';
import cs from './shareCardCommon.styles';

interface TripFitShareCardProps {
  destination: string;
  day: DailyForecast;
  slots: OutfitSlot[];
  /** e.g. "Day 2 of 5" */
  dayLabel?: string;
}

const GRID_GAP = 8;
const GRID_PAD = 24 * 2;

function tileSize(count: number) {
  const perRow = count <= 1 ? 1 : 2;
  const width = (CARD_WIDTH - GRID_PAD - GRID_GAP * (perRow - 1)) / perRow;
  return { width, height: width * 1.15 };
}

const TripFitShareCard = forwardRef<View, TripFitShareCardProps>(
  ({ destination, day, slots, dayLabel }, ref) => {
    const photos = slots.slice(0, 4);
    const { width, height } = tileSize(photos.length);

    return (
      <ShareCardFrame gradientColors={['#1E293B', '#334155', '#0F172A']} ref={ref}>
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
