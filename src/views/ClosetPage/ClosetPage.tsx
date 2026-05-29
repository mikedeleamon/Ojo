import { useEffect, useMemo, useState } from 'react';
import { Alert, StyleSheet } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { View, Text } from '../../components/primitives';
import ClosetView from '../../components/ClosetView/ClosetView';
import Loading from '../../components/Loading/Loading';
import { useClosets } from '../../hooks/useClosets';
import { useAppNavigation } from '../../hooks/useAppNavigation';
import { fonts, fontSizes, spacing, radius } from '../../theme/tokens';
import { useTheme } from '../../theme/ThemeContext';

export type QuickAddData = {
  uri:      string;
  localUri: string;
  width:    number;
  height:   number;
};

export default function ClosetPage() {
  const { colors } = useTheme();
  const { push } = useAppNavigation();
  const router     = useRouter();
  const params     = useLocalSearchParams<{
    quickAddUri?: string;
    quickAddLocalUri?: string;
    quickAddWidth?: string;
    quickAddHeight?: string;
  }>();
  const insets     = useSafeAreaInsets();

  const st = useMemo(() => StyleSheet.create({
    root:        { flex: 1, backgroundColor: colors.bgDefault },
    errorBanner: { margin: spacing.md, padding: spacing.sm, backgroundColor: colors.errorBg, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.errorBorder },
    errorText:   { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.errorText },
    emptyState:  { alignItems: 'center', padding: spacing.xl, gap: spacing.sm },
    emptyTitle:  { fontFamily: fonts.body, fontSize: fontSizes.lg, color: colors.textPrimary },
    emptyDesc:   { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.textSecondary, textAlign: 'center' },
  }), [colors]);

  const {
    closets, loading, error,
    createCloset, renameCloset, deleteCloset,
    addArticle, editArticle, removeArticle, setPreferred,
  } = useClosets();

  // Route params set by the QuickAdd FAB after image capture
  const quickAddParam: QuickAddData | undefined =
    params.quickAddUri
      ? {
          uri:      params.quickAddUri,
          localUri: params.quickAddLocalUri!,
          width:    Number(params.quickAddWidth),
          height:   Number(params.quickAddHeight),
        }
      : undefined;

  const [pendingQuickAdd, setPendingQuickAdd] = useState<QuickAddData | null>(null);
  const [activeQuickAdd,  setActiveQuickAdd]  = useState<QuickAddData | null>(null);

  // Capture the param immediately and clear it from the route so
  // navigating back to this tab later doesn't re-trigger the flow.
  useEffect(() => {
    if (!quickAddParam) return;
    setPendingQuickAdd(quickAddParam);
    router.setParams({ quickAddUri: undefined as any });
  }, [quickAddParam?.uri]);

  // Once loading is done, either activate the quickAdd or explain why it can't run.
  useEffect(() => {
    if (!pendingQuickAdd || loading) return;
    if (closets.length > 0) {
      setActiveQuickAdd(pendingQuickAdd);
    } else {
      Alert.alert('No closet yet', 'Create a closet first, then you can add garments to it.', [{ text: 'OK' }]);
    }
    setPendingQuickAdd(null);
  }, [pendingQuickAdd, loading, closets.length]);

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
          <Text style={st.emptyTitle}>Your closet is empty</Text>
          <Text style={st.emptyDesc}>
            Create your first closet to start organising your wardrobe.
          </Text>
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
        quickAddImage={activeQuickAdd}
        onQuickAddConsumed={() => setActiveQuickAdd(null)}
        tabClearance={0}
      />
    </SafeAreaView>
  );
}
