/**
 * ConfirmDialog — one themed, promise-based confirmation dialog for the whole
 * app, replacing scattered native `Alert.alert` destructive confirms (which
 * can't be themed and break the glass aesthetic).
 *
 * Usage:
 *   const confirm = useConfirm();
 *   const ok = await confirm({
 *     title: 'Delete closet?',
 *     message: 'This also deletes all articles inside.',
 *     confirmLabel: 'Delete',
 *     destructive: true,
 *   });
 *   if (!ok) return;
 *
 * A destructive request fires a warning haptic as the sheet appears.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Modal, StyleSheet } from 'react-native';
import { View, Text, Pressable, GlassCard } from './primitives';
import { useTheme } from '../theme/ThemeContext';
import { ColorTokens, spacing, radius, fonts, fontSizes, fontWeights } from '../theme/tokens';
import { hapticWarning } from '../lib/haptics';

export interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Styles the confirm button as danger and fires a warning haptic on open. */
  destructive?: boolean;
}

type ConfirmFn = (opts: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn>(async () => false);

export const useConfirm = (): ConfirmFn => useContext(ConfirmContext);

export const ConfirmProvider = ({ children }: { children: React.ReactNode }) => {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [opts, setOpts] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((v: boolean) => void) | null>(null);

  const confirm = useCallback<ConfirmFn>((o) => {
    if (o.destructive) hapticWarning();
    setOpts(o);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const close = useCallback((result: boolean) => {
    resolver.current?.(result);
    resolver.current = null;
    setOpts(null);
  }, []);

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Modal
        visible={!!opts}
        transparent
        animationType="fade"
        onRequestClose={() => close(false)}
      >
        <Pressable
          style={styles.backdrop}
          onPress={() => close(false)}
          accessibilityLabel="Dismiss"
          accessibilityRole="button"
        />
        {opts && (
          <GlassCard style={styles.card}>
            <Text style={styles.title}>{opts.title}</Text>
            {opts.message ? <Text style={styles.body}>{opts.message}</Text> : null}
            <View style={styles.actions}>
              <Pressable
                style={styles.cancelBtn}
                onPress={() => close(false)}
                accessibilityRole="button"
                accessibilityLabel={opts.cancelLabel ?? 'Cancel'}
              >
                <Text style={styles.cancelText}>{opts.cancelLabel ?? 'Cancel'}</Text>
              </Pressable>
              <Pressable
                style={[styles.confirmBtn, opts.destructive && styles.confirmBtnDanger]}
                onPress={() => close(true)}
                accessibilityRole="button"
                accessibilityLabel={opts.confirmLabel ?? 'Confirm'}
              >
                <Text
                  style={[styles.confirmText, opts.destructive && styles.confirmTextDanger]}
                >
                  {opts.confirmLabel ?? 'Confirm'}
                </Text>
              </Pressable>
            </View>
          </GlassCard>
        )}
      </Modal>
    </ConfirmContext.Provider>
  );
};

const makeStyles = (colors: ColorTokens) =>
  StyleSheet.create({
    backdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0,0,0,0.55)',
    },
    card: {
      position: 'absolute',
      left: 24,
      right: 24,
      top: '35%',
      backgroundColor: colors.glassBgStrong,
      borderRadius: radius.lg,
      padding: spacing.lg,
      gap: 12,
      borderWidth: 1,
      borderColor: colors.glassBorder,
    },
    title: {
      fontFamily: fonts.body,
      fontSize: 17,
      fontWeight: fontWeights.semibold,
      color: colors.textPrimary,
    },
    body: {
      fontFamily: fonts.body,
      fontSize: 14,
      color: colors.textSecondary,
      lineHeight: 14 * 1.6,
    },
    actions: { flexDirection: 'row', gap: 10, marginTop: 4 },
    cancelBtn: {
      flex: 1,
      paddingVertical: 12,
      paddingHorizontal: spacing.md,
      backgroundColor: colors.glassBg,
      borderWidth: 1,
      borderColor: colors.glassBorder,
      borderRadius: radius.sm,
      alignItems: 'center',
    },
    cancelText: {
      fontFamily: fonts.body,
      fontSize: fontSizes.base - 1,
      fontWeight: fontWeights.medium,
      color: colors.textSecondary,
    },
    confirmBtn: {
      flex: 1,
      paddingVertical: 12,
      paddingHorizontal: spacing.md,
      backgroundColor: colors.saveBtnBg,
      borderWidth: 1,
      borderColor: colors.saveBtnBg,
      borderRadius: radius.sm,
      alignItems: 'center',
    },
    confirmText: {
      fontFamily: fonts.body,
      fontSize: fontSizes.base - 1,
      fontWeight: fontWeights.semibold,
      color: colors.saveBtnText,
    },
    confirmBtnDanger: {
      backgroundColor: 'rgba(239, 68, 68, 0.15)',
      borderColor: 'rgba(239, 68, 68, 0.35)',
    },
    confirmTextDanger: {
      color: colors.dangerTextHi,
    },
  });
