import { useState, useEffect } from 'react';
import ScreenShell from '../components/ScreenShell';
import { loadHistory, deleteHistoryEntry, clearHistory } from '../../../lib/outfitHistory';
import { OutfitHistoryEntry } from '../../../types';
import styles from './screens.module.css';

interface EmbedProps { embedded?: boolean; }

// ─── Notifications ────────────────────────────────────────────────────────────

export const NotificationsScreen = ({ embedded }: EmbedProps) => (
  <ScreenShell title="Push Notifications" embedded={embedded}>
    <div className={styles.infoCard}>
      <p className={styles.infoTitle}>Coming soon</p>
      <p className={styles.infoBody}>
        Push notifications aren't available yet. Check back in a future update.
      </p>
    </div>
  </ScreenShell>
);

// ─── Permissions ──────────────────────────────────────────────────────────────

export const PermissionsScreen = ({ embedded }: EmbedProps) => (
  <ScreenShell title="Permissions" embedded={embedded}>
    <div className={styles.infoCard}>
      <p className={styles.infoTitle}>Location</p>
      <p className={styles.infoBody}>
        Only the city name you enter is used for weather lookups — no GPS or
        precise location data is ever collected.
      </p>
    </div>
    <div className={styles.infoCard}>
      <p className={styles.infoTitle}>Photos</p>
      <p className={styles.infoBody}>
        Photo access is only requested when you add a clothing image. Images are
        stored securely and used solely to display your items.
      </p>
    </div>
    <div className={styles.infoCard}>
      <p className={styles.infoTitle}>Other</p>
      <p className={styles.infoBody}>
        No microphone, contacts, background services, or other device permissions
        are requested.
      </p>
    </div>
  </ScreenShell>
);

// ─── Data Usage ───────────────────────────────────────────────────────────────

export const DataUsageScreen = ({ embedded }: EmbedProps) => (
  <ScreenShell title="Data Usage" embedded={embedded}>
    <div className={styles.infoCard}>
      <p className={styles.infoTitle}>What we store</p>
      <p className={styles.infoBody}>
        Your account, closets, clothing articles, outfit history, and style
        preferences are stored in our secure cloud database (MongoDB Atlas).
      </p>
    </div>
    <div className={styles.infoCard}>
      <p className={styles.infoTitle}>What we don't do</p>
      <p className={styles.infoBody}>
        We don't sell your data, use it for advertising, or share it with third
        parties beyond what's needed to run the app.
      </p>
    </div>
    <div className={styles.infoCard}>
      <p className={styles.infoTitle}>Delete your data</p>
      <p className={styles.infoBody}>
        You can permanently remove your account and all data from Account → Profile → Delete Account.
      </p>
    </div>
  </ScreenShell>
);

// ─── History ──────────────────────────────────────────────────────────────────

export const HistoryScreen = ({ embedded }: EmbedProps) => {
  const [entries,      setEntries]      = useState<OutfitHistoryEntry[]>([]);
  const [confirmClear, setConfirmClear] = useState(false);

  useEffect(() => { setEntries(loadHistory()); }, []);

  const handleDelete = (id: string) => {
    deleteHistoryEntry(id);
    setEntries(prev => prev.filter(e => e.id !== id));
  };

  const handleClearAll = () => {
    clearHistory();
    setEntries([]);
    setConfirmClear(false);
  };

  const formatDate = (iso: string): string => {
    const d = new Date(iso);
    const today = new Date();
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
        <div className={styles.infoCard}>
          <p className={styles.infoTitle}>No outfits logged yet</p>
          <p className={styles.infoBody}>
            Tap <strong>Wore this today</strong> on the home screen after getting a suggestion.
          </p>
        </div>
      ) : (
        <>
          {confirmClear ? (
            <div className={styles.confirmRow}>
              <span className={styles.confirmText}>Clear all {entries.length} entries?</span>
              <button className={styles.confirmYes} onClick={handleClearAll}>Yes, clear</button>
              <button className={styles.confirmNo}  onClick={() => setConfirmClear(false)}>Cancel</button>
            </div>
          ) : (
            <button className={styles.clearAllBtn} onClick={() => setConfirmClear(true)}>Clear all</button>
          )}

          <div className={styles.historyList}>
            {entries.map(entry => (
              <div key={entry.id} className={styles.historyCard}>
                <div className={styles.historyMeta}>
                  <span className={styles.historyDate}>{formatDate(entry.wornAt)}</span>
                  <span className={styles.historyCloset}>{entry.closetName}</span>
                </div>
                <p className={styles.historySummary}>{entry.articleSummary}</p>
                <button className={styles.historyDeleteBtn}
                  onClick={() => handleDelete(entry.id)} aria-label="Remove entry">
                  <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                    <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                </button>
              </div>
            ))}
          </div>

          <p className={styles.hint}>
            Outfits from the last 3 days are deprioritised in new suggestions.
          </p>
        </>
      )}
    </ScreenShell>
  );
};
