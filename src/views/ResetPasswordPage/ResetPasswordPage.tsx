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
        inputRow: {
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: colors.glassBg,
          borderWidth: 1,
          borderColor: colors.glassBorder,
          borderRadius: radius.sm,
        },
        input: {
          flex: 1,
          paddingVertical: 12,
          paddingHorizontal: spacing.md,
          color: colors.textPrimary,
          fontFamily: fonts.body,
          fontSize: fontSizes.base,
        },
        inputSuffix: {
          paddingHorizontal: spacing.sm,
          paddingVertical: 12,
        },
        inputSuffixText: {
          fontFamily: fonts.body,
          fontSize: fontSizes.sm,
          color: colors.textMuted,
        },
        expiredBox: {
          padding: spacing.sm,
          backgroundColor: colors.errorBg,
          borderRadius: radius.sm,
          borderWidth: 1,
          borderColor: colors.errorBorder,
          gap: 8,
        },
        expiredText: {
          fontFamily: fonts.body,
          fontSize: fontSizes.sm,
          color: colors.errorText,
        },
        expiredLink: {
          fontFamily: fonts.body,
          fontSize: fontSizes.sm,
          color: colors.textPrimary,
          textDecorationLine: 'underline' as const,
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
  const [showPassword, setShowPassword]       = useState(false);
  const [showConfirm, setShowConfirm]         = useState(false);
  const [error, setError]                     = useState<string | null>(null);
  const [tokenExpired, setTokenExpired]       = useState(false);
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
      const status = (err as any)?.response?.status;
      if (status === 401 || status === 410) {
        setTokenExpired(true);
        setError(null);
      } else {
        setError(getErrorMessage(err, 'Could not reset password. Try again.'));
      }
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

            {tokenExpired ? (
              <View style={styles.expiredBox} accessibilityLiveRegion="assertive">
                <Text style={styles.expiredText}>
                  This reset link has expired.
                </Text>
                <Pressable
                  onPress={() => nav.replace('/(auth)/forgot-password')}
                  accessibilityRole="link"
                  accessibilityLabel="Request a new link"
                >
                  <Text style={styles.expiredLink}>Request a new link →</Text>
                </Pressable>
              </View>
            ) : error ? (
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
              <View style={styles.inputRow}>
                <TextInput
                  style={styles.input}
                  placeholder="8+ characters"
                  placeholderTextColor={colors.textMuted}
                  secureTextEntry={!showPassword}
                  textContentType="newPassword"
                  value={password}
                  onChangeText={setPassword}
                  returnKeyType="next"
                  accessibilityLabel="New password"
                />
                <Pressable
                  style={styles.inputSuffix}
                  onPress={() => setShowPassword(s => !s)}
                  accessibilityRole="button"
                  accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
                >
                  <Text style={styles.inputSuffixText}>{showPassword ? 'Hide' : 'Show'}</Text>
                </Pressable>
              </View>
            </View>

            <View style={{ gap: 6 }}>
              <Text style={styles.label}>Confirm new password</Text>
              <View style={styles.inputRow}>
                <TextInput
                  style={styles.input}
                  placeholder="Re-enter password"
                  placeholderTextColor={colors.textMuted}
                  secureTextEntry={!showConfirm}
                  textContentType="newPassword"
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  returnKeyType="done"
                  onSubmitEditing={handleSubmit}
                  accessibilityLabel="Confirm new password"
                />
                <Pressable
                  style={styles.inputSuffix}
                  onPress={() => setShowConfirm(s => !s)}
                  accessibilityRole="button"
                  accessibilityLabel={showConfirm ? 'Hide confirm password' : 'Show confirm password'}
                >
                  <Text style={styles.inputSuffixText}>{showConfirm ? 'Hide' : 'Show'}</Text>
                </Pressable>
              </View>
            </View>

            <Pressable
              style={[styles.btn, (loading || tokenExpired) && { opacity: 0.5 }]}
              onPress={handleSubmit}
              disabled={loading || tokenExpired}
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
