import { useState } from 'react';
import {
    StyleSheet,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
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

interface FormState {
    firstName: string;
    lastName: string;
    username: string;
    email: string;
    password: string;
    confirmPassword: string;
    birthday: string;
}

interface Props {
    onLogin?: () => void;
}

export default function SignupPage({ onLogin }: Props) {
    const nav = useAppNavigation();
    const [form, setForm] = useState<FormState>({
        firstName: '',
        lastName: '',
        username: '',
        email: '',
        password: '',
        confirmPassword: '',
        birthday: '',
    });
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const set = (key: keyof FormState) => (val: string) =>
        setForm((f) => ({ ...f, [key]: val }));

    const handleSubmit = async () => {
        setError(null);
        if (
            !form.firstName ||
            !form.lastName ||
            !form.email ||
            !form.password ||
            !form.birthday
        ) {
            setError('All fields are required.');
            return;
        }
        if (form.password.length < 8) {
            setError('Password must be at least 8 characters.');
            return;
        }
        setLoading(true);
        try {
            const { data } = await axios.post<
                AuthState & { settings: Settings }
            >('/api/auth/signup', form);
            await saveAuth(data.token, data.user);
            onLogin?.();
            nav.replace('Onboarding');
        } catch (err: unknown) {
            setError(getErrorMessage(err, 'Sign up failed. Please try again.'));
        } finally {
            setLoading(false);
        }
    };

    const fields: {
        label: string;
        key: keyof FormState;
        placeholder: string;
        type?: 'email' | 'password' | 'date';
    }[] = [
        { label: 'First name', key: 'firstName', placeholder: 'Jane' },
        { label: 'Last name', key: 'lastName', placeholder: 'Doe' },
        {
            label: 'Date of birth',
            key: 'birthday',
            placeholder: 'MM/DD/YYYY',
            type: 'date',
        },
        { label: 'Username', key: 'username', placeholder: '@janedoe' },
        {
            label: 'Email',
            key: 'email',
            placeholder: 'jane@example.com',
            type: 'email',
        },
        {
            label: 'Password',
            key: 'password',
            placeholder: '8+ characters',
            type: 'password',
        },
        {
            label: 'Confirm Password',
            key: 'confirmPassword',
            placeholder: 'same password',
            type: 'password',
        },
    ];

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
                    <Text style={styles.title}>Create account</Text>
                    {error ? (
                        <View style={styles.errorBox}>
                            <Text style={styles.errorText}>{error}</Text>
                        </View>
                    ) : null}

                    {fields.map((f) => (
                        <View
                            key={f.key}
                            style={styles.field}
                        >
                            <Text style={styles.label}>{f.label}</Text>
                            <TextInput
                                style={styles.input}
                                placeholder={f.placeholder}
                                placeholderTextColor={colors.textMuted}
                                secureTextEntry={f.type === 'password'}
                                keyboardType={
                                    f.type === 'email'
                                        ? 'email-address'
                                        : 'default'
                                }
                                autoCapitalize={
                                    f.type === 'email' || f.key === 'username'
                                        ? 'none'
                                        : 'words'
                                }
                                textContentType={
                                    f.type === 'email'
                                        ? 'emailAddress'
                                        : f.type === 'password'
                                          ? 'newPassword'
                                          : 'none'
                                }
                                value={form[f.key]}
                                onChangeText={set(f.key)}
                            />
                        </View>
                    ))}

                    <Pressable
                        style={[styles.btn, loading && { opacity: 0.5 }]}
                        onPress={handleSubmit}
                        disabled={loading}
                    >
                        <Text style={styles.btnText}>
                            {loading ? 'Creating account…' : 'Create account'}
                        </Text>
                    </Pressable>

                    <View style={styles.footer}>
                        <Text style={styles.footerText}>
                            Already have an account?{' '}
                        </Text>
                        <Pressable onPress={() => nav.goBack()}>
                            <Text style={styles.link}>Sign in</Text>
                        </Pressable>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.bgDefault },
    content: { flexGrow: 1, padding: spacing.md, gap: spacing.md },
    title: {
        fontFamily: 'DMSerifDisplay',
        fontSize: 32,
        color: colors.textPrimary,
        letterSpacing: -0.02 * 32,
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
    footer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
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
