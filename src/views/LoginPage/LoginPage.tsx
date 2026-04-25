import { useState } from 'react';
import {
    StyleSheet,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { View, Text, TextInput, Pressable } from '../../components/primitives';
import axios from '../../api/client';
import { AuthState, Settings } from '../../types';
import { getErrorMessage, saveAuth } from '../../lib/auth';
import { useAppNavigation } from '../../hooks/useAppNavigation';
import {
    colors,
    spacing,
    radius,
    fonts,
    fontSizes,
    fontWeights,
} from '../../theme/tokens';

interface Props {
    onLogin?: () => void;
}

export default function LoginPage({ onLogin }: Props) {
    const nav = useAppNavigation();
    const [identifier, setIdentifier] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

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
                    <View style={styles.card}>
                        <Image
                            source={require('../../assets/images/logos/ojoLogo.png')}
                            style={styles.logo}
                            resizeMode='contain'
                        />
                        <Text style={styles.tagline}>
                            Dress for the weather.
                        </Text>

                        {error ? (
                            <View style={styles.errorBox}>
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
                                />
                            </View>
                        </View>

                        <Pressable
                            style={[styles.btn, loading && { opacity: 0.5 }]}
                            onPress={handleSubmit}
                            disabled={loading}
                        >
                            <Text style={styles.btnText}>
                                {loading ? 'Signing in…' : 'Sign in'}
                            </Text>
                        </Pressable>

                        <View style={styles.footer}>
                            <Text style={styles.footerText}>
                                Don't have an account?{' '}
                            </Text>
                            <Pressable onPress={() => nav.push('Signup')}>
                                <Text style={styles.link}>Sign up</Text>
                            </Pressable>
                        </View>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
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
});
