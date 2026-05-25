import { useMemo } from 'react';
import { Pressable, Image, Animated, StyleSheet, Alert } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { LinearGradient } from 'expo-linear-gradient';
import { View, Text } from '../primitives';
import { HangerIcon } from '../shared/HangerIcon';
import { useTheme } from '../../theme/ThemeContext';
import { fonts, fontSizes, fontWeights, radius } from '../../theme/tokens';
import type { ClothingArticle } from '../../types';
import {
    COLOR_NEUTRALS,
    SEASONAL_COLORS,
    currentSeason,
    garmentWarmth,
} from '../../lib/outfitEngine';
import { CSS_COLORS } from '../../lib/colors/cssColors';
import {
    METALLIC_GRADIENTS,
    METALLIC_START,
    METALLIC_END,
} from '../../lib/colors/metallicGradients';
import { makeStyles } from './ClosetView.styles';

const WARMTH_DOT_COLOR = (w: number) =>
    w < 0.25 ? '#38bdf8' : w < 0.55 ? '#fbbf24' : '#f97316';

interface ArticleCardProps {
    article: ClothingArticle;
    harmonyScore?: number;
    outOfSeason?: boolean;
    onEdit: () => void;
    onRemove: () => void;
}

export const ArticleCard = ({
    article,
    harmonyScore,
    outOfSeason,
    onEdit,
}: ArticleCardProps) => {
    const { colors } = useTheme();
    const styles = useMemo(() => makeStyles(colors), [colors]);
    const warmth = garmentWarmth(article);
    const warmthColor = WARMTH_DOT_COLOR(warmth);
    const season = currentSeason();
    const isInSeason =
        !!article.color && SEASONAL_COLORS[season].has(article.color);
    const lowHarmony =
        harmonyScore !== undefined &&
        harmonyScore < 0.55 &&
        !!article.color &&
        !COLOR_NEUTRALS.has(article.color);

    return (
        <Pressable
            style={[styles.articleCard, outOfSeason && styles.articleCardOOS]}
            onPress={onEdit}
            accessibilityLabel='Edit article'
            accessibilityRole='button'
        >
            <View style={styles.articleImg}>
                {article.imageUrl ? (
                    <Image
                        source={{ uri: article.imageUrl }}
                        style={styles.articleImgFill}
                        resizeMode='cover'
                    />
                ) : (
                    <HangerIcon size={18} color={colors.textMuted} decorative />
                )}
                <View style={[styles.warmthDot, { backgroundColor: warmthColor }]} />
            </View>
            <View style={styles.articleInfo}>
                <View style={styles.nameRow}>
                    <Text style={styles.articleName} numberOfLines={1}>
                        {article.name || article.clothingType}
                    </Text>
                    {isInSeason && <Text style={styles.seasonBadge}>◆</Text>}
                </View>
                <Text
                    style={[styles.articleMeta, lowHarmony && styles.articleMetaClash]}
                    numberOfLines={1}
                >
                    {[article.clothingType, article.color, article.fabricType]
                        .filter(Boolean)
                        .join(' · ')}
                    {lowHarmony ? ' · may clash' : ''}
                </Text>
                {article.clothingCategory ? (
                    <Text style={styles.categoryTag}>{article.clothingCategory}</Text>
                ) : null}
            </View>
            {article.color &&
                (METALLIC_GRADIENTS[article.color] || CSS_COLORS[article.color]) &&
                (METALLIC_GRADIENTS[article.color] ? (
                    <LinearGradient
                        colors={METALLIC_GRADIENTS[article.color]}
                        start={METALLIC_START}
                        end={METALLIC_END}
                        style={styles.colorDot}
                    />
                ) : (
                    <View
                        style={[
                            styles.colorDot,
                            { backgroundColor: CSS_COLORS[article.color] },
                        ]}
                    />
                ))}
        </Pressable>
    );
};

// ─── Tile card ────────────────────────────────────────────────────────────────

interface TileArticleCardProps {
    article: ClothingArticle;
    harmonyScore?: number;
    tileWidth: number;
    onEdit: () => void;
    onRemove: () => void;
}

export const TileArticleCard = ({
    article,
    harmonyScore,
    tileWidth,
    onEdit,
    onRemove,
}: TileArticleCardProps) => {
    const { colors } = useTheme();
    const styles = useMemo(() => makeStyles(colors), [colors]);
    const warmth = garmentWarmth(article);
    const warmthColor = WARMTH_DOT_COLOR(warmth);
    const season = currentSeason();
    const isInSeason =
        !!article.color && SEASONAL_COLORS[season].has(article.color);
    const lowHarmony =
        harmonyScore !== undefined &&
        harmonyScore < 0.55 &&
        !!article.color &&
        !COLOR_NEUTRALS.has(article.color);

    const confirmDelete = () =>
        Alert.alert('Remove article?', article.name || article.clothingType, [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Remove', style: 'destructive', onPress: onRemove },
        ]);

    return (
        <Pressable
            style={[styles.tileCard, { width: tileWidth }]}
            onPress={onEdit}
            onLongPress={confirmDelete}
            accessibilityLabel={`Edit ${article.name || article.clothingType}. Long press to delete.`}
            accessibilityRole='button'
        >
            <View style={styles.tileImg}>
                {article.imageUrl ? (
                    <Image
                        source={{ uri: article.imageUrl }}
                        style={styles.tileImgFill}
                        resizeMode='cover'
                    />
                ) : (
                    <HangerIcon size={24} color={colors.textMuted} decorative />
                )}
                <View style={[styles.tileWarmthDot, { backgroundColor: warmthColor }]} />
            </View>
            <View style={styles.tileInfo}>
                <View style={styles.tileNameRow}>
                    <Text style={styles.tileName} numberOfLines={1}>
                        {article.name || article.clothingType}
                    </Text>
                    {isInSeason && (
                        <Text style={styles.seasonBadge}>◆</Text>
                    )}
                </View>
                <Text
                    style={[styles.tileMeta, lowHarmony && styles.tileMetaClash]}
                    numberOfLines={1}
                >
                    {[article.clothingType, article.color]
                        .filter(Boolean)
                        .join(' · ')}
                    {lowHarmony ? ' · ~' : ''}
                </Text>
                {article.color &&
                    (METALLIC_GRADIENTS[article.color] || CSS_COLORS[article.color]) &&
                    (METALLIC_GRADIENTS[article.color] ? (
                        <LinearGradient
                            colors={METALLIC_GRADIENTS[article.color]}
                            start={METALLIC_START}
                            end={METALLIC_END}
                            style={styles.tileColorDot}
                        />
                    ) : (
                        <View
                            style={[
                                styles.tileColorDot,
                                { backgroundColor: CSS_COLORS[article.color] },
                            ]}
                        />
                    ))}
            </View>
        </Pressable>
    );
};

// ─── Swipeable list card ───────────────────────────────────────────────────────

const swipeStyles = StyleSheet.create({
    deleteActionWrap: {
        width: 76,
        alignSelf: 'stretch',
    },
    deleteAction: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#FF3B30',
        borderTopLeftRadius: radius.sm,
        borderBottomLeftRadius: radius.sm,
        borderTopRightRadius: radius.sm,
        borderBottomRightRadius: radius.sm,
    },
    deleteText: {
        fontFamily: fonts.body,
        fontSize: fontSizes.sm,
        fontWeight: fontWeights.semibold,
        color: '#ffffff',
    },
});

export const SwipeableArticleCard = (props: ArticleCardProps) => {
    const renderRightActions = (
        _progress: ReturnType<Animated.Value['interpolate']>,
        dragX: ReturnType<Animated.Value['interpolate']>,
        swipeable: Swipeable,
    ) => {
        const translateX = dragX.interpolate({
            inputRange: [-76, 0],
            outputRange: [0, 76],
            extrapolate: 'clamp',
        });
        return (
            <Animated.View
                style={[swipeStyles.deleteActionWrap, { transform: [{ translateX }] }]}
            >
                <Pressable
                    style={swipeStyles.deleteAction}
                    onPress={() => {
                        swipeable.close();
                        props.onRemove();
                    }}
                >
                    <Text style={swipeStyles.deleteText}>Delete</Text>
                </Pressable>
            </Animated.View>
        );
    };

    return (
        <Swipeable
            renderRightActions={renderRightActions}
            rightThreshold={40}
            overshootRight={false}
        >
            <ArticleCard {...props} />
        </Swipeable>
    );
};
