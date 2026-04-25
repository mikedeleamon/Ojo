import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing, radius, fonts, fontSizes } from '../../theme/tokens';

// ─── StatusMessage ─────────────────────────────────────────────────────────────

interface StatusMessageProps {
  status: { type: 'success' | 'error'; msg: string } | null;
}

export const StatusMessage = ({ status }: StatusMessageProps) => {
  if (!status) return null;
  const isSuccess = status.type === 'success';
  return (
    <View style={[styles.base, isSuccess ? styles.success : styles.error]}>
      <Text style={[styles.text, isSuccess ? styles.successText : styles.errorText]}>
        {status.msg}
      </Text>
    </View>
  );
};

// ─── EmptyState ────────────────────────────────────────────────────────────────

interface EmptyStateProps {
  icon:    React.ReactNode;
  title:   string;
  body:    string;
  action?: React.ReactNode;
}

export const EmptyState = ({ icon, title, body, action }: EmptyStateProps) => (
  <View style={styles.emptyContainer}>
    <View style={styles.emptyIcon}>{icon}</View>
    <Text style={styles.emptyTitle}>{title}</Text>
    <Text style={styles.emptyBody}>{body}</Text>
    {action}
  </View>
);

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // StatusMessage
  base: {
    paddingVertical:   10,
    paddingHorizontal: spacing.md,
    borderRadius:      radius.sm,
    borderWidth:       1,
    marginBottom:      8,
  },
  text: {
    fontFamily: fonts.body,
    fontSize:   fontSizes.sm,
  },
  success: {
    backgroundColor: colors.successBg,
    borderColor:     colors.successBorder,
  },
  successText: {
    color: colors.successText,
  },
  error: {
    backgroundColor: colors.errorBg,
    borderColor:     colors.errorBorder,
  },
  errorText: {
    color: colors.errorText,
  },

  // EmptyState
  emptyContainer: {
    flex:           1,
    alignItems:     'center',
    justifyContent: 'center',
    padding:        spacing.xl,
    gap:            spacing.sm,
  },
  emptyIcon: {
    marginBottom: spacing.sm,
  },
  emptyTitle: {
    fontFamily: fonts.display,
    fontSize:   fontSizes.xl,
    color:      colors.textPrimary,
    textAlign:  'center',
  },
  emptyBody: {
    fontFamily: fonts.body,
    fontSize:   fontSizes.base,
    color:      colors.textSecondary,
    textAlign:  'center',
    lineHeight: fontSizes.base * 1.6,
  },
});
