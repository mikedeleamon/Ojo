import { forwardRef } from 'react';
import { StyleSheet } from 'react-native';
import { View, Text } from '../primitives';
import { ClothingArticle } from '../../types';
import { PACKING_GROUPS, categoryKey } from '../../views/TripFit/shared';
import { PackingCategoryIcon } from '../icons/PackingCategoryIcon';
import SuitcaseIcon from '../icons/SuitcaseIcon';
import ShareCardFrame from './ShareCardFrame';
import cs from './shareCardCommon.styles';
import { fonts, fontSizes } from '../../theme/tokens';

interface PackingListShareCardProps {
  destination: string;
  packingList: ClothingArticle[];
  /** e.g. "6 days · Mar 12 – Mar 18" */
  dateRangeLabel?: string;
}

const styles = StyleSheet.create({
  groupList: {
    marginTop: 24,
    gap: 14,
  },
  groupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  groupLabel: {
    fontFamily: fonts.bodySemiBold,
    fontSize: fontSizes.sm,
    color: '#FFFFFF',
  },
  groupItems: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    color: 'rgba(255,255,255,0.7)',
  },
});

const itemLabel = (a: ClothingArticle): string => a.name || a.clothingType || 'Item';

const PackingListShareCard = forwardRef<View, PackingListShareCardProps>(
  ({ destination, packingList, dateRangeLabel }, ref) => {
    const groups = PACKING_GROUPS.map((g) => ({
      ...g,
      items: packingList.filter((a) => categoryKey(a) === g.key),
    })).filter((g) => g.items.length > 0);

    return (
      <ShareCardFrame gradientColors={['#1E293B', '#334155', '#0F172A']} ref={ref}>
        <Text style={cs.eyebrow}>Packing List</Text>
        <Text style={cs.headline}>{destination}</Text>
        {dateRangeLabel ? <Text style={cs.subline}>{dateRangeLabel}</Text> : null}

        <View style={cs.weatherChip}>
          <SuitcaseIcon size={14} color='#FFFFFF' />
          <Text style={cs.weatherChipText}>
            {packingList.length} item{packingList.length !== 1 ? 's' : ''} packed
          </Text>
        </View>

        <View style={styles.groupList}>
          {groups.map((g) => (
            <View key={g.key} style={styles.groupRow}>
              <PackingCategoryIcon category={g.key} size={14} color='#FFFFFF' />
              <Text style={styles.groupLabel}>{g.label}</Text>
              <Text style={styles.groupItems} numberOfLines={1} ellipsizeMode='tail'>
                {g.items.map(itemLabel).join(', ')}
              </Text>
            </View>
          ))}
        </View>
      </ShareCardFrame>
    );
  },
);

PackingListShareCard.displayName = 'PackingListShareCard';

export default PackingListShareCard;
