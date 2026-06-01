import { useState, useMemo, useEffect } from 'react';
import {
    StyleSheet,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as AppleAuthentication from 'expo-apple-authentication';
import { View, Text, TextInput, Pressable, GlassCard } from '../../components/primitives';
import OjoLogoIcon from '../../components/icons/OjoLogoIcon';
import axios from '../../api/client';
import { AuthState, Settings } from '../../types';
import { getErrorMessage, saveAuth } from '../../lib/auth';
import { isAppleSignInAvailable, signInWithApple } from '../../lib/appleSignIn';
import { useAppNavigation } from '../../hooks/useAppNavigation';
import { spacing, radius, fonts, fontSizes, fontWeights } from '../../theme/tokens';
import { useTheme } from '../../theme/ThemeContext';

interface Props {
    onLogin?: () => void;
}

export default function LoginPage({ onLogin }: Props) {
    const { colors } = useTheme();
    const styles = useMemo(() => StyleSheet.create({
        root: { flex: 1, backgroundColor: colors.bgDefault },
        content: { flexGrow: 1, justifyContent: 'center', padding: spacing.md },
        card: {
            backgroundColor: colors.glassBg,
            borderRadius: radius.lg,
            borderWidth: 1,
            borderColor: colors.glassBorder,
            padding: spacing.lg,
            gap: spacing.md,
            alignItems: 'center',
        },
        logo: { width: 120, height: 48, marginBottom: spacing.sm },
        tagline: {
            fontFamily: fonts.body,
            fontSize: fontSizes.base,
            color: colors.textSecondary,
            marginBottom: spacing.sm,
        },
        errorBox: {
            width: '100%',
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
        fields: { width: '100%', gap: spacing.sm },
        field: { gap: 6 },
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
            width: '100%',
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
        footer: { flexDirection: 'row', alignItems: 'center' },
        footerText: {
            fontFamily: fonts.body,
            fontSize: fontSizes.sm,
            color: colors.textSecondary,
        },
        link: {
            fontFamily: fonts.body,
            fontSize: fontSizes.sm,
            color: colors.textPrimary,
            textDecorationLine: 'underline',
        },
        forgotRow: { width: '100%', alignItems: 'flex-end', marginTop: -spacing.xs },
        forgotLink: {
            fontFamily: fonts.body,
            fontSize: fontSizes.sm,
            color: colors.textSecondary,
            textDecorationLine: 'underline',
        },
        dividerRow: {
            flexDirection: 'row',
            alignItems: 'center',
            width: '100%',
            gap: spacing.sm,
            marginVertical: spacing.xs,
        },
        dividerLine: {
            flex: 1,
            height: StyleSheet.hairlineWidth,
            backgroundColor: colors.glassBorder,
        },
        dividerText: {
            fontFamily: fonts.body,
            fontSize: fontSizes.xs,
            color: colors.textMuted,
            textTransform: 'uppercase',
            letterSpacing: 1,
        },
        appleBtn: {
            width: '100%',
            height: 48,
        },
    }), [colors]);

    const nav = useAppNavigation();
    const [identifier, setIdentifier] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [appleAvailable, setAppleAvailable] = useState(false);
    const [appleLoading, setAppleLoading] = useState(false);

    useEffect(() => {
        let mounted = true;
        isAppleSignInAvailable().then((ok) => {
            if (mounted) setAppleAvailable(ok);
        });
        return () => { mounted = false; };
    }, []);

    const handleApple = async () => {
        if (appleLoading) return;
        setError(null);
        setAppleLoading(true);
        const result = await signInWithApple();
        setAppleLoading(false);
        if (result.ok) {
            onLogin?.();
            return;
        }
        if (result.cancelled) return; // silent — user dismissed the sheet
        setError(result.error);
    };

    const handleSubmit = async () => {
        setError(null);
        if (!identifier || !password) {
            setError('Please enter your email or username, and password.');
            return;
        }
        setLoading(true);
        try {
            const { data } = await axios.post<
                AuthState & { settings: Settings }
            >('/api/auth/login', { identifier, password });
            await saveAuth(data.token, data.user);
            onLogin?.();
        } catch (err: unknown) {
            setError(getErrorMessage(err, 'Login failed. Please try again.'));
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
                    keyboardShouldPersistTaps='handled'
                >
                    <GlassCard style={styles.card}>
                        <OjoLogoIcon width={styles.logo.width} height={styles.logo.height} />
                        <Text style={styles.tagline}>
                            Dress for the weather.
                        </Text>

                        {error ? (
                            <View
                                style={styles.errorBox}
                                accessibilityLiveRegion="assertive"
                                accessible={true}
                                accessibilityLabel={error}
                            >
                                <Text style={styles.errorText}>{error}</Text>
                            </View>
                        ) : null}

                        <View style={styles.fields}>
                            <View style={styles.field}>
                                <Text style={styles.label}>
                                    Email or username
                                </Text>
                                <TextInput
                                    style={styles.input}
                                    placeholder='you@example.com or @janedoe'
                                    placeholderTextColor={colors.textMuted}
                                    value={identifier}
                                    onChangeText={setIdentifier}
                                    keyboardType='email-address'
                                    autoCapitalize='none'
                                    textContentType='emailAddress'
                                    returnKeyType='next'
                                    accessibilityLabel="Email or username"
                                />
                            </View>
                            <View style={styles.field}>
                                <Text style={styles.label}>Password</Text>
                                <TextInput
                                    style={styles.input}
                                    placeholder='••••••••'
                                    placeholderTextColor={colors.textMuted}
                                    secureTextEntry
                                    textContentType='password'
                                    value={password}
                                    onChangeText={setPassword}
                                    returnKeyType='done'
                                    onSubmitEditing={handleSubmit}
                                    accessibilityLabel="Password"
                                />
                            </View>
                        </View>

                        <View style={styles.forgotRow}>
                            <Pressable
                                onPress={() => nav.push('/(auth)/forgot-password')}
                                accessibilityRole="link"
                                accessibilityLabel="Forgot password"
                            >
                                <Text style={styles.forgotLink}>Forgot password?</Text>
                            </Pressable>
                        </View>

                        <Pressable
                            style={[styles.btn, loading && { opacity: 0.5 }]}
                            onPress={handleSubmit}
                            disabled={loading}
                            accessibilityRole="button"
                            accessibilityLabel={loading ? 'Signing in' : 'Sign in'}
                            accessibilityState={{ busy: loading, disabled: loading }}
                        >
                            <Text style={styles.btnText}>
                                {loading ? 'Signing in…' : 'Sign in'}
                            </Text>
                        </Pressable>

                        {appleAvailable && (
                            <>
                                <View style={styles.dividerRow}>
                                    <View style={styles.dividerLine} />
                                    <Text style={styles.dividerText}>or</Text>
                                    <View style={styles.dividerLine} />
                                </View>
                                <AppleAuthentication.AppleAuthenticationButton
                                    buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
                                    buttonStyle={
                                        colors.bgDefault.toLowerCase() === '#f1f5f9'
                                            ? AppleAuthentication.AppleAuthenticationButtonStyle.BLACK
                                            : AppleAuthentication.AppleAuthenticationButtonStyle.WHITE
                                    }
                                    cornerRadius={radius.sm}
                                    style={[styles.appleBtn, appleLoading && { opacity: 0.5 }]}
                                    onPress={handleApple}
                                />
                            </>
                        )}

                        <View style={styles.footer}>
                            <Text style={styles.footerText}>
                                Don't have an account?{' '}
                            </Text>
                            <Pressable
                                onPress={() => nav.push('/(auth)/signup')}
                                accessibilityRole="link"
                            >
                                <Text style={styles.link}>Sign up</Text>
                            </Pressable>
                        </View>
                    </GlassCard>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}
