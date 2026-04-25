import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { View, Text } from '../../components/primitives';
import ClosetView from '../../components/ClosetView/ClosetView';
import Loading from '../../components/Loading/Loading';
import { useClosets } from '../../hooks/useClosets';
import { colors, fonts, fontSizes, spacing, radius } from '../../theme/tokens';

export default function ClosetPage() {
  const {
    closets, loading, error,
    createCloset, renameCloset, deleteCloset,
    addArticle, editArticle, removeArticle, setPreferred,
  } = useClosets();

  if (loading) return <Loading />;

  return (
    <SafeAreaView style={st.root} edges={['top', 'bottom']}>
      {error ? (
        <View style={st.errorBanner}>
          <Text style={st.errorText}>{error}</Text>
        </View>
      ) : null}

      {closets.length === 0 ? (
        <View style={st.emptyState}>
          <Text style={st.emptyTitle}>Your closet is empty</Text>
          <Text style={st.emptyDesc}>
            Create your first closet to start organising your wardrobe.
          </Text>
          {/* Creation is handled inside ClosetView — pass empty closets to trigger the UI */}
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
      />
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  root:        { flex: 1, backgroundColor: colors.bgDefault },
  errorBanner: { margin: spacing.md, padding: spacing.sm, backgroundColor: colors.errorBg, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.errorBorder },
  errorText:   { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.errorText },
  emptyState:  { alignItems: 'center', padding: spacing.xl, gap: spacing.sm },
  emptyTitle:  { fontFamily: fonts.body, fontSize: fontSizes.lg, color: colors.textPrimary },
  emptyDesc:   { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.textSecondary, textAlign: 'center' },
});
