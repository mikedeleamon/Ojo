import { useMemo, useCallback } from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { View, Text } from '../../components/primitives';
import ClosetView from '../../components/ClosetView/ClosetView';
import Loading from '../../components/Loading/Loading';
import { HangerIcon } from '../../components/shared/HangerIcon';
import { useClosets } from '../../hooks/useClosets';
import { useAppNavigation } from '../../hooks/useAppNavigation';
import { useTabBarPadding } from '../../hooks/useTabBarPadding';
import { fonts, fontSizes, spacing, radius } from '../../theme/tokens';
import { useTheme } from '../../theme/ThemeContext';

// Retained for backward import compatibility — adding new articles now flows
// through the /camera modal route, not URL params.
export type QuickAddData = {
  uri:      string;
  localUri: string;
  width:    number;
  height:   number;
};

export default function ClosetPage() {
  const { colors } = useTheme();
  const { push } = useAppNavigation();
  const tabPad = useTabBarPadding();

  const st = useMemo(() => StyleSheet.create({
    root:        { flex: 1, backgroundColor: colors.bgDefault },
    errorBanner: { margin: spacing.md, padding: spacing.sm, backgroundColor: colors.errorBg, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.errorBorder },
    errorText:   { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.errorText },
    emptyState:  { alignItems: 'center', paddingHorizontal: spacing.xl, paddingTop: spacing.xl, gap: spacing.sm },
    emptyTitle:  { fontFamily: fonts.display, fontSize: fontSizes.xl, color: colors.textPrimary, textAlign: 'center' },
    emptyDesc:   { fontFamily: fonts.body, fontSize: fontSizes.base, color: colors.textSecondary, textAlign: 'center', lineHeight: fontSizes.base * 1.6 },
    emptyHint:   { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.textMuted, textAlign: 'center', marginTop: spacing.xs },
  }), [colors]);

  const {
    closets, loading, error, refresh,
    createCloset, renameCloset, deleteCloset,
    addArticle, editArticle, removeArticle, setPreferred,
  } = useClosets();

  useFocusEffect(useCallback(() => {
    refresh();
  }, [refresh]));

  if (loading) return <Loading />;

  return (
    <SafeAreaView style={st.root} edges={['top']}>
      {error ? (
        <View style={st.errorBanner}>
          <Text style={st.errorText}>{error}</Text>
        </View>
      ) : null}

      {closets.length === 0 ? (
        <View style={st.emptyState}>
          <HangerIcon size={36} color={colors.textMuted} />
          <Text style={st.emptyTitle}>Your wardrobe is empty</Text>
          <Text style={st.emptyDesc}>
            Tap the{' '}
            <Text style={{ color: colors.textPrimary }}>+</Text>
            {' '}button below to create your first closet, then use the camera to photograph your clothes.
          </Text>
          <Text style={st.emptyHint}>Outfit suggestions unlock once you add a top and a bottom.</Text>
        </View>
      ) : null}

      <ClosetView
        closets={closets}
        onCreateCloset={createCloset}
        onRenameCloset={renameCloset}
        onDeleteCloset={deleteCloset}
        onAddArticle={addArticle}
        onEditArticle={editArticle}
        onRemoveArticle={removeArticle}
        onSetPreferred={setPreferred}
        onTripFit={() => push('/account/tripfit')}
        tabClearance={tabPad}
      />
    </SafeAreaView>
  );
}
