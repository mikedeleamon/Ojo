import { useMemo, useState } from 'react';
import {
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Image,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { View, Text, Pressable } from '../../../components/primitives';
import { HangerIcon } from '../../../components/shared';
import Loading from '../../../components/Loading/Loading';
import { useClosets } from '../../../hooks/useClosets';
import { hapticSuccess } from '../../../lib/haptics';
import { ClothingArticle, ArticleFormData, articleCategories } from '../../../types';
import { spacing, radius, fonts, fontSizes, fontWeights } from '../../../theme/tokens';
import { useTheme } from '../../../theme/ThemeContext';
import { ColorTokens } from '../../../theme/tokens';

/** Map a stored article back to the full form payload, overriding the price. */
const toForm = (a: ClothingArticle, price: number): ArticleFormData => ({
  name:             a.name             ?? '',
  clothingType:     a.clothingType     ?? '',
  topOrBottom:      a.topOrBottom      ?? '',
  clothingCategories: articleCategories(a),
  clothingCategory: articleCategories(a)[0] ?? '',
  fabricType:       a.fabricType       ?? '',
  color:            a.color            ?? '',
  gender:           a.gender           ?? 'Unisex',
  isAccessory:      a.isAccessory      ?? false,
  bodyZone:         a.bodyZone,
  merchant:         a.merchant         ?? '',
  purchasePrice:    price,
  imageUrl:         a.imageUrl         ?? '',
  detectedGarmentType:      a.detectedGarmentType,
  detectedColors:           a.detectedColors,
  detectedFabric:           a.detectedFabric,
  identificationConfidence: a.identificationConfidence,
});

interface Row {
  closetId: string;
  closetName: string;
  article: ClothingArticle;
}

export default function PriceBackfillScreen() {
  const { colors } = useTheme();
  const st = useMemo(() => makeStyles(colors), [colors]);
  const { closets, loading, editArticle } = useClosets();

  const [prices,   setPrices]   = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());

  // Every article still missing a price (saved ones drop out immediately).
  const rows = useMemo<Row[]>(() => {
    const out: Row[] = [];
    for (const c of closets) {
      for (const a of c.articles) {
        if (a.purchasePrice == null && !savedIds.has(a._id)) {
          out.push({ closetId: c._id, closetName: c.name, article: a });
        }
      }
    }
    return out;
  }, [closets, savedIds]);

  const totalSaved = savedIds.size;

  const save = async (row: Row) => {
    const raw = prices[row.article._id];
    const val = parseFloat(raw);
    if (!raw || isNaN(val) || val < 0) return;
    setSavingId(row.article._id);
    try {
      await editArticle(row.closetId, row.article._id, toForm(row.article, val));
      setSavedIds(s => new Set(s).add(row.article._id));
      hapticSuccess();
    } catch {
      // keep the row so the user can retry
    } finally {
      setSavingId(null);
    }
  };

  if (loading) return <Loading />;

  return (
    <SafeAreaView style={st.root} edges={['bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView contentContainerStyle={st.content} keyboardShouldPersistTaps="handled">
          <Text style={st.intro}>
            Add what you paid to unlock cost-per-wear and total wardrobe value in
            Insights. Items without a price are listed below.
          </Text>

          {rows.length === 0 ? (
            <View style={st.empty}>
              <Text style={st.emptyTitle}>
                {totalSaved > 0 ? 'All caught up 🎉' : 'Every item has a price 🎉'}
              </Text>
              <Text style={st.emptyBody}>
                Cost-per-wear is fully unlocked in the Insights tab.
              </Text>
            </View>
          ) : (
            <>
              <Text style={st.countLabel}>
                {rows.length} item{rows.length === 1 ? '' : 's'} without a price
                {totalSaved > 0 ? ` · ${totalSaved} added` : ''}
              </Text>

              {rows.map(row => {
                const { article } = row;
                const raw = prices[article._id] ?? '';
                const valid = raw !== '' && !isNaN(parseFloat(raw)) && parseFloat(raw) >= 0;
                const isSaving = savingId === article._id;
                return (
                  <View key={article._id} style={st.row}>
                    <View style={st.thumb}>
                      {article.imageUrl ? (
                        <Image
                          source={{ uri: article.imageUrl }}
                          style={st.thumbImg}
                          resizeMode="cover"
                        />
                      ) : (
                        <HangerIcon size={20} color={colors.textMuted} />
                      )}
                    </View>
                    <View style={st.info}>
                      <Text style={st.name} numberOfLines={1}>
                        {article.name || article.clothingType || 'Item'}
                      </Text>
                      <Text style={st.sub} numberOfLines={1}>
                        {[article.clothingType, article.color].filter(Boolean).join(' · ') ||
                          row.closetName}
                      </Text>
                    </View>
                    <View style={st.priceWrap}>
                      <Text style={st.dollar}>$</Text>
                      <TextInput
                        style={st.priceInput}
                        placeholder="0"
                        placeholderTextColor={colors.textMuted}
                        keyboardType="decimal-pad"
                        value={raw}
                        onChangeText={v => setPrices(p => ({ ...p, [article._id]: v }))}
                        onSubmitEditing={() => save(row)}
                        returnKeyType="done"
                        accessibilityLabel={`Price for ${article.name || article.clothingType}`}
                      />
                    </View>
                    <Pressable
                      style={[st.saveBtn, (!valid || isSaving) && st.saveBtnDisabled]}
                      onPress={() => save(row)}
                      disabled={!valid || isSaving}
                      accessibilityRole="button"
                      accessibilityLabel={`Save price for ${article.name || article.clothingType}`}
                    >
                      {isSaving ? (
                        <ActivityIndicator size="small" color={colors.saveBtnText} />
                      ) : (
                        <Text style={st.saveBtnText}>Save</Text>
                      )}
                    </Pressable>
                  </View>
                );
              })}
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const makeStyles = (colors: ColorTokens) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.bgDefault },
    content: { padding: spacing.md, gap: spacing.sm, paddingBottom: spacing.xl },
    intro: {
      fontFamily: fonts.body,
      fontSize: fontSizes.sm,
      color: colors.textSecondary,
      lineHeight: fontSizes.sm * 1.6,
      marginBottom: spacing.xs,
    },
    countLabel: {
      fontFamily: fonts.body,
      fontSize: fontSizes.xs,
      fontWeight: fontWeights.medium,
      color: colors.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: 2,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingVertical: 10,
      paddingHorizontal: spacing.sm,
      backgroundColor: colors.glassBg,
      borderWidth: 1,
      borderColor: colors.glassBorder,
      borderRadius: radius.md,
    },
    thumb: {
      width: 44,
      height: 44,
      borderRadius: radius.sm,
      backgroundColor: colors.glassBg,
      borderWidth: 1,
      borderColor: colors.glassBorder,
      overflow: 'hidden',
      alignItems: 'center',
      justifyContent: 'center',
    },
    thumbImg: { width: 44, height: 44 },
    info: { flex: 1, gap: 2 },
    name: {
      fontFamily: fonts.body,
      fontSize: fontSizes.sm,
      fontWeight: fontWeights.medium,
      color: colors.textPrimary,
    },
    sub: { fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.textMuted },
    priceWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.bgDefault,
      borderWidth: 1,
      borderColor: colors.glassBorder,
      borderRadius: radius.sm,
      paddingHorizontal: 8,
      width: 76,
    },
    dollar: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.textMuted },
    priceInput: {
      flex: 1,
      paddingVertical: 8,
      paddingHorizontal: 2,
      fontFamily: fonts.body,
      fontSize: fontSizes.base,
      color: colors.textPrimary,
    },
    saveBtn: {
      paddingVertical: 9,
      paddingHorizontal: 14,
      backgroundColor: colors.saveBtnBg,
      borderRadius: radius.sm,
      alignItems: 'center',
      justifyContent: 'center',
      minWidth: 60,
    },
    saveBtnDisabled: { opacity: 0.4 },
    saveBtnText: {
      fontFamily: fonts.body,
      fontSize: fontSizes.sm,
      fontWeight: fontWeights.semibold,
      color: colors.saveBtnText,
    },
    empty: { alignItems: 'center', gap: spacing.xs, paddingVertical: spacing.xl },
    emptyTitle: {
      fontFamily: fonts.display,
      fontSize: fontSizes.xl,
      color: colors.textPrimary,
      textAlign: 'center',
    },
    emptyBody: {
      fontFamily: fonts.body,
      fontSize: fontSizes.base,
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: fontSizes.base * 1.5,
    },
  });
