import { useState, useMemo } from 'react';
import { StyleSheet, ScrollView, TextInput, Pressable, Image, Alert } from 'react-native';
import { Svg, Path, Circle } from 'react-native-svg';
import { View, Text } from '../primitives';
import ArticleModal from '../ArticleModal/ArticleModal';
import { Closet, ClothingArticle, ArticleFormData } from '../../types';
import { colors, fonts, fontSizes, fontWeights, spacing, radius } from '../../theme/tokens';

const CATEGORIES = ['Casual','Formal','Business Casual','Athletic','Lounge','Outdoor'];
const COLORS     = ['Black','White','Grey','Navy','Blue','Green','Red','Brown','Beige','Pink','Yellow','Purple','Orange','Multi'];
const FABRICS    = ['Cotton','Wool','Linen','Silk','Polyester','Denim','Leather','Synthetic','Other'];

const CSS_COLORS: Record<string,string> = {
  Black:'#1a1a1a',White:'#f5f5f5',Grey:'#9ca3af',Navy:'#1e3a5f',
  Blue:'#3b82f6',Green:'#22c55e',Red:'#ef4444',Brown:'#92400e',
  Beige:'#d4b896',Pink:'#f9a8d4',Yellow:'#fbbf24',Purple:'#a855f7',Orange:'#f97316',
};

interface Props {
  closets:            Closet[];
  initialSelectedId?: string;
  onCreateCloset:     (name: string) => Promise<void>;
  onRenameCloset:     (id: string, name: string) => Promise<void>;
  onDeleteCloset:     (id: string) => Promise<void>;
  onAddArticle:       (closetId: string, data: ArticleFormData) => Promise<void>;
  onEditArticle:      (closetId: string, articleId: string, data: ArticleFormData) => Promise<void>;
  onRemoveArticle:    (closetId: string, articleId: string) => Promise<void>;
  onSetPreferred:     (id: string) => Promise<void>;
}

const HangerIcon = ({ size=20, color=colors.textSecondary }: {size?:number;color?:string}) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M12 4a2 2 0 0 1 2 2c0 .74-.4 1.38-1 1.73V9l8 5.5A1 1 0 0 1 20 16H4a1 1 0 0 1-.99-1.5L11 9V7.73A2 2 0 0 1 12 4Z"
      stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"/>
  </Svg>
);

const ArticleCard = ({ article, onEdit, onRemove }: { article: ClothingArticle; onEdit: () => void; onRemove: () => void }) => (
  <View style={st.articleCard}>
    <View style={st.articleImg}>
      {article.imageUrl
        ? <Image source={{ uri: article.imageUrl }} style={st.articleImgFill} resizeMode="cover" />
        : <HangerIcon size={18} color={colors.textMuted} />
      }
    </View>
    <View style={st.articleInfo}>
      <Text style={st.articleName} numberOfLines={1}>{article.name || article.clothingType}</Text>
      <Text style={st.articleMeta} numberOfLines={1}>
        {[article.clothingType, article.color, article.fabricType].filter(Boolean).join(' · ')}
      </Text>
      {article.clothingCategory ? <Text style={st.categoryTag}>{article.clothingCategory}</Text> : null}
    </View>
    {article.color && CSS_COLORS[article.color] && (
      <View style={[st.colorDot, { backgroundColor: CSS_COLORS[article.color] }]} />
    )}
    <Pressable style={st.editBtn} onPress={onEdit} accessibilityLabel="Edit"><Text style={st.microBtnText}>✎</Text></Pressable>
    <Pressable style={st.removeBtn} onPress={onRemove} accessibilityLabel="Remove"><Text style={st.microBtnText}>✕</Text></Pressable>
  </View>
);

const ClosetView = ({
  closets, initialSelectedId, onCreateCloset, onRenameCloset, onDeleteCloset,
  onAddArticle, onEditArticle, onRemoveArticle, onSetPreferred,
}: Props) => {
  const [selectedId, setSelectedId] = useState<string>(
    initialSelectedId && closets.find(c => c._id === initialSelectedId)
      ? initialSelectedId : (closets[0]?._id ?? '')
  );
  const [showModal,      setShowModal]      = useState(false);
  const [editingArticle, setEditingArticle] = useState<ClothingArticle | null>(null);
  const [creating,       setCreating]       = useState(false);
  const [newName,        setNewName]        = useState('');
  const [editingId,      setEditingId]      = useState<string | null>(null);
  const [editName,       setEditName]       = useState('');
  const [query,          setQuery]          = useState('');
  const [activeCategories, setActiveCategories] = useState<string[]>([]);
  const [activeColors,     setActiveColors]     = useState<string[]>([]);
  const [activeFabrics,    setActiveFabrics]    = useState<string[]>([]);
  const [showFilters,      setShowFilters]      = useState(false);

  const selected    = closets.find(c => c._id === selectedId) ?? closets[0];
  const filterCount = activeCategories.length + activeColors.length + activeFabrics.length;
  const hasFilters  = filterCount > 0 || !!query.trim();

  const clearFilters = () => { setActiveCategories([]); setActiveColors([]); setActiveFabrics([]); setQuery(''); };

  const toggle = (arr: string[], set: (v: string[]) => void, val: string) =>
    set(arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val]);

  const filteredArticles = useMemo(() => {
    if (!selected) return [];
    let arts = selected.articles;
    if (query.trim()) {
      const q = query.toLowerCase();
      arts = arts.filter(a =>
        a.name?.toLowerCase().includes(q) || a.clothingType.toLowerCase().includes(q) ||
        a.color?.toLowerCase().includes(q) || a.fabricType?.toLowerCase().includes(q) ||
        a.clothingCategory?.toLowerCase().includes(q)
      );
    }
    if (activeCategories.length) arts = arts.filter(a => a.clothingCategory && activeCategories.includes(a.clothingCategory));
    if (activeColors.length)     arts = arts.filter(a => a.color && activeColors.includes(a.color));
    if (activeFabrics.length)    arts = arts.filter(a => a.fabricType && activeFabrics.includes(a.fabricType));
    return arts;
  }, [selected, query, activeCategories, activeColors, activeFabrics]);

  const submitCreate = async () => {
    if (!newName.trim()) return;
    try { await onCreateCloset(newName.trim()); setNewName(''); setCreating(false); }
    catch { Alert.alert('Error', 'Failed to create closet.'); }
  };

  const submitRename = async (id: string) => {
    if (!editName.trim()) return;
    try { await onRenameCloset(id, editName.trim()); setEditingId(null); }
    catch { Alert.alert('Error', 'Failed to rename closet.'); }
  };

  const handleDelete = (id: string) => {
    Alert.alert('Delete closet?', 'This will also delete all articles inside.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try {
          await onDeleteCloset(id);
          if (selectedId === id) setSelectedId(closets.find(c => c._id !== id)?._id ?? '');
        } catch { Alert.alert('Error', 'Failed to delete closet.'); }
      }},
    ]);
  };

  const Chip = ({ label, active, color, onPress }: { label: string; active: boolean; color?: string; onPress: () => void }) => (
    <Pressable style={[st.chip, active && st.chipActive]} onPress={onPress}>
      {color && <View style={[st.chipColor, { backgroundColor: color }]} />}
      <Text style={[st.chipText, active && st.chipTextActive]}>{label}</Text>
    </Pressable>
  );

  return (
    <View style={st.root}>
      {/* ── Closet selector (horizontal scroll) ── */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        contentContainerStyle={st.closetBar}>
        {closets.map(c => (
          <Pressable key={c._id}
            style={[st.closetTab, selectedId === c._id && st.closetTabActive]}
            onPress={() => { setSelectedId(c._id); setEditingId(null); clearFilters(); }}>
            <HangerIcon size={12} color={selectedId === c._id ? colors.saveBtnText : colors.textSecondary} />
            <Text style={[st.closetTabText, selectedId === c._id && st.closetTabTextActive]}>
              {c.name}
            </Text>
            {c.isPreferred && <Text style={st.starBadge}>★</Text>}
            <Text style={[st.closetCount, selectedId === c._id && { color: colors.saveBtnText }]}>
              {c.articles.length}
            </Text>
          </Pressable>
        ))}
        <Pressable style={st.newClosetBtn} onPress={() => setCreating(true)}>
          <Text style={st.newClosetBtnText}>+</Text>
        </Pressable>
      </ScrollView>

      {/* ── Closet actions ── */}
      {selected && (
        <View style={st.closetActions}>
          {editingId === selected._id ? (
            <View style={st.inlineForm}>
              <TextInput style={st.inlineInput} value={editName} autoFocus
                onChangeText={setEditName} placeholder="New name…"
                placeholderTextColor={colors.textMuted}
                onSubmitEditing={() => submitRename(selected._id)} />
              <Pressable style={st.inlineOk} onPress={() => submitRename(selected._id)}>
                <Text style={st.inlineOkText}>✓</Text>
              </Pressable>
              <Pressable style={st.inlineCancel} onPress={() => setEditingId(null)}>
                <Text style={st.inlineCancelText}>✕</Text>
              </Pressable>
            </View>
          ) : (
            <View style={st.actionRow}>
              <Pressable style={st.actionBtn} onPress={() => onSetPreferred(selected._id)}>
                <Text style={[st.actionBtnText, selected.isPreferred && { color: '#fbbf24' }]}>
                  {selected.isPreferred ? '★ Preferred' : '☆ Set preferred'}
                </Text>
              </Pressable>
              <Pressable style={st.actionBtn} onPress={() => { setEditingId(selected._id); setEditName(selected.name); }}>
                <Text style={st.actionBtnText}>Rename</Text>
              </Pressable>
              <Pressable style={[st.actionBtn, st.actionBtnDanger]} onPress={() => handleDelete(selected._id)}>
                <Text style={st.actionBtnDangerText}>Delete</Text>
              </Pressable>
            </View>
          )}
        </View>
      )}

      {/* ── Create closet form ── */}
      {creating && (
        <View style={[st.inlineForm, { margin: spacing.md }]}>
          <TextInput style={st.inlineInput} value={newName} autoFocus
            onChangeText={setNewName} placeholder="Closet name…"
            placeholderTextColor={colors.textMuted}
            onSubmitEditing={submitCreate} />
          <Pressable style={st.inlineOk} onPress={submitCreate}>
            <Text style={st.inlineOkText}>Add</Text>
          </Pressable>
          <Pressable style={st.inlineCancel} onPress={() => { setCreating(false); setNewName(''); }}>
            <Text style={st.inlineCancelText}>✕</Text>
          </Pressable>
        </View>
      )}

      {/* ── Main panel ── */}
      <View style={st.mainHead}>
        <Text style={st.mainTitle}>{selected?.name}</Text>
        <Pressable style={st.addBtn} onPress={() => setShowModal(true)}>
          <Text style={st.addBtnText}>+ Add article</Text>
        </Pressable>
      </View>

      {/* ── Search + filter ── */}
      <View style={st.searchBar}>
        <View style={st.searchInputWrap}>
          <TextInput style={st.searchInput} placeholder="Search articles…"
            placeholderTextColor={colors.textMuted}
            value={query} onChangeText={setQuery} />
          {query ? (
            <Pressable onPress={() => setQuery('')}>
              <Text style={st.clearSearch}>✕</Text>
            </Pressable>
          ) : null}
        </View>
        <Pressable style={[st.filterBtn, showFilters && st.filterBtnActive]}
          onPress={() => setShowFilters(v => !v)}>
          <Text style={st.filterBtnText}>Filters{filterCount > 0 ? ` (${filterCount})` : ''}</Text>
        </Pressable>
      </View>

      {showFilters && (
        <ScrollView style={st.filterPanel} contentContainerStyle={{ gap: 12, padding: spacing.md }}>
          <Text style={st.filterGroupLabel}>Category</Text>
          <View style={st.chipRow}>
            {CATEGORIES.map(c => <Chip key={c} label={c} active={activeCategories.includes(c)} onPress={() => toggle(activeCategories, setActiveCategories, c)} />)}
          </View>
          <Text style={st.filterGroupLabel}>Color</Text>
          <View style={st.chipRow}>
            {COLORS.map(c => <Chip key={c} label={c} active={activeColors.includes(c)} color={CSS_COLORS[c]} onPress={() => toggle(activeColors, setActiveColors, c)} />)}
          </View>
          <Text style={st.filterGroupLabel}>Fabric</Text>
          <View style={st.chipRow}>
            {FABRICS.map(f => <Chip key={f} label={f} active={activeFabrics.includes(f)} onPress={() => toggle(activeFabrics, setActiveFabrics, f)} />)}
          </View>
          {hasFilters && (
            <Pressable onPress={clearFilters}>
              <Text style={st.clearFiltersText}>Clear all filters</Text>
            </Pressable>
          )}
        </ScrollView>
      )}

      {/* ── Article list ── */}
      <ScrollView contentContainerStyle={st.articleList}>
        {!selected || selected.articles.length === 0 ? (
          <View style={st.emptyState}>
            <HangerIcon size={36} color={colors.textMuted} />
            <Text style={st.emptyTitle}>No articles yet</Text>
            <Pressable style={st.addBtn} onPress={() => setShowModal(true)}>
              <Text style={st.addBtnText}>Add your first piece</Text>
            </Pressable>
          </View>
        ) : filteredArticles.length === 0 ? (
          <View style={st.emptyState}>
            <Text style={st.emptyTitle}>No matches</Text>
            <Pressable onPress={clearFilters}><Text style={st.clearFiltersText}>Clear filters</Text></Pressable>
          </View>
        ) : (
          filteredArticles.map(a => (
            <ArticleCard key={a._id} article={a}
              onEdit={() => setEditingArticle(a)}
              onRemove={() => onRemoveArticle(selected._id, a._id)} />
          ))
        )}
      </ScrollView>

      {showModal && (
        <ArticleModal onClose={() => setShowModal(false)}
          onSubmit={async data => { await onAddArticle(selected._id, data); setShowModal(false); }} />
      )}
      {editingArticle && (
        <ArticleModal onClose={() => setEditingArticle(null)}
          initialData={editingArticle}
          onSubmit={async data => { await onEditArticle(selected._id, editingArticle._id, data); setEditingArticle(null); }} />
      )}
    </View>
  );
};

export default ClosetView;

const st = StyleSheet.create({
  root:              { flex: 1, backgroundColor: colors.bgDefault },
  closetBar:         { flexDirection: 'row', gap: 8, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, alignItems: 'center' },
  closetTab:         { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 8, paddingHorizontal: 14, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.glassBorder, backgroundColor: colors.glassBg },
  closetTabActive:   { backgroundColor: colors.saveBtnBg, borderColor: colors.saveBtnBg },
  closetTabText:     { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.textSecondary },
  closetTabTextActive: { color: colors.saveBtnText, fontWeight: fontWeights.semibold },
  starBadge:         { color: '#fbbf24', fontSize: 10 },
  closetCount:       { fontFamily: fonts.body, fontSize: 10, color: colors.textMuted },
  newClosetBtn:      { width: 36, height: 36, borderRadius: 18, borderWidth: 1, borderColor: colors.glassBorder, backgroundColor: colors.glassBg, alignItems: 'center', justifyContent: 'center' },
  newClosetBtnText:  { color: colors.textSecondary, fontSize: 20, lineHeight: 22 },
  closetActions:     { paddingHorizontal: spacing.md, paddingBottom: spacing.sm },
  actionRow:         { flexDirection: 'row', gap: 8 },
  actionBtn:         { paddingVertical: 5, paddingHorizontal: 12, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.glassBorder },
  actionBtnText:     { fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.textSecondary },
  actionBtnDanger:   { borderColor: colors.dangerBorder },
  actionBtnDangerText: { fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.dangerText },
  inlineForm:        { flexDirection: 'row', gap: 8, alignItems: 'center' },
  inlineInput:       { flex: 1, fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.textPrimary, backgroundColor: colors.glassBg, borderWidth: 1, borderColor: colors.glassBorder, borderRadius: radius.sm, paddingVertical: 8, paddingHorizontal: 12 },
  inlineOk:          { paddingVertical: 8, paddingHorizontal: 12, backgroundColor: colors.saveBtnBg, borderRadius: radius.sm },
  inlineOkText:      { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.saveBtnText, fontWeight: fontWeights.semibold },
  inlineCancel:      { paddingVertical: 8, paddingHorizontal: 10 },
  inlineCancelText:  { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.textMuted },
  mainHead:          { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  mainTitle:         { fontFamily: fonts.display, fontSize: 28, color: colors.textPrimary },
  addBtn:            { paddingVertical: 8, paddingHorizontal: 14, backgroundColor: colors.saveBtnBg, borderRadius: radius.sm },
  addBtnText:        { fontFamily: fonts.body, fontSize: fontSizes.sm, fontWeight: fontWeights.semibold, color: colors.saveBtnText },
  searchBar:         { flexDirection: 'row', gap: 8, paddingHorizontal: spacing.md, paddingBottom: spacing.sm },
  searchInputWrap:   { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: colors.glassBg, borderWidth: 1, borderColor: colors.glassBorder, borderRadius: radius.sm, paddingHorizontal: 12 },
  searchInput:       { flex: 1, fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.textPrimary, paddingVertical: 10 },
  clearSearch:       { color: colors.textMuted, paddingLeft: 8, fontSize: 13 },
  filterBtn:         { paddingVertical: 10, paddingHorizontal: 14, backgroundColor: colors.glassBg, borderWidth: 1, borderColor: colors.glassBorder, borderRadius: radius.sm },
  filterBtnActive:   { borderColor: colors.textSecondary },
  filterBtnText:     { fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.textSecondary },
  filterPanel:       { maxHeight: 240, borderBottomWidth: 1, borderBottomColor: colors.glassBorder },
  filterGroupLabel:  { fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
  chipRow:           { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip:              { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 5, paddingHorizontal: 12, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.glassBorder, backgroundColor: colors.glassBg },
  chipActive:        { backgroundColor: colors.saveBtnBg, borderColor: colors.saveBtnBg },
  chipText:          { fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.textSecondary },
  chipTextActive:    { color: colors.saveBtnText },
  chipColor:         { width: 8, height: 8, borderRadius: 4 },
  clearFiltersText:  { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.textSecondary, textDecorationLine: 'underline' },
  articleList:       { padding: spacing.md, gap: spacing.sm, paddingBottom: spacing.xl },
  articleCard:       { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.glassBg, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.glassBorder, padding: 10 },
  articleImg:        { width: 48, height: 48, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.05)', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  articleImgFill:    { width: 48, height: 48 },
  articleInfo:       { flex: 1, gap: 2 },
  articleName:       { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.textPrimary, fontWeight: fontWeights.medium },
  articleMeta:       { fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.textMuted },
  categoryTag:       { fontFamily: fonts.body, fontSize: 10, color: colors.textMuted, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2, alignSelf: 'flex-start' },
  colorDot:          { width: 12, height: 12, borderRadius: 6, borderWidth: 1, borderColor: 'rgba(0,0,0,0.2)' },
  editBtn:           { padding: 8 },
  removeBtn:         { padding: 8 },
  microBtnText:      { fontFamily: fonts.body, fontSize: 14, color: colors.textMuted },
  emptyState:        { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm, padding: spacing.xl },
  emptyTitle:        { fontFamily: fonts.body, fontSize: fontSizes.base, color: colors.textSecondary },
});
