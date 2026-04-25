import { useState, useMemo, useEffect } from 'react';
import { StyleSheet, ScrollView, Image, Pressable } from 'react-native';
import { Svg, Path, Circle } from 'react-native-svg';
import { View, Text } from '../primitives';
import { EmptyState } from '../shared';
import { useClosets } from '../../hooks/useClosets';
import { useAppNavigation } from '../../hooks/useAppNavigation';
import { generateOutfits, OutfitRole, OutfitResult, ScoreBreakdown } from '../../lib/outfitEngine';
import { addHistoryEntry, recentlyWornIds } from '../../lib/outfitHistory';
import { updatePreferences } from '../../lib/userPreferences';
import { ClothingArticle, CurrentWeather, Settings } from '../../types';
import { colors, fonts, fontSizes, fontWeights, spacing, radius } from '../../theme/tokens';

// ─── Constants ────────────────────────────────────────────────────────────────

const CSS_COLORS: Record<string, string> = {
  Black: '#1a1a1a', White: '#f5f5f5', Grey: '#9ca3af', Navy: '#1e3a5f',
  Blue: '#3b82f6', Green: '#22c55e', Red: '#ef4444', Brown: '#92400e',
  Beige: '#d4b896', Pink: '#f9a8d4', Yellow: '#fbbf24', Purple: '#a855f7',
  Orange: '#f97316',
};

const ROLE_LABELS: Record<OutfitRole, string> = {
  top: 'Top', bottom: 'Bottom', fullBody: 'Outfit',
  outerwear: 'Outerwear', footwear: 'Footwear', accessory: 'Extra',
};

const BREAKDOWN_LABELS: { key: keyof ScoreBreakdown; label: string }[] = [
  { key: 'fabric',     label: 'Weather' },
  { key: 'color',      label: 'Color'   },
  { key: 'style',      label: 'Style'   },
  { key: 'simplicity', label: 'Simple'  },
  { key: 'preference', label: 'You'     },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

const HangerIcon = ({ size = 24, color = colors.textSecondary }: { size?: number; color?: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M12 4a2 2 0 0 1 2 2c0 .74-.4 1.38-1 1.73V9l8 5.5A1 1 0 0 1 20 16H4a1 1 0 0 1-.99-1.5L11 9V7.73A2 2 0 0 1 12 4Z"
      stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"/>
  </Svg>
);

const ArticleThumb = ({ article, role }: { article: ClothingArticle; role: OutfitRole }) => (
  <View style={st.articleCard}>
    <View style={st.articleImg}>
      {article.imageUrl
        ? <Image source={{ uri: article.imageUrl }} style={st.articleImgFill} resizeMode="cover" />
        : <HangerIcon size={20} color={colors.textMuted} />
      }
      {article.color && CSS_COLORS[article.color] && (
        <View style={[st.colorDot, { backgroundColor: CSS_COLORS[article.color] }]} />
      )}
    </View>
    <View style={st.articleLabel}>
      <Text style={st.roleLabel}>{ROLE_LABELS[role]}</Text>
      <Text style={st.articleName} numberOfLines={1}>{article.name || article.clothingType}</Text>
      {article.fabricType ? <Text style={st.articleMeta}>{article.fabricType}</Text> : null}
    </View>
  </View>
);

const ScoreBadge = ({ score }: { score: number }) => {
  const color = score >= 80 ? 'rgba(52,211,153,0.9)' : score >= 60 ? 'rgba(251,191,36,0.9)' : 'rgba(148,163,184,0.9)';
  return (
    <View style={[st.scoreBadge, { borderColor: color }]}>
      <Text style={[st.scoreBadgeText, { color }]}>{score}</Text>
    </View>
  );
};

// ─── Main component ───────────────────────────────────────────────────────────

interface Props { weather: CurrentWeather; settings: Settings; }

const OutfitSuggestion = ({ weather, settings }: Props) => {
  const { closets, loading, preferred, setPreferred, setClosets } = useClosets();
  const [settingPref,   setSettingPref]   = useState(false);
  const [activeIdx,     setActiveIdx]     = useState(0);
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [wornLogged,    setWornLogged]    = useState(false);
  const [worn,          setWorn]          = useState<Set<string>>(new Set());
  const nav = useAppNavigation();

  useEffect(() => { recentlyWornIds(3).then(setWorn); }, []);

  const setPreferredCloset = async (id: string) => {
    setSettingPref(true);
    try { await setPreferred(id); } catch {}
    setSettingPref(false);
  };

  const { outfits, status } = useMemo(() => {
    if (!preferred) return { outfits: [], status: 'no_preferred' as const };
    const { results, status } = generateOutfits(preferred.articles, weather, settings, worn, 3);
    return { outfits: results, status };
  }, [preferred, weather, settings, worn]);

  const safeIdx      = Math.min(activeIdx, Math.max(0, outfits.length - 1));
  const activeOutfit: OutfitResult | null = outfits[safeIdx] ?? null;

  const handleWoreThis = async () => {
    if (!preferred || !activeOutfit || activeOutfit.status !== 'ok') return;
    const articles = activeOutfit.slots.map(s => s.article);
    await addHistoryEntry({
      closetId: preferred._id, closetName: preferred.name,
      articleIds: articles.map(a => a._id),
      articleSummary: articles.map(a => a.name || a.clothingType).join(', '),
    });
    await updatePreferences(articles);
    setWornLogged(true);
    setTimeout(() => setWornLogged(false), 3000);
  };

  if (loading) return null;

  if (closets.length === 0) return (
    <EmptyState
      icon={<HangerIcon size={32} />}
      title="No closet yet"
      body="Create a closet and add your clothes to get outfit suggestions."
      action={
        <Pressable style={st.ctaBtn} onPress={() => nav.push('Closet')}>
          <Text style={st.ctaBtnText}>Create closet</Text>
        </Pressable>
      }
    />
  );

  if (!preferred) return (
    <View style={st.root}>
      <Text style={st.sectionLabel}>Outfit</Text>
      <EmptyState icon={<HangerIcon size={32} />} title="Pick a preferred closet"
        body="Select a closet to use for daily outfit suggestions." />
      <View style={st.closetPicker}>
        {closets.map(c => (
          <Pressable key={c._id} style={st.closetPickBtn}
            onPress={() => setPreferredCloset(c._id)} disabled={settingPref}>
            <HangerIcon size={14} color={colors.textSecondary} />
            <Text style={st.closetPickName}>{c.name}</Text>
            <Text style={st.closetPickCount}>{c.articles.length}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );

  if (status === 'empty_closet' || status === 'insufficient') return (
    <View style={st.root}>
      <PreferredBadge name={preferred.name} onPress={() => nav.push('Closet')} />
      <EmptyState
        icon={<HangerIcon size={32} />}
        title={status === 'empty_closet' ? 'This closet is empty' : 'Not enough to build an outfit'}
        body={status === 'empty_closet'
          ? 'Add clothing articles to get outfit suggestions.'
          : 'Add a top and a bottom (or a full-body piece) to get a suggestion.'}
        action={
          <Pressable style={st.ctaBtn} onPress={() => nav.push('Closet')}>
            <Text style={st.ctaBtnText}>Add clothes</Text>
          </Pressable>
        }
      />
    </View>
  );

  if (!activeOutfit) return null;

  return (
    <View style={st.root}>
      {/* Header */}
      <View style={st.header}>
        <PreferredBadge name={preferred.name} onPress={() => nav.push('Closet')} />
        <ScoreBadge score={activeOutfit.score} />
      </View>

      {/* Outfit selector tabs */}
      {outfits.length > 1 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={st.tabsScroll}>
          <View style={st.tabs}>
            {outfits.map((o, i) => (
              <Pressable key={i}
                style={[st.tab, i === safeIdx && st.tabActive]}
                onPress={() => { setActiveIdx(i); setWornLogged(false); setShowBreakdown(false); }}>
                <Text style={[st.tabText, i === safeIdx && st.tabTextActive]}>
                  {i === 0 ? 'Best match' : `Option ${i + 1}`}
                </Text>
                <Text style={[st.tabScore, i === safeIdx && st.tabTextActive]}>{o.score}</Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>
      )}

      {/* Headline */}
      <Text style={st.headline}>{activeOutfit.headline}</Text>

      {/* Article grid */}
      <View style={st.articleGrid}>
        {activeOutfit.slots.map((slot, i) => (
          <ArticleThumb key={`${safeIdx}-${i}`} article={slot.article} role={slot.role} />
        ))}
      </View>

      {/* Score breakdown */}
      <Pressable style={st.breakdownToggle} onPress={() => setShowBreakdown(v => !v)}>
        <Text style={st.breakdownToggleText}>
          {showBreakdown ? 'Hide breakdown' : 'Score breakdown'}
        </Text>
      </Pressable>

      {showBreakdown && (
        <View style={st.breakdownRow}>
          {BREAKDOWN_LABELS.map(({ key, label }) => (
            <View key={key} style={st.breakdownItem}>
              <Text style={st.breakdownLabel}>{label}</Text>
              <View style={st.breakdownBarBg}>
                <View style={[st.breakdownBarFill, { width: `${activeOutfit.scoreBreakdown[key]}%` as any }]} />
              </View>
              <Text style={st.breakdownValue}>{activeOutfit.scoreBreakdown[key]}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Notes */}
      {activeOutfit.notes.length > 0 && (
        <View style={st.notesList}>
          {activeOutfit.notes.map((n, i) => (
            <Text key={i} style={st.note}>· {n}</Text>
          ))}
        </View>
      )}

      {/* Wore this today */}
      <Pressable
        style={[st.woreThisBtn, wornLogged && st.woreThisLogged]}
        onPress={handleWoreThis}
        disabled={wornLogged}>
        <Text style={[st.woreThisText, wornLogged && st.woreThisTextLogged]}>
          {wornLogged ? '✓ Logged!' : '⏱ Wore this today'}
        </Text>
      </Pressable>
    </View>
  );
};

const PreferredBadge = ({ name, onPress }: { name: string; onPress: () => void }) => (
  <Pressable style={st.preferredBadge} onPress={onPress}>
    <HangerIcon size={11} color={colors.textSecondary} />
    <Text style={st.preferredBadgeText}>{name}</Text>
  </Pressable>
);

export default OutfitSuggestion;

const st = StyleSheet.create({
  root:           { gap: spacing.sm },
  sectionLabel:   { fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.textMuted, fontWeight: fontWeights.medium, textTransform: 'uppercase', letterSpacing: 1 },
  header:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  preferredBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 5, paddingHorizontal: 10, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: radius.pill, borderWidth: 1, borderColor: colors.glassBorder },
  preferredBadgeText: { fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.textSecondary },
  scoreBadge:     { paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill, borderWidth: 1 },
  scoreBadgeText: { fontFamily: fonts.body, fontSize: fontSizes.sm, fontWeight: fontWeights.semibold },
  tabsScroll:     { marginHorizontal: -spacing.md },
  tabs:           { flexDirection: 'row', gap: 8, paddingHorizontal: spacing.md, paddingBottom: 4 },
  tab:            { paddingVertical: 6, paddingHorizontal: 14, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.glassBorder, flexDirection: 'row', gap: 6, alignItems: 'center' },
  tabActive:      { backgroundColor: 'rgba(255,255,255,0.12)', borderColor: colors.glassBorder },
  tabText:        { fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.textSecondary },
  tabTextActive:  { color: colors.textPrimary },
  tabScore:       { fontFamily: fonts.body, fontSize: 10, color: colors.textMuted },
  headline:       { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.textSecondary, lineHeight: fontSizes.sm * 1.5 },
  articleGrid:    { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  articleCard:    { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: radius.sm, borderWidth: 1, borderColor: colors.glassBorder, padding: 8, flex: 1, minWidth: 140 },
  articleImg:     { width: 44, height: 44, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.05)', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  articleImgFill: { width: 44, height: 44 },
  colorDot:       { position: 'absolute', bottom: 2, right: 2, width: 8, height: 8, borderRadius: 4, borderWidth: 1, borderColor: 'rgba(0,0,0,0.2)' },
  articleLabel:   { flex: 1, gap: 2 },
  roleLabel:      { fontFamily: fonts.body, fontSize: 10, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
  articleName:    { fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.textPrimary, fontWeight: fontWeights.medium },
  articleMeta:    { fontFamily: fonts.body, fontSize: 10, color: colors.textMuted },
  breakdownToggle:     { paddingVertical: 6, alignSelf: 'flex-start' },
  breakdownToggleText: { fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.textSecondary, textDecorationLine: 'underline' },
  breakdownRow:   { gap: 6 },
  breakdownItem:  { flexDirection: 'row', alignItems: 'center', gap: 8 },
  breakdownLabel: { fontFamily: fonts.body, fontSize: 10, color: colors.textMuted, width: 46 },
  breakdownBarBg: { flex: 1, height: 4, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 2, overflow: 'hidden' },
  breakdownBarFill: { height: 4, backgroundColor: colors.textSecondary, borderRadius: 2 },
  breakdownValue: { fontFamily: fonts.body, fontSize: 10, color: colors.textMuted, width: 24, textAlign: 'right' },
  notesList:      { gap: 4 },
  note:           { fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.textSecondary, lineHeight: fontSizes.xs * 1.5 },
  woreThisBtn:    { marginTop: 4, paddingVertical: 10, paddingHorizontal: spacing.md, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.glassBorder, alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.05)' },
  woreThisLogged: { borderColor: 'rgba(52,211,153,0.4)', backgroundColor: 'rgba(52,211,153,0.08)' },
  woreThisText:   { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.textSecondary },
  woreThisTextLogged: { color: colors.successText },
  ctaBtn:         { paddingVertical: 10, paddingHorizontal: spacing.md, backgroundColor: colors.saveBtnBg, borderRadius: radius.sm, alignItems: 'center', marginTop: 4 },
  ctaBtnText:     { fontFamily: fonts.body, fontSize: fontSizes.sm, fontWeight: fontWeights.semibold, color: colors.saveBtnText },
  closetPicker:   { gap: 8, marginTop: 4 },
  closetPickBtn:  { flexDirection: 'row', alignItems: 'center', gap: 8, padding: spacing.sm, backgroundColor: colors.glassBg, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.glassBorder },
  closetPickName: { flex: 1, fontFamily: fonts.body, fontSize: fontSizes.base, color: colors.textPrimary },
  closetPickCount:{ fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.textMuted },
});
