import { useMemo, useState } from 'react';
import { StyleSheet } from 'react-native';
import { View, Text, Pressable } from '../../components/primitives';
import {
    AuthScaffold,
    AuthStatus,
    AuthButton,
    BirthdayField,
    makeAuthStyles,
} from '../../components/auth';
import axios from '../../api/client';
import { authHeaders, getErrorMessage } from '../../lib/auth';
import { setAgeVerificationNeeded } from '../../lib/ageGate';
import { validateBirthday } from '../../lib/age';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../theme/ThemeContext';
import { spacing } from '../../theme/tokens';

interface Props {
    /** Called once the server accepts the date of birth. */
    onVerified: () => void;
}

/** A dead end reached from this screen, rendered in place of the form. */
interface TerminalState {
    title: string;
    /** The headline reason, in the error-styled banner. */
    message: string;
    /** What it means for the user, and what happens if they continue. */
    body: string;
}

/**
 * Blocking date-of-birth gate.
 *
 * Shown to accounts that never passed through the sign-up form: every
 * Apple/Google sign-up (neither provider returns a date of birth) and every
 * account created before the gate existed. The server refuses all data routes
 * with 403 AGE_VERIFICATION_REQUIRED until this is satisfied, so there is
 * nothing useful behind it to skip to — the only ways out are answering or
 * signing out.
 *
 * Two deliberate choices here:
 *
 *  - The screen does not state the minimum age. Telling someone the threshold
 *    before they answer just teaches them which date to type instead.
 *
 *  - Client-side validation covers malformed and impossible dates only. An
 *    underage date is submitted like any other and the server decides, because
 *    blocking it here would let the user quietly retry with a different year
 *    and the honest answer would never be recorded.
 */
export default function AgeGatePage({ onVerified }: Props) {
    const { colors } = useTheme();
    const { logout } = useAuth();
    const styles = useMemo(() => makeAuthStyles(colors), [colors]);

    const local = useMemo(
        () =>
            StyleSheet.create({
                title: { fontSize: 32, letterSpacing: -0.02 * 32 },
                actions: { gap: spacing.sm, marginTop: spacing.sm },
            }),
        [],
    );

    const [birthday, setBirthday] = useState('');
    const [fieldError, setFieldError] = useState<string | undefined>();
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    // Set when this screen can no longer make progress — the account was deleted
    // for being underage, or its token was rejected. Both are terminal: the form
    // is replaced outright, because leaving a "Continue" button under an error it
    // can never clear just invites the user to mash it.
    const [terminal, setTerminal] = useState<TerminalState | null>(null);

    /** Format-only check. `underage` is intentionally left for the server. */
    const localError = (val: string): string | undefined => {
        const result = validateBirthday(val);
        if (result.ok || result.reason === 'underage') return undefined;
        return result.message;
    };

    const handleCommit = (formatted: string) => {
        setFieldError(localError(formatted));
    };

    const handleSubmit = async () => {
        const err = localError(birthday);
        setFieldError(err);
        if (err) return;

        setError(null);
        setLoading(true);
        try {
            // The client has no request interceptor — authenticated calls must
            // pass the token explicitly, and this route sits behind requireAuth.
            await axios.post('/api/auth/verify-age', { birthday }, authHeaders());
            await setAgeVerificationNeeded(false);
            onVerified();
        } catch (err: unknown) {
            const response = (
                err as { response?: { status?: number; data?: { code?: string; error?: string } } }
            ).response;

            if (response?.data?.code === 'UNDERAGE_ACCOUNT_DELETED') {
                setTerminal({
                    title: 'Account removed',
                    message:
                        response.data.error ??
                        'This account has been removed because it does not meet the minimum age requirement.',
                    body: "Your account and everything stored in it have been deleted. If this was a mistake, you're welcome to sign up again with the correct date.",
                });
                return;
            }

            // A 401 is terminal here, unlike everywhere else in the app: the
            // client's interceptor refreshes and retries a rejected token, but it
            // skips /api/auth/* — and rightly so, because /api/auth/refresh sits
            // behind the very check that just failed, so a refresh would 401 too.
            // Retrying "Continue" can therefore never succeed. Say so plainly
            // rather than showing the raw "Unauthorized" the server sends.
            if (response?.status === 401) {
                setTerminal({
                    title: 'Please sign in again',
                    message: 'Your session expired before your date of birth could be saved.',
                    body: "Nothing has been lost. Signing in again brings you straight back here to finish setting up your account.",
                });
                return;
            }

            setError(getErrorMessage(err, 'Could not verify your date of birth. Please try again.'));
        } finally {
            setLoading(false);
        }
    };

    if (terminal) {
        return (
            <AuthScaffold centered>
                <View style={styles.card}>
                    <Text style={[styles.title, local.title]}>{terminal.title}</Text>
                    <AuthStatus message={terminal.message} />
                    <Text style={styles.body}>{terminal.body}</Text>
                    <AuthButton label="Back to sign in" onPress={logout} />
                </View>
            </AuthScaffold>
        );
    }

    return (
        <AuthScaffold centered>
            <View style={styles.card}>
                <Text style={[styles.title, local.title]}>Confirm your date of birth</Text>
                <Text style={styles.body}>
                    We need this to finish setting up your account. It's stored on your profile and
                    is never shown to anyone else.
                </Text>

                {error && <AuthStatus message={error} />}

                <BirthdayField
                    value={birthday}
                    onChange={setBirthday}
                    onCommit={handleCommit}
                    error={fieldError}
                />

                <View style={local.actions}>
                    <AuthButton
                        label="Continue"
                        loadingLabel="Checking…"
                        loading={loading}
                        disabled={!birthday}
                        onPress={handleSubmit}
                    />
                </View>

                <View style={styles.footer}>
                    <Text style={styles.footerText}>Rather not? </Text>
                    <Pressable onPress={logout} accessibilityRole="link" accessibilityLabel="Sign out">
                        <Text style={styles.link}>Sign out</Text>
                    </Pressable>
                </View>
            </View>
        </AuthScaffold>
    );
}
