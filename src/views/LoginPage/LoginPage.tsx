import { useState, useMemo, useEffect } from 'react';
import { StyleSheet } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import { View, Text, Pressable, GlassCard } from '../../components/primitives';
import {
    AuthScaffold,
    AuthField,
    AuthStatus,
    AuthButton,
    makeAuthStyles,
} from '../../components/auth';
import OjoLogoIcon from '../../components/icons/OjoLogoIcon';
import axios from '../../api/client';
import { AuthState, Settings } from '../../types';
import { getAuthErrorMessage, saveAuth } from '../../lib/auth';
import { isAppleSignInAvailable, signInWithApple } from '../../lib/appleSignIn';
import { isGoogleSignInAvailable, signInWithGoogle } from '../../lib/googleSignIn';
import GoogleGlyph from '../../components/icons/GoogleGlyph';
import { useAppNavigation } from '../../hooks/useAppNavigation';
import { spacing, radius, fonts, fontSizes } from '../../theme/tokens';
import { useTheme } from '../../theme/ThemeContext';
import LegalConsentNotice from '../../components/LegalConsentNotice';

interface Props {
    onLogin?: () => void;
}

export default function LoginPage({ onLogin }: Props) {
    const { colors, isDark } = useTheme();
    const styles = useMemo(() => makeAuthStyles(colors), [colors]);
    const local = useMemo(
        () =>
            StyleSheet.create({
                logo: { width: 120, height: 48, marginBottom: spacing.sm },
                tagline: {
                    fontFamily: fonts.body,
                    fontSize: fontSizes.base,
                    color: colors.textSecondary,
                    marginBottom: spacing.sm,
                },
                forgotRow: {
                    width: '100%',
                    alignItems: 'flex-end',
                    marginTop: -spacing.xs,
                },
            }),
        [colors],
    );

    const nav = useAppNavigation();
    const [identifier, setIdentifier] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [appleAvailable, setAppleAvailable] = useState(false);
    const [appleLoading, setAppleLoading] = useState(false);
    const [googleAvailable] = useState(() => isGoogleSignInAvailable());
    const [googleLoading, setGoogleLoading] = useState(false);

    useEffect(() => {
        let mounted = true;
        isAppleSignInAvailable().then((ok) => {
            if (mounted) setAppleAvailable(ok);
        });
        return () => {
            mounted = false;
        };
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

    const handleGoogle = async () => {
        if (googleLoading) return;
        setError(null);
        setGoogleLoading(true);
        const result = await signInWithGoogle();
        setGoogleLoading(false);
        if (result.ok) {
            onLogin?.();
            return;
        }
        if (result.cancelled) return;
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
            const { data } = await axios.post<AuthState & { settings: Settings }>(
                '/api/auth/login',
                { identifier, password },
            );
            await saveAuth(data.token, data.user);
            onLogin?.();
        } catch (err: unknown) {
            setError(getAuthErrorMessage(err));
        } finally {
            setLoading(false);
        }
    };

    return (
        <AuthScaffold centered>
            <GlassCard style={[styles.card, styles.cardCentered]}>
                <OjoLogoIcon width={local.logo.width} height={local.logo.height} />
                <Text style={local.tagline}>Dress for the weather.</Text>

                {error ? <AuthStatus message={error} /> : null}

                <AuthField
                    label="Email or username"
                    placeholder="you@example.com or @janedoe"
                    value={identifier}
                    onChangeText={setIdentifier}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    textContentType="emailAddress"
                    returnKeyType="next"
                />
                <AuthField
                    label="Password"
                    placeholder="••••••••"
                    secureToggle
                    textContentType="password"
                    value={password}
                    onChangeText={setPassword}
                    returnKeyType="done"
                    onSubmitEditing={handleSubmit}
                />

                <View style={local.forgotRow}>
                    <Pressable
                        onPress={() => nav.push('/(auth)/forgot-password')}
                        accessibilityRole="link"
                        accessibilityLabel="Forgot password"
                    >
                        <Text style={styles.linkMuted}>Forgot password?</Text>
                    </Pressable>
                </View>

                <AuthButton
                    label="Sign in"
                    loadingLabel="Signing in…"
                    loading={loading}
                    onPress={handleSubmit}
                />

                {(appleAvailable || googleAvailable) && (
                    <View style={styles.dividerRow}>
                        <View style={styles.dividerLine} />
                        <Text style={styles.dividerText}>or</Text>
                        <View style={styles.dividerLine} />
                    </View>
                )}

                {appleAvailable && (
                    <AppleAuthentication.AppleAuthenticationButton
                        buttonType={
                            AppleAuthentication.AppleAuthenticationButtonType
                                .SIGN_IN
                        }
                        buttonStyle={
                            isDark
                                ? AppleAuthentication
                                      .AppleAuthenticationButtonStyle.WHITE
                                : AppleAuthentication
                                      .AppleAuthenticationButtonStyle.BLACK
                        }
                        cornerRadius={radius.sm}
                        style={[
                            styles.appleBtn,
                            appleLoading && { opacity: 0.5 },
                        ]}
                        onPress={handleApple}
                    />
                )}

                {googleAvailable && (
                    <Pressable
                        onPress={handleGoogle}
                        accessibilityRole="button"
                        accessibilityLabel="Sign in with Google"
                        style={[
                            styles.googleBtn,
                            { backgroundColor: isDark ? '#FFFFFF' : '#000000' },
                            googleLoading && { opacity: 0.5 },
                        ]}
                    >
                        <GoogleGlyph size={20} />
                        <Text style={[styles.googleBtnText, { color: isDark ? '#000000' : '#FFFFFF' }]}>
                            Sign in with Google
                        </Text>
                    </Pressable>
                )}

                <View style={styles.footer}>
                    <Text style={styles.footerText}>Don't have an account? </Text>
                    <Pressable
                        onPress={() => nav.push('/(auth)/signup')}
                        accessibilityRole="link"
                    >
                        <Text style={styles.link}>Sign up</Text>
                    </Pressable>
                </View>

                <LegalConsentNotice prefix="By continuing" />
            </GlassCard>
        </AuthScaffold>
    );
}
