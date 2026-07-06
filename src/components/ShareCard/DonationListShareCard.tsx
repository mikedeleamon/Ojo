import { forwardRef } from 'react';
import { Image } from 'react-native';
import { View, Text } from '../primitives';
import { ArticleInsight } from '../../lib/insightsEngine';
import ShareCardFrame from './ShareCardFrame';
import { CARD_WIDTH } from './ShareCardFrame.styles';
import cs from './shareCardCommon.styles';

interface DonationListShareCardProps {
  items: ArticleInsight[];
}

const GRID_GAP = 8;
const GRID_PAD = 24 * 2;

function tileSize(count: number) {
  const perRow = count <= 1 ? 1 : 2;
  const width = (CARD_WIDTH - GRID_PAD - GRID_GAP * (perRow - 1)) / perRow;
  return { width, height: width * 1.15 };
}

const articleLabel = (insight: ArticleInsight): string =>
  insight.article.name || insight.article.clothingType || 'Item';

const DonationListShareCard = forwardRef<View, DonationListShareCardProps>(
  ({ items }, ref) => {
    const photos = items.slice(0, 4);
    const { width, height } = tileSize(photos.length);
    const overflow = items.length - photos.length;

    return (
      <ShareCardFrame gradientColors={['#134E4A', '#0F172A', '#0F172A']} ref={ref}>
        <Text style={cs.eyebrow}>Closet Refresh</Text>
        <Text style={cs.headline}>
          {items.length} item{items.length !== 1 ? 's' : ''}
        </Text>
        <Text style={cs.subline}>heading to donation ♻️</Text>

        <View style={cs.photoGrid}>
          {photos.map((insight, i) => (
            <View
              key={insight.article._id ?? i}
              style={[cs.photoTile, { width, height }]}
            >
              {insight.article.imageUrl && (
                <Image
                  source={{ uri: insight.article.imageUrl }}
                  style={cs.photoImage}
                  resizeMode='cover'
                />
              )}
            </View>
          ))}
        </View>

        <View style={[cs.weatherChip, { maxWidth: CARD_WIDTH - GRID_PAD }]}>
          <Text style={cs.weatherChipText} numberOfLines={1} ellipsizeMode='tail'>
            {overflow > 0
              ? `${photos.map(articleLabel).join(', ')} +${overflow} more`
              : photos.map(articleLabel).join(' · ')}
          </Text>
        </View>
      </ShareCardFrame>
    );
  },
);

DonationListShareCard.displayName = 'DonationListShareCard';

export default DonationListShareCard;
