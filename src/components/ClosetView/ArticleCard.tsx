import { memo, useMemo, useState } from 'react';
import { Pressable, Image, Animated, StyleSheet } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { LinearGradient } from 'expo-linear-gradient';
import { View, Text, GlassCard } from '../primitives';
import { HangerIcon } from '../shared/HangerIcon';
import { useConfirm } from '../ConfirmDialog';
import { useTheme } from '../../theme/ThemeContext';
import { fonts, fontSizes, fontWeights, radius } from '../../theme/tokens';
import type { ClothingArticle } from '../../types';
import { articleCategories } from '../../types';
import { CSS_COLORS } from '../../lib/colors/cssColors';
import {
    METALLIC_GRADIENTS,
    METALLIC_START,
    METALLIC_END,
} from '../../lib/colors/metallicGradients';
import { makeStyles } from './ClosetView.styles';

interface ArticleCardProps {
    article: ClothingArticle;
    outOfSeason?: boolean;
    onEdit: (article: ClothingArticle) => void;
    onRemove: (article: ClothingArticle) => void;
}

/** Small color swatch — metallic gradient or flat CSS color, or nothing. */
const ColorSwatch = ({ color, style }: { color?: string; style: object }) => {
    if (!color) return null;
    if (METALLIC_GRADIENTS[color])
        return (
            <LinearGradient
                colors={METALLIC_GRADIENTS[color]}
                start={METALLIC_START}
                end={METALLIC_END}
                style={style}
            />
        );
    if (CSS_COLORS[color])
        return <View style={[style, { backgroundColor: CSS_COLORS[color] }]} />;
    return null;
};

export const ArticleCard = memo(({
    article,
    outOfSeason,
    onEdit,
}: ArticleCardProps) => {
    const { colors, isDark } = useTheme();
    const styles = useMemo(() => makeStyles(colors), [colors]);
    const [erroredUrl, setErroredUrl] = useState<string | null>(null);
    const imgError = !!article.imageUrl && erroredUrl === article.imageUrl;

    return (
        <GlassCard
            style={[styles.articleCard, outOfSeason && styles.articleCardOOS]}
            tintColor={isDark ? undefined : 'rgba(0,0,0,0.07)'}
        >
            <Pressable
                style={styles.articleCardInner}
                onPress={() => onEdit(article)}
                accessibilityLabel='Edit article'
                accessibilityRole='button'
            >
                <View style={styles.articleImg}>
                    {article.imageUrl && !imgError ? (
                        <Image
                            source={{ uri: article.imageUrl }}
                            style={styles.articleImgFill}
                            resizeMode='cover'
                            onError={() =>
                                setErroredUrl(article.imageUrl ?? null)
                            }
                        />
                    ) : (
                        <HangerIcon
                            size={18}
                            color={colors.textMuted}
                            decorative
                        />
                    )}
                </View>
                <View style={styles.articleInfo}>
                    <Text
                        style={styles.articleName}
                        numberOfLines={1}
                    >
                        {article.name || article.clothingType}
                    </Text>
                    <Text
                        style={styles.articleMeta}
                        numberOfLines={1}
                    >
                        {[
                            article.clothingType,
                            article.color,
                            article.fabricType,
                        ]
                            .filter(Boolean)
                            .join(' · ')}
                    </Text>
                    {articleCategories(article).length > 0 ? (
                        <Text style={styles.categoryTag}>
                            {articleCategories(article).join(' · ')}
                        </Text>
                    ) : null}
                </View>
                <ColorSwatch
                    color={article.color}
                    style={styles.colorDot}
                />
            </Pressable>
        </GlassCard>
    );
});
ArticleCard.displayName = 'ArticleCard';

// ─── Tile card ────────────────────────────────────────────────────────────────

interface TileArticleCardProps {
    article: ClothingArticle;
    tileWidth: number;
    onEdit: (article: ClothingArticle) => void;
    onRemove: (article: ClothingArticle) => void;
}

export const TileArticleCard = memo(({
    article,
    tileWidth,
    onEdit,
    onRemove,
}: TileArticleCardProps) => {
    const { colors, isDark } = useTheme();
    const styles = useMemo(() => makeStyles(colors), [colors]);
    const [erroredUrl, setErroredUrl] = useState<string | null>(null);
    const imgError = !!article.imageUrl && erroredUrl === article.imageUrl;
    const confirm = useConfirm();

    const confirmDelete = async () => {
        const ok = await confirm({
            title: 'Remove article?',
            message: article.name || article.clothingType,
            confirmLabel: 'Remove',
            destructive: true,
        });
        if (ok) onRemove(article);
    };

    return (
        <GlassCard style={[styles.tileCard, { width: tileWidth }]} tintColor={isDark ? undefined : 'rgba(0,0,0,0.07)'}>
            <Pressable
                style={styles.tileCardInner}
                onPress={() => onEdit(article)}
                onLongPress={confirmDelete}
                accessibilityLabel={`Edit ${article.name || article.clothingType}. Long press to delete.`}
                accessibilityRole='button'
            >
                <View style={styles.tileImg}>
                    {article.imageUrl && !imgError ? (
                        <Image
                            source={{ uri: article.imageUrl }}
                            style={styles.tileImgFill}
                            resizeMode='cover'
                            onError={() =>
                                setErroredUrl(article.imageUrl ?? null)
                            }
                        />
                    ) : (
                        <HangerIcon
                            size={24}
                            color={colors.textMuted}
                            decorative
                        />
                    )}
                </View>
                <View style={styles.tileInfo}>
                    <Text
                        style={styles.tileName}
                        numberOfLines={1}
                    >
                        {article.name || article.clothingType}
                    </Text>
                    <View style={styles.tileMetaRow}>
                        <Text
                            style={styles.tileMeta}
                            numberOfLines={1}
                        >
                            {[article.clothingType, article.color]
                                .filter(Boolean)
                                .join(' · ')}
                        </Text>
                        <ColorSwatch
                            color={article.color}
                            style={styles.tileColorDot}
                        />
                    </View>
                </View>
            </Pressable>
        </GlassCard>
    );
});
TileArticleCard.displayName = 'TileArticleCard';

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

export const SwipeableArticleCard = memo((props: ArticleCardProps) => {
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
                style={[
                    swipeStyles.deleteActionWrap,
                    { transform: [{ translateX }] },
                ]}
            >
                <Pressable
                    style={swipeStyles.deleteAction}
                    onPress={() => {
                        swipeable.close();
                        props.onRemove(props.article);
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
});
SwipeableArticleCard.displayName = 'SwipeableArticleCard';
