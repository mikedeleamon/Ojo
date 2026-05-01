import { useState, useEffect } from 'react';
import { StyleSheet, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { View, Text, Pressable } from '../../../components/primitives';
import { loadHistory, deleteHistoryEntry, clearHistory } from '../../../lib/outfitHistory';
import { OutfitHistoryEntry } from '../../../types';
import { styles as s } from './screens.styles';
import { colors, spacing, radius, fonts, fontSizes } from '../../../theme/tokens';

const Root = ({ children }: { children: React.ReactNode }) => (
  <SafeAreaView style={st.root} edges={['bottom']}>
    <ScrollView contentContainerStyle={st.content}>{children}</ScrollView>
  </SafeAreaView>
);

const InfoCard = ({ title, body }: { title: string; body: string }) => (
  <View style={s.infoCard}>
    <Text style={s.infoTitle}>{title}</Text>
    <Text style={s.infoBody}>{body}</Text>
  </View>
);

// ─── Permissions ──────────────────────────────────────────────────────────────

export const PermissionsScreen = () => (
  <Root>
    <InfoCard title="Location"
      body="Only the city name you enter is used for weather lookups — no GPS data is collected." />
    <InfoCard title="Photos"
      body="Photo access is requested only when you add a clothing image. Stored securely and only used to display your items." />
    <InfoCard title="Other"
      body="No microphone, contacts, background services, or other permissions are requested." />
  </Root>
);

// ─── Data Usage ───────────────────────────────────────────────────────────────

export const DataUsageScreen = () => (
  <Root>
    <InfoCard title="What we store"
      body="Your account, closets, clothing articles, outfit history, and style preferences are stored in our secure cloud database." />
    <InfoCard title="What we don't do"
      body="We don't sell your data, use it for advertising, or share it with third parties beyond what's needed to run the app." />
    <InfoCard title="Delete your data"
      body="Go to Account → Profile → Delete Account to permanently remove all your data within 30 days." />
  </Root>
);

// ─── History ──────────────────────────────────────────────────────────────────

export const HistoryScreen = () => {
  const [entries, setEntries] = useState<OutfitHistoryEntry[]>([]);

  useEffect(() => { loadHistory().then(setEntries); }, []);

  const handleDelete = async (id: string) => {
    await deleteHistoryEntry(id);
    setEntries(prev => prev.filter(e => e.id !== id));
  };

  const handleClearAll = () => {
    Alert.alert(`Clear all ${entries.length} entries?`, undefined, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Yes, clear', style: 'destructive', onPress: async () => {
        await clearHistory(); setEntries([]);
      }},
    ]);
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    const today     = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    const same = (a: Date, b: Date) =>
      a.getDate() === b.getDate() && a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear();
    const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (same(d, today))     return `Today, ${time}`;
    if (same(d, yesterday)) return `Yesterday, ${time}`;
    return `${d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}, ${time}`;
  };

  if (entries.length === 0) {
    return <Root><InfoCard title="No outfits logged yet"
      body='Tap "Wore this today" on the home screen after getting a suggestion.' /></Root>;
  }

  return (
    <Root>
      <Pressable style={st.clearBtn} onPress={handleClearAll}>
        <Text style={st.clearBtnText}>Clear all</Text>
      </Pressable>
      {entries.map(entry => (
        <View key={entry.id} style={s.historyCard}>
          <View style={s.historyMeta}>
            <Text style={s.historyDate}>{formatDate(entry.wornAt)}</Text>
            <Text style={s.historyCloset}>{entry.closetName}</Text>
          </View>
          <Text style={s.historySummary} numberOfLines={2}>{entry.articleSummary}</Text>
          <Pressable style={s.historyDeleteBtn} onPress={() => handleDelete(entry.id)}
            accessibilityLabel="Remove entry">
            <Text style={{ color: colors.textMuted, fontSize: 12 }}>✕</Text>
          </Pressable>
        </View>
      ))}
      <Text style={s.hint}>Outfits from the last 3 days are deprioritised in new suggestions.</Text>
    </Root>
  );
};

const st = StyleSheet.create({
  root:        { flex: 1, backgroundColor: colors.bgDefault },
  content:     { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xl },
  clearBtn: {
    alignSelf: 'flex-end',
    paddingVertical: 6, paddingHorizontal: 14,
    borderRadius: radius.pill, borderWidth: 1,
    borderColor: 'rgba(252,165,165,0.3)',
  },
  clearBtnText: { fontFamily: fonts.body, fontSize: 12, color: 'rgba(252,165,165,0.75)' },
});
