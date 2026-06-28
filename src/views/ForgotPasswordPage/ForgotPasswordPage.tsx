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
import { getErrorMessage } from '../../lib/auth';
import { useAppNavigation } from '../../hooks/useAppNavigation';
import { useTheme } from '../../theme/ThemeContext';

export default function ForgotPasswordPage() {
    const { colors } = useTheme();
    const nav = useAppNavigation();
    const styles = useMemo(() => makeAuthStyles(colors), [colors]);

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
        <AuthScaffold centered>
            <GlassCard style={styles.card}>
                <Text style={styles.title}>Reset password</Text>

                {submitted ? (
                    <>
                        <AuthStatus
                            variant="success"
                            message="If an account exists for that email, we've sent a link to reset your password. Check your inbox."
                        />
                        <Pressable
                            onPress={() => nav.goBack()}
                            accessibilityRole="link"
                            accessibilityLabel="Back to sign in"
                        >
                            <Text style={[styles.link, { textAlign: 'center' }]}>
                                Back to sign in
                            </Text>
                        </Pressable>
                    </>
                ) : (
                    <>
                        <Text style={styles.body}>
                            Enter the email you used to sign up. We'll send a link to
                            reset your password.
                        </Text>

                        {error ? <AuthStatus message={error} /> : null}

                        <AuthField
                            label="Email"
                            placeholder="you@example.com"
                            value={email}
                            onChangeText={setEmail}
                            keyboardType="email-address"
                            autoCapitalize="none"
                            autoCorrect={false}
                            textContentType="emailAddress"
                            returnKeyType="send"
                            onSubmitEditing={handleSubmit}
                        />

                        <AuthButton
                            label="Send reset link"
                            loadingLabel="Sending…"
                            loading={loading}
                            onPress={handleSubmit}
                        />

                        <Pressable
                            onPress={() => nav.goBack()}
                            accessibilityRole="link"
                            accessibilityLabel="Back to sign in"
                        >
                            <Text style={[styles.link, { textAlign: 'center' }]}>
                                Back to sign in
                            </Text>
                        </Pressable>
                    </>
                )}
            </GlassCard>
        </AuthScaffold>
    );
}
