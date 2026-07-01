import { useMemo } from 'react';
import { ScrollView, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { Text, Pressable } from './primitives';
import { useTheme } from '../theme/ThemeContext';
import { ColorTokens, fonts, fontSizes, fontWeights, radius } from '../theme/tokens';
import type { OutfitOccasion } from '../types';

/** Occasion presets shown as a horizontal chip row. Single source of truth —
 *  previously duplicated in OutfitSuggestion and TripFit's shared.ts. */
export const OCCASION_CHIPS: { value: OutfitOccasion; label: string }[] = [
    { value: 'everyday', label: 'Everyday' },
    { value: 'work', label: 'Work' },
    { value: 'weekend', label: 'Weekend' },
    { value: 'date', label: 'Date' },
    { value: 'outdoor', label: 'Outdoor' },
    { value: 'athletic', label: 'Athletic' },
];

interface Props {
    active: OutfitOccasion;
    onChange: (o: OutfitOccasion) => void;
    /** Extra styling for the scroll content row (e.g. padding). */
    containerStyle?: StyleProp<ViewStyle>;
}

/**
 * Horizontal, single-select occasion chip row. Rendered as a radio group for
 * screen readers. Solid-fill chips (glassBg unselected, saveBtnBg when active)
 * to match the original OutfitSuggestion look.
 */
const OccasionChips = ({ active, onChange, containerStyle }: Props) => {
    const { colors } = useTheme();
    const styles = useMemo(() => makeStyles(colors), [colors]);
    return (
        <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={[styles.row, containerStyle]}
        >
            {OCCASION_CHIPS.map(({ value, label }) => {
                const isActive = active === value;
                return (
                    <Pressable
                        key={value}
                        onPress={() => onChange(value)}
                        hitSlop={4}
                        style={[styles.chip, isActive && styles.chipActive]}
                        accessibilityRole="radio"
                        accessibilityState={{ checked: isActive }}
                    >
                        <Text
                            style={[
                                styles.chipText,
                                isActive && styles.chipTextActive,
                            ]}
                        >
                            {label}
                        </Text>
                    </Pressable>
                );
            })}
        </ScrollView>
    );
};

const makeStyles = (colors: ColorTokens) =>
    StyleSheet.create({
        row: { flexDirection: 'row', gap: 8, paddingVertical: 2 },
        chip: {
            paddingVertical: 5,
            paddingHorizontal: 12,
            borderRadius: radius.pill,
            borderWidth: 1,
            borderColor: colors.glassBorder,
            backgroundColor: colors.glassBg,
        },
        chipActive: {
            backgroundColor: colors.saveBtnBg,
            borderColor: colors.saveBtnBg,
        },
        chipText: {
            fontFamily: fonts.body,
            fontSize: fontSizes.xs,
            color: colors.textSecondary,
            fontWeight: fontWeights.medium,
        },
        chipTextActive: {
            color: colors.saveBtnText,
            fontWeight: fontWeights.semibold,
        },
    });

export default OccasionChips;
