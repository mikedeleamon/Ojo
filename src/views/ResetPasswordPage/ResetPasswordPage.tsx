import { useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GlassCard, Pressable, Text, TextInput, View } from '../../components/primitives';
import axios from '../../api/client';
import { AuthState, Settings } from '../../types';
import { getErrorMessage, saveAuth } from '../../lib/auth';
import { useAppNavigation } from '../../hooks/useAppNavigation';
import { useTheme } from '../../theme/ThemeContext';
import { fonts, fontSizes, fontWeights, radius, spacing } from '../../theme/tokens';

interface Props {
  /** Reset token from the email deep link (?token=...) */
  token: string;
  /** Called after successful reset + auto sign-in */
  onLogin?: () => void;
}

export default function ResetPasswordPage({ token, onLogin }: Props) {
  const { colors } = useTheme();
  const nav = useAppNavigation();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        root: { flex: 1, backgroundColor: colors.bgDefault },
        content: { flexGrow: 1, justifyContent: 'center', padding: spacing.md },
        card: {
          backgroundColor: colors.glassBg,
          borderRadius: radius.lg,
          borderWidth: 1,
          borderColor: colors.glassBorder,
          padding: spacing.lg,
          gap: spacing.md,
        },
        title: {
          fontFamily: 'DMSerifDisplay',
          fontSize: 28,
          color: colors.textPrimary,
          letterSpacing: -0.02 * 28,
        },
        body: {
          fontFamily: fonts.body,
          fontSize: fontSizes.base,
          color: colors.textSecondary,
        },
        label: {
          fontFamily: fonts.body,
          fontSize: fontSizes.xs,
          fontWeight: fontWeights.medium,
          letterSpacing: 0.1 * fontSizes.xs,
          textTransform: 'uppercase',
          color: colors.textMuted,
        },
        input: {
          paddingVertical: 12,
          paddingHorizontal: spacing.md,
          backgroundColor: colors.glassBg,
          borderWidth: 1,
          borderColor: colors.glassBorder,
          borderRadius: radius.sm,
          color: colors.textPrimary,
          fontFamily: fonts.body,
          fontSize: fontSizes.base,
        },
        btn: {
          paddingVertical: 14,
          backgroundColor: colors.saveBtnBg,
          borderRadius: radius.sm,
          alignItems: 'center',
        },
        btnText: {
          fontFamily: fonts.body,
          fontSize: fontSizes.base,
          fontWeight: fontWeights.semibold,
          color: colors.saveBtnText,
        },
        errorBox: {
          padding: spacing.sm,
          backgroundColor: colors.errorBg,
          borderRadius: radius.sm,
          borderWidth: 1,
          borderColor: colors.errorBorder,
        },
        errorText: {
          fontFamily: fonts.body,
          fontSize: fontSizes.sm,
          color: colors.errorText,
        },
        link: {
          fontFamily: fonts.body,
          fontSize: fontSizes.sm,
          color: colors.textPrimary,
          textDecorationLine: 'underline',
          textAlign: 'center',
        },
      }),
    [colors],
  );

  const [password, setPassword]               = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError]                     = useState<string | null>(null);
  const [loading, setLoading]                 = useState(false);

  const handleSubmit = async () => {
    setError(null);
    if (!token) {
      setError('Reset link is missing or invalid. Request a new one.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setLoading(true);
    try {
      const { data } = await axios.post<AuthState & { settings: Settings }>(
        '/api/auth/reset-password',
        { token, newPassword: password },
      );
      await saveAuth(data.token, data.user);
      onLogin?.();
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Could not reset password. Try again.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.root}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <GlassCard style={styles.card}>
            <Text style={styles.title}>Choose a new password</Text>
            <Text style={styles.body}>
              Pick a password you haven't used on Ojo before. It must be at
              least 8 characters.
            </Text>

            {error ? (
              <View
                style={styles.errorBox}
                accessibilityLiveRegion="assertive"
                accessible
                accessibilityLabel={error}
              >
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <View style={{ gap: 6 }}>
              <Text style={styles.label}>New password</Text>
              <TextInput
                style={styles.input}
                placeholder="8+ characters"
                placeholderTextColor={colors.textMuted}
                secureTextEntry
                textContentType="newPassword"
                value={password}
                onChangeText={setPassword}
                returnKeyType="next"
                accessibilityLabel="New password"
              />
            </View>

            <View style={{ gap: 6 }}>
              <Text style={styles.label}>Confirm new password</Text>
              <TextInput
                style={styles.input}
                placeholder="Re-enter password"
                placeholderTextColor={colors.textMuted}
                secureTextEntry
                textContentType="newPassword"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                returnKeyType="done"
                onSubmitEditing={handleSubmit}
                accessibilityLabel="Confirm new password"
              />
            </View>

            <Pressable
              style={[styles.btn, loading && { opacity: 0.5 }]}
              onPress={handleSubmit}
              disabled={loading}
              accessibilityRole="button"
              accessibilityLabel={loading ? 'Updating password' : 'Update password'}
              accessibilityState={{ busy: loading, disabled: loading }}
            >
              <Text style={styles.btnText}>
                {loading ? 'Updating…' : 'Update password'}
              </Text>
            </Pressable>

            <Pressable
              onPress={() => nav.replace('/(auth)/login')}
              accessibilityRole="link"
              accessibilityLabel="Back to sign in"
            >
              <Text style={styles.link}>Back to sign in</Text>
            </Pressable>
          </GlassCard>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
