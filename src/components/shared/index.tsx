import React from 'react';

// ─── StatusMessage ─────────────────────────────────────────────────────────────
// Replaces the identical inline status <p> in every AccountPage tab.

interface StatusMessageProps {
  status: { type: 'success' | 'error'; msg: string } | null;
  styles: Record<string, string>;
}

export const StatusMessage = ({ status, styles }: StatusMessageProps) => {
  if (!status) return null;
  return (
    <p className={`${styles.statusMsg} ${styles[status.type]}`}>
      {status.msg}
    </p>
  );
};

// ─── EmptyState ────────────────────────────────────────────────────────────────
// Shared empty / prompt state used in OutfitSuggestion and ClosetView.

interface EmptyStateProps {
  icon:    React.ReactNode;
  title:   string;
  body:    string;
  action?: React.ReactNode;
  styles:  Record<string, string>;
}

export const EmptyState = ({ icon, title, body, action, styles }: EmptyStateProps) => (
  <div className={styles.promptState}>
    <span className={styles.promptIcon}>{icon}</span>
    <p className={styles.promptTitle}>{title}</p>
    <p className={styles.promptBody}>{body}</p>
    {action}
  </div>
);
