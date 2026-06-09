import { useState, useMemo, useCallback, useEffect } from 'react';
import {
    ScrollView,
    TextInput,
    Pressable,
    Alert,
    useWindowDimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { View, Text, GlassGroup } from '../primitives';
import { HangerIcon } from '../shared/HangerIcon';
import { useConfirm } from '../ConfirmDialog';
import ArticleModal from '../ArticleModal/ArticleModal';
import { Closet, ClothingArticle, ArticleFormData } from '../../types';
import { QuickAddData } from '../../views/ClosetPage/ClosetPage';
import { spacing } from '../../theme/tokens';
import { useTheme } from '../../theme/ThemeContext';
import { pairHarmony, COLOR_NEUTRALS } from '../../lib/outfitEngine';
import { makeStyles } from './ClosetView.styles';
import { CSS_COLORS } from '../../lib/colors/cssColors';
import { recentlyWornWithAge } from '../../lib/outfitHistory';
import { useFocusEffect, useRouter } from 'expo-router';
import {
    METALLIC_GRADIENTS,
    METALLIC_START,
    METALLIC_END,
} from '../../lib/colors/metallicGradients';
import { CATEGORIES, COLORS, FABRICS, ARTICLE_GENDERS } from '../../lib/colors/palettes';
import { SwipeableArticleCard, TileArticleCard } from './ArticleCard';

type SortMode = 'default' | 'type' | 'color' | 'wornRecent' | 'wornStale';

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
    onTripFit?: () => void;
    /** Bottom padding so scroll content clears the floating pill tab bar */
    tabClearance?: number;
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
    onTripFit,
    tabClearance = 0,
}: Props) => {
    const { colors } = useTheme();
    const router = useRouter();
    const confirm = useConfirm();
    const styles = useMemo(() => makeStyles(colors), [colors]);
    const { width: windowWidth } = useWindowDimensions();
    const tileWidth = Math.floor(
        (windowWidth - spacing.md * 2 - spacing.sm) / 2,
    );

    const [viewMode, setViewMode] = useState<'list' | 'tile'>('list');
    const [selectedId, setSelectedId] = useState<string>(
        initialSelectedId && closets.find((c) => c._id === initialSelectedId)
            ? initialSelectedId
            : (closets[0]?._id ?? ''),
    );
    const [editingArticle, setEditingArticle] = useState<ClothingArticle | null>(null);
    const [creating, setCreating] = useState(false);
    const [newName, setNewName] = useState('');
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editName, setEditName] = useState('');
    const [query, setQuery] = useState('');
    const [activeCategories, setActiveCategories] = useState<string[]>([]);
    const [activeColors, setActiveColors] = useState<string[]>([]);
    const [activeFabrics, setActiveFabrics] = useState<string[]>([]);
    const [activeGenders, setActiveGenders] = useState<string[]>([]);
    const [showFilters, setShowFilters] = useState(false);
    const [wornAgeMap, setWornAgeMap] = useState<Map<string, number>>(new Map());
    const [sortBy, setSortBy] = useState<SortMode>('default');

    useFocusEffect(
        useCallback(() => {
            recentlyWornWithAge(30).then(setWornAgeMap).catch(() => {});
        }, []),
    );

    const selected = closets.find((c) => c._id === selectedId) ?? closets[0];
    const filterCount = activeCategories.length + activeColors.length + activeFabrics.length + activeGenders.length;
    const hasFilters = filterCount > 0 || !!query.trim();

    const clearFilters = () => {
        setActiveCategories([]);
        setActiveColors([]);
        setActiveFabrics([]);
        setActiveGenders([]);
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
                (a) => a._id !== art._id && a.color && !COLOR_NEUTRALS.has(a.color),
            );
            if (others.length === 0) {
                map.set(art._id, 1.0);
                continue;
            }
            const avg =
                others.reduce((sum, o) => sum + pairHarmony(art.color!, o.color!), 0) /
                others.length;
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
                (a) => a.clothingCategory && activeCategories.includes(a.clothingCategory),
            );
        if (activeColors.length)
            arts = arts.filter((a) => a.color && activeColors.includes(a.color));
        if (activeFabrics.length)
            arts = arts.filter((a) => a.fabricType && activeFabrics.includes(a.fabricType));
        if (activeGenders.length)
            arts = arts.filter((a) => activeGenders.includes(a.gender ?? 'Unisex'));
        return arts;
    }, [selected, query, activeCategories, activeColors, activeFabrics, activeGenders]);

    const sortedArticles = useMemo(() => {
        if (sortBy === 'default') return filteredArticles;
        const arr = [...filteredArticles];
        if (sortBy === 'type')
            arr.sort((a, b) => a.clothingType.localeCompare(b.clothingType));
        else if (sortBy === 'color')
            arr.sort((a, b) => (a.color ?? '').localeCompare(b.color ?? ''));
        else if (sortBy === 'wornRecent')
            arr.sort((a, b) => (wornAgeMap.get(a._id) ?? 999) - (wornAgeMap.get(b._id) ?? 999));
        else if (sortBy === 'wornStale')
            arr.sort((a, b) => (wornAgeMap.get(b._id) ?? 999) - (wornAgeMap.get(a._id) ?? 999));
        return arr;
    }, [filteredArticles, sortBy, wornAgeMap]);

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

    const handleDelete = async (id: string) => {
        const ok = await confirm({
            title: 'Delete closet?',
            message: 'This will also delete all articles inside.',
            confirmLabel: 'Delete',
            destructive: true,
        });
        if (!ok) return;
        try {
            await onDeleteCloset(id);
            if (selectedId === id)
                setSelectedId(closets.find((c) => c._id !== id)?._id ?? '');
        } catch {
            Alert.alert('Error', 'Failed to delete closet.');
        }
    };

    const openTabMenu = (c: Closet) => {
        Alert.alert(c.name, undefined, [
            {
                text: c.isPreferred ? '★  Remove preferred' : '☆  Set as preferred',
                onPress: () => onSetPreferred(c._id),
            },
            {
                text: 'Rename',
                onPress: () => {
                    setSelectedId(c._id);
                    setEditingId(c._id);
                    setEditName(c.name);
                },
            },
            {
                text: 'Delete closet',
                style: 'destructive',
                onPress: () => handleDelete(c._id),
            },
            { text: 'Cancel', style: 'cancel' },
        ]);
    };

    const openSortMenu = () => {
        const tick = (mode: SortMode) => (sortBy === mode ? '✓  ' : '    ');
        Alert.alert('Sort articles', undefined, [
            { text: `${tick('default')}Default order`, onPress: () => setSortBy('default') },
            { text: `${tick('type')}By type`, onPress: () => setSortBy('type') },
            { text: `${tick('color')}By color`, onPress: () => setSortBy('color') },
            { text: `${tick('wornRecent')}Recently worn first`, onPress: () => setSortBy('wornRecent') },
            { text: `${tick('wornStale')}Least worn first`, onPress: () => setSortBy('wornStale') },
            { text: 'Cancel', style: 'cancel' },
        ]);
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
            <Pressable style={[styles.chip, active && styles.chipActive]} onPress={onPress}>
                {gradient ? (
                    <LinearGradient
                        colors={gradient}
                        start={METALLIC_START}
                        end={METALLIC_END}
                        style={styles.chipColor}
                    />
                ) : color ? (
                    <View style={[styles.chipColor, { backgroundColor: color }]} />
                ) : null}
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
            </Pressable>
        );
    };

    return (
        <View style={styles.root}>
            {/* ── Closet tab bar ── */}
            <GlassGroup spacing={8}>
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
                        onLongPress={() => openTabMenu(c)}
                        delayLongPress={400}
                        accessibilityLabel={`${c.name} closet, ${c.articles.length} items. Hold for options.`}
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
                                selectedId === c._id && styles.closetTabTextActive,
                            ]}
                            numberOfLines={1}
                        >
                            {c.name}
                        </Text>
                        {c.isPreferred && <Text style={styles.starBadge}>★</Text>}
                        <Text
                            style={[
                                styles.countBadge,
                                selectedId === c._id && styles.countBadgeActive,
                            ]}
                        >
                            {c.articles.length}
                        </Text>
                    </Pressable>
                ))}
                <Pressable
                    style={styles.newClosetBtn}
                    onPress={() => setCreating(true)}
                    accessibilityLabel='New closet'
                    accessibilityRole='button'
                >
                    <Text style={styles.newClosetBtnText}>+</Text>
                </Pressable>
            </ScrollView>
            </GlassGroup>

            {/* ── Rename inline form ── */}
            {selected && editingId === selected._id && (
                <View style={[styles.inlineForm, { marginHorizontal: spacing.md, marginBottom: spacing.sm }]}>
                    <TextInput
                        style={styles.inlineInput}
                        value={editName}
                        autoFocus
                        onChangeText={setEditName}
                        placeholder='New name…'
                        placeholderTextColor={colors.textMuted}
                        onSubmitEditing={() => submitRename(selected._id)}
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
            )}

            {/* ── Create closet form ── */}
            {creating && (
                <View style={[styles.inlineForm, { marginHorizontal: spacing.md, marginBottom: spacing.sm }]}>
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
                        onPress={() => { setCreating(false); setNewName(''); }}
                        accessibilityRole="button"
                        accessibilityLabel="Cancel"
                    >
                        <Text style={styles.inlineCancelText}>✕</Text>
                    </Pressable>
                </View>
            )}

            {/* ── Content header: title + view toggle + overflow ── */}
            <View style={styles.mainHead}>
                <Text style={styles.mainTitle} numberOfLines={1}>
                    {selected?.name ?? ''}
                </Text>
                <View style={styles.headerRight}>
                    {/* Single cycling view-mode button — shows the mode you'll switch TO */}
                    <Pressable
                        style={styles.viewCycleBtn}
                        onPress={() => setViewMode(viewMode === 'list' ? 'tile' : 'list')}
                        accessibilityLabel={viewMode === 'list' ? 'Switch to tile view' : 'Switch to list view'}
                        accessibilityRole='button'
                    >
                        <Text style={styles.viewCycleBtnText}>
                            {viewMode === 'list' ? '⊞' : '☰'}
                        </Text>
                    </Pressable>
                    {selected && (
                        <Pressable
                            style={styles.overflowBtn}
                            onPress={() => openTabMenu(selected)}
                            accessibilityLabel='Closet options'
                            accessibilityRole='button'
                        >
                            <Text style={styles.overflowBtnText}>···</Text>
                        </Pressable>
                    )}
                </View>
            </View>

            {/* ── Search + sort + filter row ── */}
            <View style={styles.searchBar}>
                <View style={styles.searchInputWrap}>
                    <Text style={styles.searchIcon}>🔍</Text>
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
                    style={[styles.sortBtn, sortBy !== 'default' && styles.sortBtnActive]}
                    onPress={openSortMenu}
                    accessibilityLabel='Sort articles'
                    accessibilityRole='button'
                >
                    <Text style={[styles.sortBtnText, sortBy !== 'default' && styles.sortBtnTextActive]}>
                        ↕
                    </Text>
                </Pressable>
                <Pressable
                    style={[styles.filterBtn, showFilters && styles.filterBtnActive]}
                    onPress={() => setShowFilters((v) => !v)}
                    accessibilityLabel={filterCount > 0 ? `Filters, ${filterCount} active` : 'Filters'}
                    accessibilityRole='button'
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
                    <Text style={styles.filterGroupLabel}>Gender</Text>
                    <View style={styles.chipRow}>
                        {[...ARTICLE_GENDERS].map((g) => (
                            <Chip
                                key={g}
                                label={g}
                                active={activeGenders.includes(g)}
                                onPress={() => toggle(activeGenders, setActiveGenders, g)}
                            />
                        ))}
                    </View>
                    <Text style={styles.filterGroupLabel}>Category</Text>
                    <View style={styles.chipRow}>
                        {CATEGORIES.map((c) => (
                            <Chip
                                key={c}
                                label={c}
                                active={activeCategories.includes(c)}
                                onPress={() => toggle(activeCategories, setActiveCategories, c)}
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
                                onPress={() => toggle(activeColors, setActiveColors, c)}
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
                                onPress={() => toggle(activeFabrics, setActiveFabrics, f)}
                            />
                        ))}
                    </View>
                    {hasFilters && (
                        <Pressable onPress={clearFilters}>
                            <Text style={styles.clearFiltersText}>Clear all filters</Text>
                        </Pressable>
                    )}
                </ScrollView>
            )}

            {/* ── TripFit discovery banner (above article list so it's always reachable) ── */}
            {onTripFit && selected && selected.articles.length > 0 && (
                <Pressable
                    style={styles.tripBanner}
                    onPress={onTripFit}
                    accessibilityRole='button'
                    accessibilityLabel='Open TripFit packing planner'
                >
                    <Text style={styles.tripBannerIcon}>✈️</Text>
                    <View style={styles.tripBannerInfo}>
                        <Text style={styles.tripBannerTitle}>TripFit</Text>
                        <Text style={styles.tripBannerDesc}>
                            Pack smarter for your next trip
                        </Text>
                    </View>
                    <Text style={styles.tripBannerChevron}>›</Text>
                </Pressable>
            )}

            {/* ── Legend ── */}
            <View style={styles.legendRow}>
                <View style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: 'rgba(251,191,36,0.85)' }]} />
                    <Text style={styles.legendText}>Recent</Text>
                </View>
                <View style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: 'rgba(99,102,241,0.75)' }]} />
                    <Text style={styles.legendText}>Low wear</Text>
                </View>
                <View style={styles.legendItem}>
                    <View style={[styles.legendWarmth, { backgroundColor: '#ef4444' }]} />
                    <Text style={styles.legendText}>Warm</Text>
                </View>
                <View style={styles.legendItem}>
                    <View style={[styles.legendWarmth, { backgroundColor: '#3b82f6' }]} />
                    <Text style={styles.legendText}>Cool</Text>
                </View>
                <View style={styles.legendItem}>
                    <Text style={styles.legendClash}>clash</Text>
                    <Text style={styles.legendText}>Low harmony</Text>
                </View>
            </View>

            {/* ── Article list / tile grid ── */}
            <ScrollView
                contentContainerStyle={[
                    viewMode === 'tile' ? styles.tileGrid : styles.articleList,
                    tabClearance > 0 && { paddingBottom: tabClearance },
                ]}
            >
                {!selected || selected.articles.length === 0 ? (
                    <View style={styles.emptyState}>
                        <HangerIcon size={36} color={colors.textMuted} />
                        <Text style={styles.emptyTitle}>No articles yet</Text>
                        <Pressable
                            style={styles.addBtn}
                            onPress={() => router.push('/capture')}
                        >
                            <Text style={styles.addBtnText}>Add your first piece</Text>
                        </Pressable>
                    </View>
                ) : sortedArticles.length === 0 ? (
                    <View style={styles.emptyState}>
                        <Text style={styles.emptyTitle}>No matches</Text>
                        <Pressable onPress={clearFilters}>
                            <Text style={styles.clearFiltersText}>Clear filters</Text>
                        </Pressable>
                    </View>
                ) : viewMode === 'tile' ? (
                    sortedArticles.map((a) => (
                        <TileArticleCard
                            key={a._id}
                            article={a}
                            harmonyScore={harmonyMap.get(a._id)}
                            wornAge={wornAgeMap.get(a._id)}
                            tileWidth={tileWidth}
                            onEdit={() => setEditingArticle(a)}
                            onRemove={() => onRemoveArticle(selected._id, a._id)}
                        />
                    ))
                ) : (
                    sortedArticles.map((a) => (
                        <SwipeableArticleCard
                            key={a._id}
                            article={a}
                            harmonyScore={harmonyMap.get(a._id)}
                            wornAge={wornAgeMap.get(a._id)}
                            onEdit={() => setEditingArticle(a)}
                            onRemove={() => onRemoveArticle(selected._id, a._id)}
                        />
                    ))
                )}

            </ScrollView>

            {/* ── Floating action button — opens the camera flow ── */}
            {selected && !editingArticle && (
                <Pressable
                    style={styles.fab}
                    onPress={() => router.push('/capture')}
                    accessibilityLabel='Add article — open camera'
                    accessibilityRole='button'
                >
                    <Text style={styles.fabText}>+</Text>
                </Pressable>
            )}

            {editingArticle && (
                <ArticleModal
                    closetId={selected._id}
                    onClose={() => setEditingArticle(null)}
                    initialData={editingArticle}
                    onDelete={async () => {
                        await onRemoveArticle(selected._id, editingArticle._id);
                        setEditingArticle(null);
                    }}
                    onSubmit={async (data) => {
                        await onEditArticle(selected._id, editingArticle._id, data);
                        setEditingArticle(null);
                    }}
                />
            )}
        </View>
    );
};

export default ClosetView;
