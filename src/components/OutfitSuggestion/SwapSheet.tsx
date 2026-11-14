/**
 * SwapSheet — long-press a piece on the outfit card and this offers two or three
 * pieces from the closet that could stand in for it and still make a good outfit
 * today (lib/outfitEngine swapAlternatives). Each shows how the outfit's score
 * changes; tapping one makes the swap.
 */

import { memo, useMemo } from 'react';
import { Image, Modal, ScrollView, StyleSheet } from 'react-native';
import { View, Text, Pressable } from '../primitives';
import GarmentSilhouette, { hasSilhouette } from '../GarmentSilhouette';
import { HangerIcon } from '../shared/HangerIcon';
import { usePaneOverlay } from '../../hooks/usePaneOverlay';
import { useTheme } from '../../theme/ThemeContext';
import { fonts, fontSizes, radius, spacing, type ColorTokens } from '../../theme/tokens';
import { CSS_COLORS } from './constants';
import { articleDisplayName, type ClothingArticle } from '../../types';
import type { SwapOption } from '../../lib/outfitEngine';

interface Props {
    /** The piece being swapped out; null hides the sheet. */
    current: { article: ClothingArticle; roleLabel: string; score: number } | null;
    options: SwapOption[];
    onPick: (option: SwapOption) => void;
    onClose: () => void;
}

const Thumb = ({ article, colors }: { article: ClothingArticle; colors: ColorTokens }) => (
    <View style={[styles.thumb, { backgroundColor: colors.glassBg, borderColor: colors.glassBorder }]}>
        {article.imageUrl ? (
            <Image source={{ uri: article.imageUrl }} style={StyleSheet.absoluteFill} resizeMode='cover' />
        ) : hasSilhouette(article.clothingType) ? (
            <GarmentSilhouette clothingType={article.clothingType} size={24} />
        ) : (
            <HangerIcon size={20} color={colors.textMuted} />
        )}
        {article.color && CSS_COLORS[article.color] ? (
            <View style={[styles.dot, { backgroundColor: CSS_COLORS[article.color] }]} />
        ) : null}
    </View>
);

/** "+2", "−3", or "Same score". */
const deltaLabel = (delta: number) =>
    delta === 0 ? 'Same score' : delta > 0 ? `+${delta}` : `−${Math.abs(delta)}`;

function SwapSheet({ current, options, onPick, onClose }: Props) {
    const { colors } = useTheme();
    const overlay = usePaneOverlay();
    const currentName = current ? articleDisplayName(current.article) : '';
    const title = useMemo(() => (current ? `Swap the ${current.roleLabel.toLowerCase()}` : ''), [current]);

    return (
        <Modal visible={!!current} transparent animationType='slide' onRequestClose={onClose}>
            <Pressable style={styles.backdrop} onPress={onClose} accessibilityRole='button' accessibilityLabel='Close' />
            <View style={[styles.sheet, { backgroundColor: colors.bgDefault, borderColor: colors.glassBorder }, overlay]}>
                <View style={[styles.grabber, { backgroundColor: colors.glassBorder }]} />
                <Text style={[styles.title, { color: colors.textPrimary }]} accessibilityRole='header'>
                    {title}
                </Text>
                {current && (
                    <View style={styles.currentRow}>
                        <Thumb article={current.article} colors={colors} />
                        <View style={styles.rowText}>
                            <Text style={[styles.label, { color: colors.textMuted }]}>Wearing now</Text>
                            <Text style={[styles.name, { color: colors.textPrimary }]} numberOfLines={1}>
                                {currentName}
                            </Text>
                        </View>
                        <Text style={[styles.score, { color: colors.textSecondary }]}>{current.score}</Text>
                    </View>
                )}

                {options.length === 0 ? (
                    <Text style={[styles.empty, { color: colors.textSecondary }]}>
                        Nothing else in this closet works as well today. Only pieces that suit the
                        weather and keep the outfit scoring well are offered.
                    </Text>
                ) : (
                    <ScrollView contentContainerStyle={styles.list}>
                        <Text style={[styles.label, { color: colors.textMuted }]}>Try instead</Text>
                        {options.map((o) => (
                            <Pressable
                                key={o.article._id}
                                onPress={() => onPick(o)}
                                style={({ pressed }) => [
                                    styles.option,
                                    { borderColor: colors.glassBorder, backgroundColor: pressed ? colors.glassBgStrong : colors.glassBg },
                                ]}
                                accessibilityRole='button'
                                accessibilityLabel={`Swap to ${articleDisplayName(o.article)}, outfit score ${o.outfit.score}, ${deltaLabel(o.delta)}`}
                            >
                                <Thumb article={o.article} colors={colors} />
                                <View style={styles.rowText}>
                                    <Text style={[styles.name, { color: colors.textPrimary }]} numberOfLines={1}>
                                        {articleDisplayName(o.article)}
                                    </Text>
                                    {o.article.fabricType ? (
                                        <Text style={[styles.meta, { color: colors.textMuted }]} numberOfLines={1}>
                                            {[o.article.color, o.article.fabricType].filter(Boolean).join(' · ')}
                                        </Text>
                                    ) : null}
                                </View>
                                <View style={styles.scoreCol}>
                                    <Text style={[styles.score, { color: colors.textPrimary }]}>{o.outfit.score}</Text>
                                    <Text
                                        style={[
                                            styles.delta,
                                            { color: o.delta > 0 ? colors.ratingHigh : o.delta < 0 ? colors.textMuted : colors.textSecondary },
                                        ]}
                                    >
                                        {deltaLabel(o.delta)}
                                    </Text>
                                </View>
                            </Pressable>
                        ))}
                    </ScrollView>
                )}

                <Pressable onPress={onClose} style={styles.keep} accessibilityRole='button' accessibilityLabel={`Keep ${currentName}`}>
                    <Text style={[styles.keepText, { color: colors.textSecondary }]}>Keep {currentName}</Text>
                </Pressable>
            </View>
        </Modal>
    );
}

export default memo(SwapSheet);

const styles = StyleSheet.create({
    backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.4)' },
    sheet: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        maxHeight: '75%',
        borderTopLeftRadius: radius.lg,
        borderTopRightRadius: radius.lg,
        borderWidth: StyleSheet.hairlineWidth,
        paddingTop: spacing.xsPlus,
        paddingBottom: spacing.xl,
        paddingHorizontal: spacing.md,
        gap: spacing.sm,
    },
    grabber: { alignSelf: 'center', width: 36, height: 4, borderRadius: 2, marginBottom: spacing.xs },
    title: { fontFamily: fonts.display, fontSize: fontSizes.xl },
    currentRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xs },
    list: { gap: spacing.xsPlus, paddingBottom: spacing.xs },
    option: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        padding: spacing.xsPlus,
        borderRadius: radius.md,
        borderWidth: StyleSheet.hairlineWidth,
    },
    thumb: {
        width: 52,
        height: 52,
        borderRadius: radius.sm,
        overflow: 'hidden',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: StyleSheet.hairlineWidth,
    },
    dot: { position: 'absolute', right: 4, bottom: 4, width: 9, height: 9, borderRadius: 4.5, borderWidth: 1, borderColor: 'rgba(255,255,255,0.6)' },
    rowText: { flex: 1, gap: 2 },
    label: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.xs, letterSpacing: 0.8, textTransform: 'uppercase' },
    name: { fontFamily: fonts.bodyMedium, fontSize: fontSizes.base },
    meta: { fontFamily: fonts.body, fontSize: fontSizes.xs },
    scoreCol: { alignItems: 'flex-end', gap: 1 },
    score: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.md },
    delta: { fontFamily: fonts.body, fontSize: fontSizes.xs },
    empty: { fontFamily: fonts.body, fontSize: fontSizes.sm, lineHeight: 20, paddingVertical: spacing.sm },
    keep: { alignSelf: 'center', paddingVertical: spacing.xsPlus },
    keepText: { fontFamily: fonts.bodyMedium, fontSize: fontSizes.sm },
});
