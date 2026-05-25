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
import { View, Text } from '../primitives';
import { HangerIcon } from '../shared/HangerIcon';
import ArticleModal from '../ArticleModal/ArticleModal';
import { Closet, ClothingArticle, ArticleFormData } from '../../types';
import {
    ColorTokens,
    fonts,
    fontSizes,
    fontWeights,
    spacing,
    radius,
} from '../../theme/tokens';
import { useTheme } from '../../theme/ThemeContext';
import {
    pairHarmony,
    COLOR_NEUTRALS,
    SEASONAL_COLORS,
    currentSeason,
    garmentWarmth,
    Season,
} from '../../lib/outfitEngine';
import { makeStyles } from './ClosetView.styles';
import { CSS_COLORS } from '../../lib/colors/cssColors';
import {
    METALLIC_GRADIENTS,
    METALLIC_START,
    METALLIC_END,
} from '../../lib/colors/metallicGradients';
import { CATEGORIES, COLORS, FABRICS } from '../../lib/colors/palettes';
import { SwipeableArticleCard } from './ArticleCard';

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
    const { colors } = useTheme();
    const styles = useMemo(() => makeStyles(colors), [colors]);
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
                                accessibilityLabel="New closet name"
                            />
                            <Pressable
                                style={styles.inlineOk}
                                onPress={() => submitRename(selected._id)}
                                accessibilityRole="button"
                                accessibilityLabel="Confirm rename"
                            >
                                <Text style={styles.inlineOkText}>✓</Text>
                            </Pressable>
                            <Pressable
                                style={styles.inlineCancel}
                                onPress={() => setEditingId(null)}
                                accessibilityRole="button"
                                accessibilityLabel="Cancel rename"
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
                        accessibilityLabel="Closet name"
                    />
                    <Pressable
                        style={styles.inlineOk}
                        onPress={submitCreate}
                        accessibilityRole="button"
                        accessibilityLabel="Create closet"
                    >
                        <Text style={styles.inlineOkText}>Add</Text>
                    </Pressable>
                    <Pressable
                        style={styles.inlineCancel}
                        onPress={() => {
                            setCreating(false);
                            setNewName('');
                        }}
                        accessibilityRole="button"
                        accessibilityLabel="Cancel"
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
                        accessibilityLabel="Search articles"
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
                    onDelete={async () => {
                        await onRemoveArticle(selected._id, editingArticle._id);
                        setEditingArticle(null);
                    }}
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

