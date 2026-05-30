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
import { getErrorMessage } from '../../lib/auth';
import { useAppNavigation } from '../../hooks/useAppNavigation';
import { useTheme } from '../../theme/ThemeContext';
import { fonts, fontSizes, fontWeights, radius, spacing } from '../../theme/tokens';

export default function ForgotPasswordPage() {
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
        successBox: {
          padding: spacing.sm,
          backgroundColor: colors.successBg,
          borderRadius: radius.sm,
          borderWidth: 1,
          borderColor: colors.successBorder,
        },
        successText: {
          fontFamily: fonts.body,
          fontSize: fontSizes.sm,
          color: colors.successText,
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

  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setError(null);
    if (!email.trim()) {
      setError('Please enter your email.');
      return;
    }
    setLoading(true);
    try {
      await axios.post('/api/auth/forgot-password', { email: email.trim() });
      setSubmitted(true);
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Could not send reset link. Try again.'));
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
            <Text style={styles.title}>Reset password</Text>

            {submitted ? (
              <>
                <View
                  style={styles.successBox}
                  accessible
                  accessibilityLiveRegion="polite"
                >
                  <Text style={styles.successText}>
                    If an account exists for that email, we've sent a link to reset your password. Check your inbox.
                  </Text>
                </View>
                <Pressable
                  onPress={() => nav.goBack()}
                  accessibilityRole="link"
                  accessibilityLabel="Back to sign in"
                >
                  <Text style={styles.link}>Back to sign in</Text>
                </Pressable>
              </>
            ) : (
              <>
                <Text style={styles.body}>
                  Enter the email you used to sign up. We'll send a link to reset your password.
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
                  <Text style={styles.label}>Email</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="you@example.com"
                    placeholderTextColor={colors.textMuted}
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    textContentType="emailAddress"
                    returnKeyType="send"
                    onSubmitEditing={handleSubmit}
                    accessibilityLabel="Email"
                  />
                </View>

                <Pressable
                  style={[styles.btn, loading && { opacity: 0.5 }]}
                  onPress={handleSubmit}
                  disabled={loading}
                  accessibilityRole="button"
                  accessibilityLabel={loading ? 'Sending reset link' : 'Send reset link'}
                  accessibilityState={{ busy: loading, disabled: loading }}
                >
                  <Text style={styles.btnText}>
                    {loading ? 'Sending…' : 'Send reset link'}
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() => nav.goBack()}
                  accessibilityRole="link"
                  accessibilityLabel="Back to sign in"
                >
                  <Text style={styles.link}>Back to sign in</Text>
                </Pressable>
              </>
            )}
          </GlassCard>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
