import { useMemo, useState } from 'react';
import { GlassCard, Pressable, Text } from '../../components/primitives';
import {
    AuthScaffold,
    AuthField,
    AuthStatus,
    AuthButton,
    makeAuthStyles,
} from '../../components/auth';
import axios from '../../api/client';
import { AuthState, Settings } from '../../types';
import { getErrorMessage, saveAuth } from '../../lib/auth';
import { validatePassword, PASSWORD_RULE_HINT } from '../../lib/passwordPolicy';
import { useAppNavigation } from '../../hooks/useAppNavigation';
import { useTheme } from '../../theme/ThemeContext';

interface Props {
    /** Reset token from the email deep link (?token=...) */
    token: string;
    /** Called after successful reset + auto sign-in */
    onLogin?: () => void;
}

export default function ResetPasswordPage({ token, onLogin }: Props) {
    const { colors } = useTheme();
    const nav = useAppNavigation();
    const styles = useMemo(() => makeAuthStyles(colors), [colors]);

    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [tokenExpired, setTokenExpired] = useState(false);
    const [loading, setLoading] = useState(false);

    const handleSubmit = async () => {
        setError(null);
        if (!token) {
            setError('Reset link is missing or invalid. Request a new one.');
            return;
        }
        const pwError = validatePassword(password);
        if (pwError) {
            setError(pwError);
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
            const status = (err as { response?: { status?: number } })?.response?.status;
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
        <AuthScaffold centered>
            <GlassCard style={styles.card}>
                <Text style={styles.title}>Choose a new password</Text>
                <Text style={styles.body}>
                    Pick a password you haven't used on Ojo before.{'\n'}
                    {PASSWORD_RULE_HINT}.
                </Text>

                {tokenExpired ? (
                    <AuthStatus message="This reset link has expired.">
                        <Pressable
                            onPress={() => nav.replace('/(auth)/forgot-password')}
                            accessibilityRole="link"
                            accessibilityLabel="Request a new link"
                        >
                            <Text style={styles.link}>Request a new link →</Text>
                        </Pressable>
                    </AuthStatus>
                ) : error ? (
                    <AuthStatus message={error} />
                ) : null}

                <AuthField
                    label="New password"
                    placeholder={PASSWORD_RULE_HINT}
                    secureToggle
                    textContentType="newPassword"
                    value={password}
                    onChangeText={setPassword}
                    returnKeyType="next"
                />

                <AuthField
                    label="Confirm new password"
                    placeholder="Re-enter password"
                    secureToggle
                    textContentType="newPassword"
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    returnKeyType="done"
                    onSubmitEditing={handleSubmit}
                />

                <AuthButton
                    label="Update password"
                    loadingLabel="Updating…"
                    loading={loading}
                    disabled={tokenExpired}
                    onPress={handleSubmit}
                />

                <Pressable
                    onPress={() => nav.replace('/(auth)/login')}
                    accessibilityRole="link"
                    accessibilityLabel="Back to sign in"
                >
                    <Text style={[styles.link, { textAlign: 'center' }]}>
                        Back to sign in
                    </Text>
                </Pressable>
            </GlassCard>
        </AuthScaffold>
    );
}
