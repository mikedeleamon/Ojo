import { useState, useMemo } from 'react';
import {
    StyleSheet,
    ScrollView,
    TextInput,
    Pressable,
    Image,
    Alert,
    Animated,
} from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { LinearGradient } from 'expo-linear-gradient';
import { Svg, Path } from 'react-native-svg';
import { View, Text } from '../primitives';
import ArticleModal from '../ArticleModal/ArticleModal';
import { Closet, ClothingArticle, ArticleFormData } from '../../types';
import {
    colors,
    fonts,
    fontSizes,
    fontWeights,
    spacing,
    radius,
} from '../../theme/tokens';
import {
    pairHarmony,
    COLOR_NEUTRALS,
    SEASONAL_COLORS,
    currentSeason,
    garmentWarmth,
    Season,
} from '../../lib/outfitEngine';
import { styles } from './ClosetView.styles';

const CATEGORIES = [
    'Casual',
    'Formal',
    'Business Casual',
    'Athletic',
    'Lounge',
    'Outdoor',
];
const COLORS = [
    // Neutrals
    'Black',
    'White',
    'Grey',
    'Brown',
    'Beige',
    'Cream',
    // Metallics
    'Silver',
    'Gold',
    'Bronze',
    'Rose Gold',
    'Champagne',
    // Blues
    'Navy',
    'Indigo',
    'Cobalt',
    'Blue',
    'Electric Blue',
    'Sky Blue',
    'Periwinkle',
    'Teal',
    'Cyan',
    'Baby Blue',
    // Greens
    'Green',
    'Mint',
    'Lime',
    'Sage',
    'Olive',
    'Khaki',
    // Reds & warm
    'Red',
    'Scarlet',
    'Crimson',
    'Burgundy',
    'Orange',
    'Coral',
    'Peach',
    'Rust',
    'Yellow',
    // Purples & pinks
    'Purple',
    'Plum',
    'Lilac',
    'Lavender',
    'Pink',
    'Rose',
    'Dusty Rose',
    'Blush',
    'Magenta',
    'Hot Pink',
    'Fuchsia',
    // Other
    'Multi',
];
const FABRICS = [
    'Cotton',
    'Wool',
    'Linen',
    'Silk',
    'Polyester',
    'Denim',
    'Leather',
    'Synthetic',
    'Other',
];

const METALLIC_GRADIENTS: Record<
    string,
    readonly [string, string, ...string[]]
> = {
    Silver: ['#f2f2f2', '#c0c0c0', '#f5f5f5', '#8a8a8a'],
    Gold: ['#fde68a', '#d4af37', '#f5e27a', '#b8860b'],
    Bronze: ['#d4a271', '#8b5c2a', '#cd853f', '#7b3f15'],
    'Rose Gold': ['#f4c2b8', '#c9776a', '#eda99a', '#a0504a'],
    Champagne: ['#f8f0d8', '#e4c96e', '#f5e8c0', '#c8a84b'],
};
const METALLIC_START = { x: 0.15, y: 0 } as const;
const METALLIC_END = { x: 0.85, y: 1 } as const;

const CSS_COLORS: Record<string, string> = {
    // Neutrals
    Black: '#1a1a1a',
    White: '#f5f5f5',
    Grey: '#9ca3af',
    Brown: '#92400e',
    Beige: '#d4b896',
    Cream: '#fef3c7',
    // Metallics
    Silver: '#c0c0c0',
    Gold: '#d4af37',
    Bronze: '#a0785a',
    'Rose Gold': '#c9776a',
    Champagne: '#f4e4c1',
    // Blues
    Navy: '#1e3a5f',
    Indigo: '#4338ca',
    Cobalt: '#2563eb',
    Blue: '#3b82f6',
    'Electric Blue': '#0ea5e9',
    'Sky Blue': '#38bdf8',
    Periwinkle: '#a5b4fc',
    Teal: '#0d9488',
    Cyan: '#06b6d4',
    'Baby Blue': '#bae6fd',
    // Greens
    Green: '#22c55e',
    Mint: '#34d399',
    Lime: '#a3e635',
    Sage: '#86efac',
    Olive: '#65a30d',
    Khaki: '#a16207',
    // Reds & warm
    Red: '#ef4444',
    Scarlet: '#f43f5e',
    Crimson: '#dc2626',
    Burgundy: '#9b1c1c',
    Orange: '#f97316',
    Coral: '#fb923c',
    Peach: '#fdba74',
    Rust: '#c2410c',
    Yellow: '#fbbf24',
    // Purples & pinks
    Purple: '#a855f7',
    Plum: '#7c3aed',
    Lilac: '#d8b4fe',
    Lavender: '#c4b5fd',
    Pink: '#f9a8d4',
    Rose: '#fb7185',
    'Dusty Rose': '#fda4af',
    Blush: '#fecdd3',
    Magenta: '#e879f9',
    'Hot Pink': '#ec4899',
    Fuchsia: '#d946ef',
};

interface Props {
    closets: Closet[];
    initialSelectedId?: string;
    onCreateCloset: (name: string) => Promise<void>;
    onRenameCloset: (id: string, name: string) => Promise<void>;
    onDeleteCloset: (id: string) => Promise<void>;
    onAddArticle: (closetId: string, data: ArticleFormData) => Promise<void>;
    onEditArticle: (
        closetId: string,
        articleId: string,
        data: ArticleFormData,
    ) => Promise<void>;
    onRemoveArticle: (closetId: string, articleId: string) => Promise<void>;
    onSetPreferred: (id: string) => Promise<void>;
}

const HangerIcon = ({
    size = 20,
    color = colors.textSecondary,
}: {
    size?: number;
    color?: string;
}) => (
    <Svg
        width={size}
        height={size}
        viewBox='0 0 24 24'
        fill='none'
    >
        <Path
            d='M12 4a2 2 0 0 1 2 2c0 .74-.4 1.38-1 1.73V9l8 5.5A1 1 0 0 1 20 16H4a1 1 0 0 1-.99-1.5L11 9V7.73A2 2 0 0 1 12 4Z'
            stroke={color}
            strokeWidth={1.5}
            strokeLinecap='round'
            strokeLinejoin='round'
        />
    </Svg>
);

const WARMTH_DOT_COLOR = (w: number) =>
    w < 0.25 ? '#38bdf8' : w < 0.55 ? '#fbbf24' : '#f97316';

const ArticleCard = ({
    article,
    harmonyScore,
    outOfSeason,
    onEdit,
    onRemove,
}: {
    article: ClothingArticle;
    harmonyScore?: number;
    outOfSeason?: boolean;
    onEdit: () => void;
    onRemove: () => void;
}) => {
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
            accessibilityRole="button"
        >
            <View style={styles.articleImg}>
                {article.imageUrl ? (
                    <Image
                        source={{ uri: article.imageUrl }}
                        style={styles.articleImgFill}
                        resizeMode='cover'
                    />
                ) : (
                    <HangerIcon
                        size={18}
                        color={colors.textMuted}
                    />
                )}
                <View
                    style={[styles.warmthDot, { backgroundColor: warmthColor }]}
                />
            </View>
            <View style={styles.articleInfo}>
                <View style={styles.nameRow}>
                    <Text
                        style={styles.articleName}
                        numberOfLines={1}
                    >
                        {article.name || article.clothingType}
                    </Text>
                    {isInSeason && <Text style={styles.seasonBadge}>◆</Text>}
                </View>
                <Text
                    style={[
                        styles.articleMeta,
                        lowHarmony && styles.articleMetaClash,
                    ]}
                    numberOfLines={1}
                >
                    {[article.clothingType, article.color, article.fabricType]
                        .filter(Boolean)
                        .join(' · ')}
                    {lowHarmony ? ' · may clash' : ''}
                </Text>
                {article.clothingCategory ? (
                    <Text style={styles.categoryTag}>
                        {article.clothingCategory}
                    </Text>
                ) : null}
            </View>
            {article.color &&
                (METALLIC_GRADIENTS[article.color] ||
                    CSS_COLORS[article.color]) &&
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

const SwipeableArticleCard = ({
    article,
    harmonyScore,
    outOfSeason,
    onEdit,
    onRemove,
}: {
    article: ClothingArticle;
    harmonyScore?: number;
    outOfSeason?: boolean;
    onEdit: () => void;
    onRemove: () => void;
}) => {
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
                        onRemove();
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
            <ArticleCard
                article={article}
                harmonyScore={harmonyScore}
                onEdit={onEdit}
                onRemove={onRemove}
            />
        </Swipeable>
    );
};

const ClosetView = ({
    closets,
    initialSelectedId,
    onCreateCloset,
    onRenameCloset,
    onDeleteCloset,
    onAddArticle,
    onEditArticle,
    onRemoveArticle,
    onSetPreferred,
}: Props) => {
    const [selectedId, setSelectedId] = useState<string>(
        initialSelectedId && closets.find((c) => c._id === initialSelectedId)
            ? initialSelectedId
            : (closets[0]?._id ?? ''),
    );
    const [showModal, setShowModal] = useState(false);
    const [editingArticle, setEditingArticle] =
        useState<ClothingArticle | null>(null);
    const [creating, setCreating] = useState(false);
    const [newName, setNewName] = useState('');
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editName, setEditName] = useState('');
    const [query, setQuery] = useState('');
    const [activeCategories, setActiveCategories] = useState<string[]>([]);
    const [activeColors, setActiveColors] = useState<string[]>([]);
    const [activeFabrics, setActiveFabrics] = useState<string[]>([]);
    const [showFilters, setShowFilters] = useState(false);

    const selected = closets.find((c) => c._id === selectedId) ?? closets[0];
    const filterCount =
        activeCategories.length + activeColors.length + activeFabrics.length;
    const hasFilters = filterCount > 0 || !!query.trim();

    const clearFilters = () => {
        setActiveCategories([]);
        setActiveColors([]);
        setActiveFabrics([]);
        setQuery('');
    };

    const toggle = (arr: string[], set: (v: string[]) => void, val: string) =>
        set(arr.includes(val) ? arr.filter((x) => x !== val) : [...arr, val]);

    const harmonyMap = useMemo(() => {
        const map = new Map<string, number>();
        if (!selected) return map;
        for (const art of selected.articles) {
            if (!art.color || COLOR_NEUTRALS.has(art.color)) {
                map.set(art._id, 1.0);
                continue;
            }
            const others = selected.articles.filter(
                (a) =>
                    a._id !== art._id &&
                    a.color &&
                    !COLOR_NEUTRALS.has(a.color),
            );
            if (others.length === 0) {
                map.set(art._id, 1.0);
                continue;
            }
            const avg =
                others.reduce(
                    (sum, o) => sum + pairHarmony(art.color!, o.color!),
                    0,
                ) / others.length;
            map.set(art._id, avg);
        }
        return map;
    }, [selected]);

    const filteredArticles = useMemo(() => {
        if (!selected) return [];
        let arts = selected.articles;
        if (query.trim()) {
            const q = query.toLowerCase();
            arts = arts.filter(
                (a) =>
                    a.name?.toLowerCase().includes(q) ||
                    a.clothingType.toLowerCase().includes(q) ||
                    a.color?.toLowerCase().includes(q) ||
                    a.fabricType?.toLowerCase().includes(q) ||
                    a.clothingCategory?.toLowerCase().includes(q),
            );
        }
        if (activeCategories.length)
            arts = arts.filter(
                (a) =>
                    a.clothingCategory &&
                    activeCategories.includes(a.clothingCategory),
            );
        if (activeColors.length)
            arts = arts.filter(
                (a) => a.color && activeColors.includes(a.color),
            );
        if (activeFabrics.length)
            arts = arts.filter(
                (a) => a.fabricType && activeFabrics.includes(a.fabricType),
            );
        return arts;
    }, [selected, query, activeCategories, activeColors, activeFabrics]);

    const submitCreate = async () => {
        if (!newName.trim()) return;
        try {
            await onCreateCloset(newName.trim());
            setNewName('');
            setCreating(false);
        } catch {
            Alert.alert('Error', 'Failed to create closet.');
        }
    };

    const submitRename = async (id: string) => {
        if (!editName.trim()) return;
        try {
            await onRenameCloset(id, editName.trim());
            setEditingId(null);
        } catch {
            Alert.alert('Error', 'Failed to rename closet.');
        }
    };

    const handleDelete = (id: string) => {
        Alert.alert(
            'Delete closet?',
            'This will also delete all articles inside.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await onDeleteCloset(id);
                            if (selectedId === id)
                                setSelectedId(
                                    closets.find((c) => c._id !== id)?._id ??
                                        '',
                                );
                        } catch {
                            Alert.alert('Error', 'Failed to delete closet.');
                        }
                    },
                },
            ],
        );
    };

    const Chip = ({
        label,
        active,
        color,
        onPress,
    }: {
        label: string;
        active: boolean;
        color?: string;
        onPress: () => void;
    }) => {
        const gradient = METALLIC_GRADIENTS[label];
        return (
            <Pressable
                style={[styles.chip, active && styles.chipActive]}
                onPress={onPress}
            >
                {gradient ? (
                    <LinearGradient
                        colors={gradient}
                        start={METALLIC_START}
                        end={METALLIC_END}
                        style={styles.chipColor}
                    />
                ) : color ? (
                    <View
                        style={[styles.chipColor, { backgroundColor: color }]}
                    />
                ) : null}
                <Text
                    style={[styles.chipText, active && styles.chipTextActive]}
                >
                    {label}
                </Text>
            </Pressable>
        );
    };

    return (
        <View style={styles.root}>
            {/* ── Closet selector (horizontal scroll) ── */}
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.closetBar}
            >
                {closets.map((c) => (
                    <Pressable
                        key={c._id}
                        style={[
                            styles.closetTab,
                            selectedId === c._id && styles.closetTabActive,
                        ]}
                        onPress={() => {
                            setSelectedId(c._id);
                            setEditingId(null);
                            clearFilters();
                        }}
                    >
                        <HangerIcon
                            size={12}
                            color={
                                selectedId === c._id
                                    ? colors.saveBtnText
                                    : colors.textSecondary
                            }
                        />
                        <Text
                            style={[
                                styles.closetTabText,
                                selectedId === c._id &&
                                    styles.closetTabTextActive,
                            ]}
                        >
                            {c.name}
                        </Text>
                        {c.isPreferred && (
                            <Text style={styles.starBadge}>★</Text>
                        )}
                        <Text
                            style={[
                                styles.closetCount,
                                selectedId === c._id && {
                                    color: colors.saveBtnText,
                                },
                            ]}
                        >
                            {c.articles.length}
                        </Text>
                    </Pressable>
                ))}
                <Pressable
                    style={styles.newClosetBtn}
                    onPress={() => setCreating(true)}
                >
                    <Text style={styles.newClosetBtnText}>+</Text>
                </Pressable>
            </ScrollView>

            {/* ── Closet actions ── */}
            {selected && (
                <View style={styles.closetActions}>
                    {editingId === selected._id ? (
                        <View style={styles.inlineForm}>
                            <TextInput
                                style={styles.inlineInput}
                                value={editName}
                                autoFocus
                                onChangeText={setEditName}
                                placeholder='New name…'
                                placeholderTextColor={colors.textMuted}
                                onSubmitEditing={() =>
                                    submitRename(selected._id)
                                }
                            />
                            <Pressable
                                style={styles.inlineOk}
                                onPress={() => submitRename(selected._id)}
                            >
                                <Text style={styles.inlineOkText}>✓</Text>
                            </Pressable>
                            <Pressable
                                style={styles.inlineCancel}
                                onPress={() => setEditingId(null)}
                            >
                                <Text style={styles.inlineCancelText}>✕</Text>
                            </Pressable>
                        </View>
                    ) : (
                        <View style={styles.actionRow}>
                            <Pressable
                                style={styles.actionBtn}
                                onPress={() => onSetPreferred(selected._id)}
                            >
                                <Text
                                    style={[
                                        styles.actionBtnText,
                                        selected.isPreferred && {
                                            color: '#fbbf24',
                                        },
                                    ]}
                                >
                                    {selected.isPreferred
                                        ? '★ Preferred'
                                        : '☆ Set preferred'}
                                </Text>
                            </Pressable>
                            <Pressable
                                style={styles.actionBtn}
                                onPress={() => {
                                    setEditingId(selected._id);
                                    setEditName(selected.name);
                                }}
                            >
                                <Text style={styles.actionBtnText}>Rename</Text>
                            </Pressable>
                            <Pressable
                                style={[
                                    styles.actionBtn,
                                    styles.actionBtnDanger,
                                ]}
                                onPress={() => handleDelete(selected._id)}
                            >
                                <Text style={styles.actionBtnDangerText}>
                                    Delete
                                </Text>
                            </Pressable>
                        </View>
                    )}
                </View>
            )}

            {/* ── Create closet form ── */}
            {creating && (
                <View style={[styles.inlineForm, { margin: spacing.md }]}>
                    <TextInput
                        style={styles.inlineInput}
                        value={newName}
                        autoFocus
                        onChangeText={setNewName}
                        placeholder='Closet name…'
                        placeholderTextColor={colors.textMuted}
                        onSubmitEditing={submitCreate}
                    />
                    <Pressable
                        style={styles.inlineOk}
                        onPress={submitCreate}
                    >
                        <Text style={styles.inlineOkText}>Add</Text>
                    </Pressable>
                    <Pressable
                        style={styles.inlineCancel}
                        onPress={() => {
                            setCreating(false);
                            setNewName('');
                        }}
                    >
                        <Text style={styles.inlineCancelText}>✕</Text>
                    </Pressable>
                </View>
            )}

            {/* ── Main panel ── */}
            <View style={styles.mainHead}>
                <Text style={styles.mainTitle}>{selected?.name}</Text>
                <Pressable
                    style={styles.addBtn}
                    onPress={() => setShowModal(true)}
                >
                    <Text style={styles.addBtnText}>+ Add article</Text>
                </Pressable>
            </View>

            {/* ── Search + filter ── */}
            <View style={styles.searchBar}>
                <View style={styles.searchInputWrap}>
                    <TextInput
                        style={styles.searchInput}
                        placeholder='Search articles…'
                        placeholderTextColor={colors.textMuted}
                        value={query}
                        onChangeText={setQuery}
                    />
                    {query ? (
                        <Pressable onPress={() => setQuery('')}>
                            <Text style={styles.clearSearch}>✕</Text>
                        </Pressable>
                    ) : null}
                </View>
                <Pressable
                    style={[
                        styles.filterBtn,
                        showFilters && styles.filterBtnActive,
                    ]}
                    onPress={() => setShowFilters((v) => !v)}
                >
                    <Text style={styles.filterBtnText}>
                        Filters{filterCount > 0 ? ` (${filterCount})` : ''}
                    </Text>
                </Pressable>
            </View>

            {showFilters && (
                <ScrollView
                    style={styles.filterPanel}
                    contentContainerStyle={{ gap: 12, padding: spacing.md }}
                >
                    <Text style={styles.filterGroupLabel}>Category</Text>
                    <View style={styles.chipRow}>
                        {CATEGORIES.map((c) => (
                            <Chip
                                key={c}
                                label={c}
                                active={activeCategories.includes(c)}
                                onPress={() =>
                                    toggle(
                                        activeCategories,
                                        setActiveCategories,
                                        c,
                                    )
                                }
                            />
                        ))}
                    </View>
                    <Text style={styles.filterGroupLabel}>Color</Text>
                    <View style={styles.chipRow}>
                        {COLORS.map((c) => (
                            <Chip
                                key={c}
                                label={c}
                                active={activeColors.includes(c)}
                                color={CSS_COLORS[c]}
                                onPress={() =>
                                    toggle(activeColors, setActiveColors, c)
                                }
                            />
                        ))}
                    </View>
                    <Text style={styles.filterGroupLabel}>Fabric</Text>
                    <View style={styles.chipRow}>
                        {FABRICS.map((f) => (
                            <Chip
                                key={f}
                                label={f}
                                active={activeFabrics.includes(f)}
                                onPress={() =>
                                    toggle(activeFabrics, setActiveFabrics, f)
                                }
                            />
                        ))}
                    </View>
                    {hasFilters && (
                        <Pressable onPress={clearFilters}>
                            <Text style={styles.clearFiltersText}>
                                Clear all filters
                            </Text>
                        </Pressable>
                    )}
                </ScrollView>
            )}

            {/* ── Indicator legend ── */}
            {selected && selected.articles.length > 0 && (
                <View style={styles.legend}>
                    <View style={styles.legendItem}>
                        <View
                            style={[
                                styles.legendDot,
                                { backgroundColor: '#38bdf8' },
                            ]}
                        />
                        <View
                            style={[
                                styles.legendDot,
                                { backgroundColor: '#fbbf24' },
                            ]}
                        />
                        <View
                            style={[
                                styles.legendDot,
                                { backgroundColor: '#f97316' },
                            ]}
                        />
                        <Text style={styles.legendLabel}>warmth</Text>
                    </View>
                    <View style={styles.legendItem}>
                        <Text style={styles.legendSeason}>◆</Text>
                        <Text style={styles.legendLabel}>in season</Text>
                    </View>
                    <View style={styles.legendItem}>
                        <Text style={styles.legendClash}>~</Text>
                        <Text style={styles.legendLabel}>may clash</Text>
                    </View>
                </View>
            )}

            {/* ── Article list ── */}
            <ScrollView contentContainerStyle={styles.articleList}>
                {!selected || selected.articles.length === 0 ? (
                    <View style={styles.emptyState}>
                        <HangerIcon
                            size={36}
                            color={colors.textMuted}
                        />
                        <Text style={styles.emptyTitle}>No articles yet</Text>
                        <Pressable
                            style={styles.addBtn}
                            onPress={() => setShowModal(true)}
                        >
                            <Text style={styles.addBtnText}>
                                Add your first piece
                            </Text>
                        </Pressable>
                    </View>
                ) : filteredArticles.length === 0 ? (
                    <View style={styles.emptyState}>
                        <Text style={styles.emptyTitle}>No matches</Text>
                        <Pressable onPress={clearFilters}>
                            <Text style={styles.clearFiltersText}>
                                Clear filters
                            </Text>
                        </Pressable>
                    </View>
                ) : (
                    filteredArticles.map((a) => (
                        <SwipeableArticleCard
                            key={a._id}
                            article={a}
                            harmonyScore={harmonyMap.get(a._id)}
                            onEdit={() => setEditingArticle(a)}
                            onRemove={() =>
                                onRemoveArticle(selected._id, a._id)
                            }
                        />
                    ))
                )}
            </ScrollView>

            {showModal && (
                <ArticleModal
                    onClose={() => setShowModal(false)}
                    onSubmit={async (data) => {
                        await onAddArticle(selected._id, data);
                        setShowModal(false);
                    }}
                />
            )}
            {editingArticle && (
                <ArticleModal
                    onClose={() => setEditingArticle(null)}
                    initialData={editingArticle}
                    onSubmit={async (data) => {
                        await onEditArticle(
                            selected._id,
                            editingArticle._id,
                            data,
                        );
                        setEditingArticle(null);
                    }}
                />
            )}
        </View>
    );
};

export default ClosetView;

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
