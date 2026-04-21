import { useState, useEffect } from 'react';
import ScreenShell from '../components/ScreenShell';
import { View, Text, Pressable } from '../../../components/primitives';
import { loadHistory, deleteHistoryEntry, clearHistory } from '../../../lib/outfitHistory';
import { OutfitHistoryEntry } from '../../../types';
import styles from './screens.module.css';

interface EmbedProps { embedded?: boolean; }

// ─── Notifications ────────────────────────────────────────────────────────────

export const NotificationsScreen = ({ embedded }: EmbedProps) => (
  <ScreenShell title="Push Notifications" embedded={embedded}>
    <View style={styles.infoCard}>
      <Text style={styles.infoTitle}>Coming soon</Text>
      <Text style={styles.infoBody}>
        Push notifications aren't available yet. Check back in a future update.
      </Text>
    </View>
  </ScreenShell>
);

// ─── Permissions ──────────────────────────────────────────────────────────────

export const PermissionsScreen = ({ embedded }: EmbedProps) => (
  <ScreenShell title="Permissions" embedded={embedded}>
    <View style={styles.infoCard}>
      <Text style={styles.infoTitle}>Location</Text>
      <Text style={styles.infoBody}>
        Only the city name you enter is used for weather lookups — no GPS or
        precise location data is ever collected.
      </Text>
    </View>
    <View style={styles.infoCard}>
      <Text style={styles.infoTitle}>Photos</Text>
      <Text style={styles.infoBody}>
        Photo access is only requested when you add a clothing image. Images are
        stored securely and used solely to display your items.
      </Text>
    </View>
    <View style={styles.infoCard}>
      <Text style={styles.infoTitle}>Other</Text>
      <Text style={styles.infoBody}>
        No microphone, contacts, background services, or other device permissions
        are requested.
      </Text>
    </View>
  </ScreenShell>
);

// ─── Data Usage ───────────────────────────────────────────────────────────────

export const DataUsageScreen = ({ embedded }: EmbedProps) => (
  <ScreenShell title="Data Usage" embedded={embedded}>
    <View style={styles.infoCard}>
      <Text style={styles.infoTitle}>What we store</Text>
      <Text style={styles.infoBody}>
        Your account, closets, clothing articles, outfit history, and style
        preferences are stored in our secure cloud database (MongoDB Atlas).
      </Text>
    </View>
    <View style={styles.infoCard}>
      <Text style={styles.infoTitle}>What we don't do</Text>
      <Text style={styles.infoBody}>
        We don't sell your data, use it for advertising, or share it with third
        parties beyond what's needed to run the app.
      </Text>
    </View>
    <View style={styles.infoCard}>
      <Text style={styles.infoTitle}>Delete your data</Text>
      <Text style={styles.infoBody}>
        You can permanently remove your account and all data from Account → Profile → Delete Account.
      </Text>
    </View>
  </ScreenShell>
);

// ─── History ──────────────────────────────────────────────────────────────────

export const HistoryScreen = ({ embedded }: EmbedProps) => {
  const [entries,      setEntries]      = useState<OutfitHistoryEntry[]>([]);
  const [confirmClear, setConfirmClear] = useState(false);

  useEffect(() => {
    loadHistory().then(setEntries);
  }, []);

  const handleDelete = async (id: string) => {
    await deleteHistoryEntry(id);
    setEntries(prev => prev.filter(e => e.id !== id));
  };

  const handleClearAll = async () => {
    await clearHistory();
    setEntries([]);
    setConfirmClear(false);
  };

  const formatDate = (iso: string): string => {
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

  return (
    <ScreenShell title="Outfit History" embedded={embedded}>
      {entries.length === 0 ? (
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>No outfits logged yet</Text>
          <Text style={styles.infoBody}>
            Tap "Wore this today" on the home screen after getting a suggestion.
          </Text>
        </View>
      ) : (
        <>
          {confirmClear ? (
            <View style={styles.confirmRow}>
              <Text style={styles.confirmText}>Clear all {entries.length} entries?</Text>
              <Pressable style={styles.confirmYes} onPress={handleClearAll}>
                <Text>Yes, clear</Text>
              </Pressable>
              <Pressable style={styles.confirmNo} onPress={() => setConfirmClear(false)}>
                <Text>Cancel</Text>
              </Pressable>
            </View>
          ) : (
            <Pressable style={styles.clearAllBtn} onPress={() => setConfirmClear(true)}>
              <Text>Clear all</Text>
            </Pressable>
          )}

          <View style={styles.historyList}>
            {entries.map(entry => (
              <View key={entry.id} style={styles.historyCard}>
                <View style={styles.historyMeta}>
                  <Text style={styles.historyDate}>{formatDate(entry.wornAt)}</Text>
                  <Text style={styles.historyCloset}>{entry.closetName}</Text>
                </View>
                <Text style={styles.historySummary}>{entry.articleSummary}</Text>
                <Pressable
                  style={styles.historyDeleteBtn}
                  onPress={() => handleDelete(entry.id)}
                  accessibilityLabel="Remove entry"
                >
                  <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                    <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                </Pressable>
              </View>
            ))}
          </View>

          <Text style={styles.hint}>
            Outfits from the last 3 days are deprioritised in new suggestions.
          </Text>
        </>
      )}
    </ScreenShell>
  );
};
